"""Standalone verification for v55 (Angelita, Oct 30, 2026):

- Item E: onboarding no longer requires or asks cycle length. An
  omitted cycle_length stores the silent placeholder 28 with
  cycle_length_is_estimate True; a concrete one is stored as given
  with the flag False; an out-of-range concrete one still 400s.
- Item C/D (learning): period starts teach BOTH lengths. Gaps between
  logged starts and bleeding lengths of completed periods are
  recorded in cycle_history, averaged over the last 6 with guardrails
  (gaps 15..90, bleeding 1..15, at least 2 observations), and written
  back to user.cycle_length / user.period_length, clearing the
  estimate flag. The Reset dialog's old overwrite (a sent
  cycle_length re-asserting itself) is dead: /period/reset ignores a
  sent cycle_length entirely.
- Item F (backend half): /partner/status exposes partner_shares_phase
  present-only-when-on, so a partner's device can gate notification
  7104 on the owner's phase sharing.
- Item B (backend half): /cycle-stats recent_cycles cap is now 12.

Runs server.py against in-memory fake collections. No network, no
real Mongo.
"""
import os, sys, asyncio
from datetime import date, timedelta

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
        self.cycle_logs = FakeCollection()
        self.cycle_history = FakeCollection()
        self.daily_content = FakeCollection()
        self.partner_relationships = FakeCollection()


def mk_user(uid, **kw):
    u = {"id": uid, "email": f"{uid}@example.com", "name": "Test",
         "hashed_password": "x", "onboarding_complete": False,
         "cycle_length": 28, "period_length": 5,
         "cycle_status": "regular", "last_period_date": None}
    u.update(kw)
    return u


def add_run(db, uid, start_iso, days):
    start = date.fromisoformat(start_iso)
    for i in range(days):
        db.cycle_logs.docs.append({
            "id": f"log-{uid}-{start_iso}-{i}", "user_id": uid,
            "date": (start + timedelta(days=i)).isoformat(),
            "is_period": True, "flow": "medium", "symptoms": [],
            "notes": "test", "created_at": "2026-01-01T00:00:00+00:00"})


async def call(fn, *args):
    try:
        return ("ok", await fn(*args))
    except HTTPException as e:
        return (e.status_code, e.detail)


