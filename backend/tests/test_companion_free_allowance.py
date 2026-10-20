"""Standalone verification for the Journal Companion 2-free-message gate.

Runs server.py with an in-memory fake db and a fake Anthropic reply.
No network, no real AI call, no charge. Rate-slot and daily-reserve
helpers are stubbed to isolate the free-allowance gate (both were
verified live on Oct 19, 2026 and are unchanged by this task).
"""
import os, sys, asyncio

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("JWT_SECRET", "test-secret-for-local-verification")
os.environ.setdefault("ANTHROPIC_API_KEY", "test-key-not-real")
os.environ["COMPANION_TEST_EMAILS"] = "tester@hormoscope-demo.com"
os.environ.pop("COMPANION_PUBLIC_ENABLED", None)

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import server
from fastapi import HTTPException


class FakeCursor:
    def __init__(self, docs):
        self._docs = docs
    def sort(self, *a, **k):
        return self
    async def to_list(self, length=None):
        return list(self._docs)


class FakeCompanionCollection:
    def __init__(self):
        self.docs = []
    async def count_documents(self, filt):
        return sum(1 for d in self.docs if d.get("user_id") == filt.get("user_id"))
    def find(self, filt, projection=None):
        out = [d for d in self.docs
               if d.get("user_id") == filt.get("user_id")
               and ("date" not in filt or d.get("date") == filt.get("date"))]
        return FakeCursor(out)
    async def insert_one(self, doc):
        self.docs.append(dict(doc))


class FakeEmptyCollection:
    def find(self, filt, projection=None):
        return FakeCursor([])
    async def count_documents(self, filt):
        return 0


class FakeDB:
    def __init__(self):
        self.journal_companion = FakeCompanionCollection()
        self._empty = FakeEmptyCollection()
    def __getattr__(self, name):
        return self._empty


fake_db = FakeDB()
server.db = fake_db

CALLS = {"fail": False}
async def fake_anthropic(system_message, messages, max_tokens=1024, return_usage=False):
    if CALLS["fail"]:
        raise RuntimeError("simulated AI failure")
    return ("A warm, personal reply just for you.", {"input_tokens": 10, "output_tokens": 5})
server.call_anthropic = fake_anthropic

async def _true(*a, **k): return True
async def _noop(*a, **k): return None
server._companion_claim_rate_slot = _true
server._companion_reserve_daily_reply = _true
server._companion_release_daily_reply = _noop
server._companion_record_reply = _noop


def make_user(uid, email, entitled=False):
    return {"id": uid, "email": email, "name": "Test User",
            "companion_entitled": entitled, "last_period_date": None,
            "cycle_length": 28}


async def send(user, text):
    req = server.CompanionReplyRequest(message=text)
    try:
        res = await server.companion_reply(req, user)
        return ("ok", res)
    except HTTPException as e:
        return (e.status_code, e.detail)


async def main():
    results = []

    # 1. Brand new free user: message 1 and 2 succeed, state counts up.
    free = make_user("u-free", "free@hormoscope-demo.com")
    st = await server._companion_status(free)
    results.append(("new user status free_remaining=2", st["free_remaining"] == 2 and not st["needs_subscription"] and not st["has_access"]))
    code, res = await send(free, "hello one")
    results.append(("free msg 1 ok", code == "ok" and res["free_used"] == 1 and res["free_remaining"] == 1 and not res["needs_subscription"]))
    code, res = await send(free, "hello two")
    results.append(("free msg 2 ok + needs_subscription flips true", code == "ok" and res["free_used"] == 2 and res["free_remaining"] == 0 and res["needs_subscription"] is True))
    # 2. Third message is refused with the subscribe detail, before any AI call.
    code, detail = await send(free, "hello three")
    results.append(("free msg 3 blocked 403 subscribe-required", code == 403 and "free companion messages are used" in str(detail)))
    st = await server._companion_status(free)
    results.append(("status after 2: needs_subscription true", st["needs_subscription"] is True and st["free_used"] == 2))
    # History preserved: both exchanges still stored.
    results.append(("history preserved (2 exchanges stored)", len(fake_db.journal_companion.docs) == 2))

    # 3. Same account "on a new device" is the same server record: still blocked.
    code, detail = await send(free, "new phone, who dis")
    results.append(("reinstall/new device does not reset", code == 403))

    # 4. A failed AI call does not burn a free message.
    free2 = make_user("u-free2", "free2@hormoscope-demo.com")
    CALLS["fail"] = True
    code, detail = await send(free2, "this will fail")
    CALLS["fail"] = False
    results.append(("failed AI call returns 503", code == 503))
    st = await server._companion_status(free2)
    results.append(("failed call burned nothing (free_used still 0)", st["free_used"] == 0 and st["free_remaining"] == 2))
    code, res = await send(free2, "retry works")
    results.append(("retry after failure ok", code == "ok" and res["free_used"] == 1))

    # 5. When the free user subscribes, access opens and history is intact.
    free["companion_entitled"] = True
    code, res = await send(free, "I subscribed")
    results.append(("after subscribing, messaging works again", code == "ok" and res["subscribed"] is True))
    st = await server._companion_status(free)
    results.append(("subscriber status has_access, no subscription needed", st["has_access"] is True and st["needs_subscription"] is False and st["subscribed"] is True))

    # 6. Entitled subscriber from the start: no free limit interference.
    sub = make_user("u-sub", "sub@hormoscope-demo.com", entitled=True)
    ok = True
    for i in range(3):
        code, res = await send(sub, f"sub msg {i}")
        ok = ok and code == "ok"
    results.append(("paying subscriber sends 3 in a row fine", ok))

    # 7. Private test account keeps access without entitlement.
    tester = make_user("u-test", "tester@hormoscope-demo.com")
    code, res = await send(tester, "test account msg")
    results.append(("test-listed account keeps access", code == "ok"))

    # 8. Char limit still enforced for free users (cost safeguard intact).
    free3 = make_user("u-free3", "free3@hormoscope-demo.com")
    code, detail = await send(free3, "x" * 1001)
    results.append(("1001-char message refused 400 for free user", code == 400))
    st = await server._companion_status(free3)
    results.append(("over-long attempt burned no free message", st["free_used"] == 0))

    failed = [name for name, ok in results if not ok]
    for name, ok in results:
        print(("PASS" if ok else "FAIL"), "-", name)
    print(f"\n{len(results) - len(failed)}/{len(results)} passed")
    sys.exit(1 if failed else 0)


asyncio.run(main())
