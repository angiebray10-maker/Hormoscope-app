"""Standalone verification for the Partner Daily Note (Angelita, Oct 29, 2026).

Every day a linked partner sees ONE partner-facing line built ONLY
from the owner's phase and cycle day: what she likely needs today,
plus one small prompt the partner can act on. The note rotates by
cycle day inside a phase. It rides the payloads partners already
receive (in-app partner sync and calendar, the legacy link view, and
the view-link page) and the owner's own dashboard, where Home shows
it as a preview of what her partner sees.

Privacy is the point of these tests: the note appears ONLY while her
phase sharing choice is on. While it is off, the partner_daily_note
key is ABSENT from every partner payload, not hidden in the UI. The
note is a pure function of (phase, cycle day); journal, vault, and
intimacy content can never leak into it or into the payloads it
rides on, and those payloads are scanned for sentinel content here.

Runs server.py against in-memory fake collections. No network, no
real Mongo.
"""
import os, sys, asyncio, json
from datetime import datetime, timezone, timedelta, date

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("JWT_SECRET", "test-secret-for-local-verification")
os.environ.setdefault("ANTHROPIC_API_KEY", "test-key-not-real")

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import server
from fastapi import HTTPException


# ---------------- Fake Mongo (same harness as test_journal_sharing) ----------------

def _matches(doc, filt):
    for k, v in (filt or {}).items():
        if k == "$or":
            if not any(_matches(doc, sub) for sub in v):
                return False
        elif isinstance(v, dict):
            dv = doc.get(k)
            for op, ov in v.items():
                if op == "$gte" and not (dv is not None and dv >= ov):
                    return False
                if op == "$lte" and not (dv is not None and dv <= ov):
                    return False
                if op == "$lt" and not (dv is not None and dv < ov):
                    return False
                if op == "$in" and dv not in ov:
                    return False
                if op == "$ne" and dv == ov:
                    return False
        elif doc.get(k) != v:
            return False
    return True


class FakeResult:
    def __init__(self, n=0):
        self.deleted_count = n
        self.modified_count = n


class FakeCursor:
    def __init__(self, docs):
        self._docs = docs

    def sort(self, key, direction=1):
        self._docs = sorted(self._docs, key=lambda d: str(d.get(key) or ""),
                            reverse=(direction < 0))
        return self

    async def to_list(self, length=None):
        return list(self._docs)


class FakeCollection:
    def __init__(self, docs=None):
        self.docs = list(docs or [])

    def find(self, filt=None, projection=None):
        return FakeCursor([dict(d) for d in self.docs if _matches(d, filt)])

    async def find_one(self, filt, projection=None):
        for d in self.docs:
            if _matches(d, filt):
                return dict(d)
        return None

    async def insert_one(self, doc):
        self.docs.append(dict(doc))
        return FakeResult(1)

    async def update_one(self, filt, update):
        for d in self.docs:
            if _matches(d, filt):
                for k, v in (update.get("$set") or {}).items():
                    d[k] = v
                return FakeResult(1)
        return FakeResult(0)

    async def delete_many(self, filt):
        before = len(self.docs)
        self.docs = [d for d in self.docs if not _matches(d, filt)]
        return FakeResult(before - len(self.docs))


class FakeDB:
    def __init__(self):
        self.users = FakeCollection()
        self.partner_relationships = FakeCollection()
        self.partner_invites = FakeCollection()
        self.partner_links = FakeCollection()
        self.cycle_logs = FakeCollection()
        self.wishlist_items = FakeCollection()
        self.journal_entries = FakeCollection()
        self.intimacy_logs = FakeCollection()
        self.daily_content = FakeCollection()


SENTINELS = ["JOURNALSENTINELWORDS", "INTIMATESECRETWORDS", "SECRETINTIMACY"]
FORBIDDEN_KEYS = ("journal", "vault", "intimacy")


def scan_clean(obj, label, results):
    blob = json.dumps(obj, default=str)
    results.append((f"{label}: no sentinel content",
                    not any(s in blob for s in SENTINELS)))

    def walk(o):
        if isinstance(o, dict):
            for k, v in o.items():
                if any(f in str(k).lower() for f in FORBIDDEN_KEYS):
                    return False
                if not walk(v):
                    return False
        elif isinstance(o, list):
            return all(walk(x) for x in o)
        return True
    results.append((f"{label}: no journal/vault/intimacy keys", walk(obj)))