async def main():
    results = []

    def check(name, ok):
        results.append((name, bool(ok)))

    # ---------- Item E: onboarding ----------
    db = FakeDB(); server.db = db
    u = mk_user("u-e1")
    db.users.docs.append(dict(u))
    ten_days_ago = (date.today() - timedelta(days=10)).isoformat()
    code, res = await call(server.complete_onboarding,
                           server.UserOnboarding(name="Elena", last_period_date=ten_days_ago,
                                                 cycle_status="regular"), u)
    check("onboarding without cycle_length: ok", code == "ok")
    check("onboarding without cycle_length: placeholder 28 stored",
          res.cycle_length == 28)
    check("onboarding without cycle_length: estimate flag set",
          res.cycle_length_is_estimate is True)
    stored = await db.users.find_one({"id": "u-e1"})
    check("onboarding without cycle_length: stored flag True",
          stored.get("cycle_length_is_estimate") is True)

    db = FakeDB(); server.db = db
    u = mk_user("u-e2")
    db.users.docs.append(dict(u))
    code, res = await call(server.complete_onboarding,
                           server.UserOnboarding(name="Elena", last_period_date=ten_days_ago,
                                                 cycle_status="regular", cycle_length=30), u)
    check("onboarding with concrete 30: stored 30, flag False",
          code == "ok" and res.cycle_length == 30 and res.cycle_length_is_estimate is False)

    db = FakeDB(); server.db = db
    u = mk_user("u-e3")
    db.users.docs.append(dict(u))
    code, _ = await call(server.complete_onboarding,
                         server.UserOnboarding(name="Elena", last_period_date=ten_days_ago,
                                               cycle_status="regular", cycle_length=15), u)
    check("onboarding with out-of-range 15: still rejected", code == 400)

    # ---------- Learning: write back both lengths ----------
    db = FakeDB(); server.db = db
    u = mk_user("u-l1", cycle_length=28, cycle_length_is_estimate=True, period_length=5,
                last_period_date="2026-10-01")
    db.users.docs.append(dict(u))
    add_run(db, "u-l1", "2026-08-01", 5)   # bleeds 5
    add_run(db, "u-l1", "2026-08-31", 6)   # gap 30, bleeds 6
    add_run(db, "u-l1", "2026-10-01", 5)   # gap 31, current period
    summary = await server._apply_cycle_learning("u-l1", "test")
    check("learning: summary returned", summary is not None)
    check("learning: gap of newest cycle recorded raw (31)",
          summary and summary["gap_days"] == 31)
    check("learning: last completed bleeding length (6)",
          summary and summary["last_period_length"] == 6)
    stored = await db.users.find_one({"id": "u-l1"})
    check("learning: cycle length written back (avg of 30,31 -> 30)",
          stored.get("cycle_length") == 30)
    check("learning: period length written back (avg of 5,6 -> 6)",
          stored.get("period_length") == 6)
    check("learning: estimate flag cleared",
          stored.get("cycle_length_is_estimate") is False)
    hist = [d for d in db.cycle_history.docs if d["user_id"] == "u-l1"]
    check("learning: one history entry for the completed cycle",
          len(hist) == 1 and hist[0]["gap_days"] == 31 and hist[0]["period_length_days"] == 6)
    summary2 = await server._apply_cycle_learning("u-l1", "test")
    hist = [d for d in db.cycle_history.docs if d["user_id"] == "u-l1"]
    check("learning: re-running does not duplicate history",
          len(hist) == 1 and summary2 is not None and summary2["history_recorded"] is False)

    # ---------- Learning: minimum data (one gap is not enough) ----------
    db = FakeDB(); server.db = db
    u = mk_user("u-l2", cycle_length=28, cycle_length_is_estimate=True, period_length=5)
    db.users.docs.append(dict(u))
    add_run(db, "u-l2", "2026-09-01", 5)
    add_run(db, "u-l2", "2026-10-01", 5)   # single gap of 30
    summary = await server._apply_cycle_learning("u-l2", "test")
    stored = await db.users.find_one({"id": "u-l2"})
    check("learning minimum: summary exists but nothing written back",
          summary is not None and summary["updated"] is False)
    check("learning minimum: cycle length still the estimate 28, flag still set",
          stored.get("cycle_length") == 28 and stored.get("cycle_length_is_estimate") is True)
    check("learning minimum: period length untouched",
          stored.get("period_length") == 5)

    # ---------- Learning: guardrail gap ignored for the average ----------
    db = FakeDB(); server.db = db
    u = mk_user("u-l3", cycle_length=28, period_length=5)
    db.users.docs.append(dict(u))
    add_run(db, "u-l3", "2026-01-01", 5)
    add_run(db, "u-l3", "2026-04-11", 5)   # gap 100: outside 15..90
    add_run(db, "u-l3", "2026-05-11", 5)   # gap 30
    add_run(db, "u-l3", "2026-06-11", 5)   # gap 31
    await server._apply_cycle_learning("u-l3", "test")
    stored = await db.users.find_one({"id": "u-l3"})
    check("learning guardrail: 100 day gap excluded, learned from 30 and 31",
          stored.get("cycle_length") == 30)

    # ---------- Reset: sent cycle_length is ignored, learning wins ----------
    db = FakeDB(); server.db = db
    u = mk_user("u-r1", cycle_length=28, cycle_length_is_estimate=True, period_length=5,
                last_period_date="2026-08-31")
    db.users.docs.append(dict(u))
    add_run(db, "u-r1", "2026-08-01", 5)
    add_run(db, "u-r1", "2026-08-31", 6)
    code, res = await call(server.reset_period,
                           server.PeriodReset(new_period_date="2026-10-01",
                                              cycle_length=35, period_length=5), u)
    check("reset: ok", code == "ok")
    check("reset: sent cycle_length 35 NOT honored (learned 30 instead)",
          isinstance(res, dict) and res.get("cycle_length") == 30)
    learn = (res or {}).get("learning") or {}
    check("reset: learning summary rides the response",
          learn.get("gap_days") == 31 and learn.get("last_period_length") == 6
          and learn.get("learned_cycle_length") == 30 and learn.get("learned_period_length") == 6)

    # ---------- Reset: first ever, no history ----------
    db = FakeDB(); server.db = db
    u = mk_user("u-r2", cycle_length=28, cycle_length_is_estimate=True, period_length=5)
    db.users.docs.append(dict(u))
    today_iso = date.today().isoformat()
    code, res = await call(server.reset_period,
                           server.PeriodReset(new_period_date=today_iso, period_length=5), u)
    check("reset first ever: ok, no learning yet, estimate kept",
          code == "ok" and res.get("learning") is None and res.get("cycle_length") == 28)

    # ---------- period/started path learns the same way ----------
    db = FakeDB(); server.db = db
    u = mk_user("u-s1", cycle_length=28, cycle_length_is_estimate=True, period_length=5,
                last_period_date="2026-08-31")
    db.users.docs.append(dict(u))
    add_run(db, "u-s1", "2026-08-01", 5)
    add_run(db, "u-s1", "2026-08-31", 6)
    code, res = await call(server.mark_period_started,
                           server.PeriodStartRequest(start_date="2026-10-01"), u)
    learn = (res or {}).get("learning") or {}
    stored = await db.users.find_one({"id": "u-s1"})
    check("period/started: learning summary present",
          code == "ok" and learn.get("learned_cycle_length") == 30)
    check("period/started: learned values written back",
          stored.get("cycle_length") == 30 and stored.get("period_length") == 6)

    # ---------- Partner status: partner_shares_phase gating ----------
    db = FakeDB(); server.db = db
    owner = mk_user("u-o1", partner_visibility={"phase": True, "mood_energy": True,
                                                "period_dates": True, "fertile_window": False,
                                                "wishlist": True, "share_journal": False,
                                                "share_intimacy": False})
    partner = mk_user("u-p1")
    db.users.docs += [dict(owner), dict(partner)]
    db.partner_relationships.docs.append(
        {"id": "rel-1", "user_id": "u-o1", "partner_user_id": "u-p1",
         "active": True, "created_at": "2026-10-01T00:00:00+00:00"})
    code, res = await call(server.get_partner_status, partner)
    check("partner status: shares_phase present when phase sharing on",
          code == "ok" and res.get("partner_shares_phase") is True)

    db = FakeDB(); server.db = db
    owner = mk_user("u-o2", partner_visibility={"phase": False, "mood_energy": True,
                                                "period_dates": True, "fertile_window": False,
                                                "wishlist": True, "share_journal": False,
                                                "share_intimacy": False})
    partner = mk_user("u-p2")
    db.users.docs += [dict(owner), dict(partner)]
    db.partner_relationships.docs.append(
        {"id": "rel-2", "user_id": "u-o2", "partner_user_id": "u-p2",
         "active": True, "created_at": "2026-10-01T00:00:00+00:00"})
    code, res = await call(server.get_partner_status, partner)
    check("partner status: shares_phase ABSENT when phase sharing off",
          code == "ok" and "partner_shares_phase" not in res)

    # ---------- Cycle stats: recent_cycles cap 12 ----------
    db = FakeDB(); server.db = db
    u = mk_user("u-c1")
    db.users.docs.append(dict(u))
    start = date(2025, 1, 1)
    for k in range(13):
        add_run(db, "u-c1", (start + timedelta(days=30 * k)).isoformat(), 5)
    code, res = await call(server.get_cycle_stats, u)
    check("cycle-stats: recent_cycles returns the last 12",
          code == "ok" and len(res.get("recent_cycles") or []) == 12)

    failed = [n for n, ok in results if not ok]
    for n, ok in results:
        print(("PASS " if ok else "FAIL ") + n)
    print(f"\n{len(results) - len(failed)}/{len(results)} passed")
    if failed:
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