def has_key_deep(obj, wanted):
    if isinstance(obj, dict):
        return wanted in obj or any(has_key_deep(v, wanted) for v in obj.values())
    if isinstance(obj, list):
        return any(has_key_deep(x, wanted) for x in obj)
    return False


def days_ago(n):
    return (date.today() - timedelta(days=n)).isoformat()


def mk_user(uid, name, **kw):
    u = {"id": uid, "email": f"{uid}@example.com", "name": name,
         "hashed_password": "x", "onboarding_complete": True,
         "last_period_date": days_ago(1), "cycle_length": 28,
         "cycle_status": "regular"}
    u.update(kw)
    return u


async def call(fn, *args):
    try:
        return ("ok", await fn(*args))
    except HTTPException as e:
        return (e.status_code, e.detail)


VIS_ON = {"phase": True, "mood_energy": True, "period_dates": True,
          "fertile_window": False, "wishlist": True, "share_journal": False}
VIS_PHASE_OFF = {"phase": False, "mood_energy": True, "period_dates": True,
                 "fertile_window": False, "wishlist": True, "share_journal": False}


def seed(db, owner_kw=None):
    owner = mk_user("u-owner", "Olivia", **(owner_kw or {}))
    partner = mk_user("u-partner", "Pam")
    db.users.docs += [dict(owner), dict(partner)]
    db.partner_relationships.docs.append(
        {"id": "rel-1", "user_id": "u-owner", "partner_user_id": "u-partner",
         "active": True, "created_at": "2026-10-01T00:00:00+00:00"})
    now = datetime.now(timezone.utc)
    db.journal_entries.docs.append(
        {"id": "j-1", "user_id": "u-owner", "title": "Today page",
         "content": "JOURNALSENTINELWORDS", "is_intimate": False,
         "created_at": now.strftime("%Y-%m-%dT%H:%M:%S+00:00")})
    db.journal_entries.docs.append(
        {"id": "j-2", "user_id": "u-owner", "title": "Eyes only",
         "content": "INTIMATESECRETWORDS", "is_intimate": True,
         "created_at": now.strftime("%Y-%m-%dT%H:%M:%S+00:00")})
    db.intimacy_logs.docs.append({"id": "i1", "user_id": "u-owner", "content": "SECRETINTIMACY"})
    db.partner_invites.docs.append(
        {"id": "inv-v", "inviter_id": "u-owner", "kind": "view",
         "status": "accepted", "view_token": "tok-view-1"})
    db.partner_links.docs.append(
        {"id": "lnk-1", "user_id": "u-owner", "link_code": "LEGACY1", "active": True})
    return owner, partner


# ---------------- Sections ----------------

def section_generator(results):
    gen = server._partner_daily_note
    m = gen("menstrual", 2)
    results.append(("generator: note has text and prompt",
                    bool(m and m.get("text") and m.get("prompt"))))
    o = gen("ovulatory", 15)
    results.append(("generator: text differs across phases",
                    o is not None and m["text"] != o["text"]))
    for phase in ("menstrual", "follicular", "ovulatory", "luteal", "late"):
        n = gen(phase, 3)
        results.append((f"generator: {phase} note present", bool(n and n.get("text"))))
    results.append(("generator: rotates within menstrual (day 2 vs 3)",
                    gen("menstrual", 2)["text"] != gen("menstrual", 3)["text"]))
    results.append(("generator: rotates within luteal (day 21 vs 22)",
                    gen("luteal", 21)["text"] != gen("luteal", 22)["text"]))
    results.append(("generator: three straight days all differ",
                    len({gen("follicular", d)["text"] for d in (7, 8, 9)}) == 3))
    results.append(("generator: unknown phase gives no note",
                    gen("unknown", 4) is None and gen("nonsense", 4) is None))
    blob = json.dumps([gen(p, d) for p in server.PARTNER_DAILY_NOTES for d in range(1, 30)])
    results.append(("generator: no journal sentinel in any note",
                    not any(s in blob for s in SENTINELS)))


async def section_phase_on(results):
    db = FakeDB()
    server.db = db
    owner, partner = seed(db, owner_kw={"partner_visibility": dict(VIS_ON)})
    expect = server._partner_daily_note("menstrual", 2)

    code, res = await call(server.get_partner_view, "LEGACY1")
    results.append(("on: legacy view ok", code == "ok"))
    results.append(("on: legacy view carries the note",
                    (res.get("partner_daily_note") or {}).get("text") == expect["text"]))
    scan_clean(res, "on legacy view", results)

    payload = await server._partner_view_payload("tok-view-1")
    results.append(("on: view payload carries the note",
                    (payload.get("partner_daily_note") or {}).get("text") == expect["text"]))
    scan_clean(payload, "on view payload", results)
    page = server._render_partner_view_html(payload)
    results.append(("on: view page shows the note text", expect["text"] in page))
    scan_clean(page, "on view page", results)

    code, res = await call(server.get_partner_sync, dict(partner))
    results.append(("on: sync ok", code == "ok"))
    them = (res or {}).get("them") or {}
    results.append(("on: sync partner side carries the note",
                    (them.get("partner_daily_note") or {}).get("text") == expect["text"]))
    scan_clean(res, "on sync", results)

    code, res = await call(server.get_partner_calendar, dict(partner))
    results.append(("on: calendar ok", code == "ok"))
    results.append(("on: calendar carries the note",
                    (res.get("partner_daily_note") or {}).get("text") == expect["text"]))
    scan_clean(res, "on calendar", results)

    code, res = await call(server.get_dashboard, dict(owner))
    results.append(("on: dashboard ok", code == "ok"))
    results.append(("on: owner preview is the same line her partner sees",
                    (res.get("partner_daily_note") or {}).get("text") == expect["text"]))


async def section_phase_off(results):
    db = FakeDB()
    server.db = db
    owner, partner = seed(db, owner_kw={"partner_visibility": dict(VIS_PHASE_OFF)})

    code, res = await call(server.get_partner_view, "LEGACY1")
    results.append(("off: legacy view ok", code == "ok"))
    results.append(("off: legacy view has no note key",
                    not has_key_deep(res, "partner_daily_note")))

    payload = await server._partner_view_payload("tok-view-1")
    results.append(("off: view payload has no note key",
                    payload is not None and not has_key_deep(payload, "partner_daily_note")))
    page = server._render_partner_view_html(payload)
    note = server._partner_daily_note("menstrual", 2)
    results.append(("off: view page shows no note text", note["text"] not in page))
    scan_clean(payload, "off view payload", results)

    code, res = await call(server.get_partner_sync, dict(partner))
    results.append(("off: sync ok", code == "ok"))
    results.append(("off: sync partner side is not shared",
                    ((res or {}).get("them") or {}).get("shared") is False))
    # The owner's side of the sync carries no note at all. (The "me"
    # side is the requester's OWN cycle, which sync has always shown
    # in full to herself; a note there is her own data, not the
    # owner's, and it follows her own sharing defaults.)
    results.append(("off: sync owner side has no note key",
                    not has_key_deep((res or {}).get("them"), "partner_daily_note")))

    code, res = await call(server.get_partner_calendar, dict(partner))
    results.append(("off: calendar ok", code == "ok"))
    results.append(("off: calendar has no note key",
                    not has_key_deep(res, "partner_daily_note")))

    code, res = await call(server.get_dashboard, dict(owner))
    results.append(("off: dashboard ok", code == "ok"))
    results.append(("off: no owner preview while sharing is off",
                    not has_key_deep(res, "partner_daily_note")))


async def section_other_phase(results):
    db = FakeDB()
    server.db = db
    owner, partner = seed(db, owner_kw={
        "partner_visibility": dict(VIS_ON),
        "last_period_date": days_ago(14)})  # cycle day 15: ovulatory
    expect = server._partner_daily_note("ovulatory", 15)
    code, res = await call(server.get_partner_view, "LEGACY1")
    results.append(("ovulatory: legacy view phase is ovulatory",
                    code == "ok" and res.get("phase") == "ovulatory"))
    results.append(("ovulatory: note matches the ovulatory line",
                    (res.get("partner_daily_note") or {}).get("text") == expect["text"]))
    results.append(("ovulatory: note differs from the menstrual line",
                    expect["text"] != server._partner_daily_note("menstrual", 2)["text"]))


async def main():
    results = []
    section_generator(results)
    await section_phase_on(results)
    await section_phase_off(results)
    await section_other_phase(results)
    failed = [name for name, ok in results if not ok]
    for name, ok in results:
        print(("PASS " if ok else "FAIL ") + name)
    print(f"\n{len(results) - len(failed)}/{len(results)} passed")
    if failed:
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
