"""Standalone verification for GET /partner/sync day strip assembly.

Covers the bug where the non-tracking partner (no cycle data of their own,
the typical male partner) got days: [] even though the tracking partner saw
the full 28-day strip for the same link. Runs server.py with in-memory fake
collections for partner_relationships and users. No network, no real Mongo.
"""
import os, sys, asyncio
from datetime import date, timedelta

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("JWT_SECRET", "test-secret-for-local-verification")
os.environ.setdefault("ANTHROPIC_API_KEY", "test-key-not-real")

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import server
from fastapi import HTTPException


def _matches(doc, filt):
    for k, v in filt.items():
        if k == "$or":
            if not any(_matches(doc, sub) for sub in v):
                return False
        elif doc.get(k) != v:
            return False
    return True


class FakeRelCollection:
    def __init__(self, rel):
        self.rel = rel

    async def find_one(self, filt, projection=None):
        if self.rel and _matches(self.rel, filt):
            return dict(self.rel)
        return None


class FakeUsersCollection:
    def __init__(self, users):
        self.users = users

    async def find_one(self, filt, projection=None):
        u = self.users.get(filt.get("id"))
        return dict(u) if u else None


class FakeEmptyCollection:
    async def find_one(self, filt, projection=None):
        return None


class FakeDB:
    def __init__(self, rel, users):
        self.partner_relationships = FakeRelCollection(rel)
        self.users = FakeUsersCollection(users)
        self._empty = FakeEmptyCollection()

    def __getattr__(self, name):
        return self._empty


TODAY = date.today()
# Owner: last period 14 days ago on a 28-day cycle -> cycle day 15 today.
OWNER_LP = (TODAY - timedelta(days=14)).isoformat()
# Second tracker: last period 4 days ago -> cycle day 5 (menstrual) today.
TRACKER_LP = (TODAY - timedelta(days=4)).isoformat()

REL = {"id": "rel-1", "user_id": "u-owner", "partner_user_id": "u-partner", "active": True}

OWNER_TRACKING = {"id": "u-owner", "email": "owner@example.com", "name": "Olivia",
                  "last_period_date": OWNER_LP, "cycle_length": 28}
PARTNER_PLAIN = {"id": "u-partner", "email": "partner@example.com", "name": "Pat"}
PARTNER_TRACKING = {"id": "u-partner", "email": "partner@example.com", "name": "Pat",
                    "last_period_date": TRACKER_LP, "cycle_length": 28}
OWNER_PLAIN = {"id": "u-owner", "email": "owner@example.com", "name": "Olivia"}


async def sync(user):
    try:
        res = await server.get_partner_sync(user)
        return ("ok", res)
    except HTTPException as e:
        return (e.status_code, e.detail)


async def main():
    results = []

    def check(name, ok):
        results.append((name, bool(ok)))

    # (a) Tracking owner asks a link whose partner does not track.
    server.db = FakeDB(REL, {"u-owner": OWNER_TRACKING, "u-partner": PARTNER_PLAIN})
    code, a = await sync(OWNER_TRACKING)
    check("owner asks: ok", code == "ok")
    check("owner asks: days length 28", len(a["days"]) == 28)
    check("owner asks: strip has me, them None",
          all(d["me"] is not None and d["them"] is None for d in a["days"]))
    check("owner asks: day 1 is owner cycle day 15",
          a["days"][0]["me"]["cycle_day"] == 15 and a["days"][0]["me"]["phase"] == "ovulatory")
    check("owner asks: dates run today..today+27",
          a["days"][0]["date"] == TODAY.isoformat()
          and a["days"][27]["date"] == (TODAY + timedelta(days=27)).isoformat())
    check("owner asks: response keys unchanged",
          set(a.keys()) == {"me", "them", "days", "overlap_days", "both_period_days"})
    check("owner asks: them block carries owner data for the partner view",
          a["me"]["cycle_day"] == 15 and a["them"].get("tracking") is False)

    # (b) Non-tracking partner asks the SAME link: the strip must be built
    # from the owner's timeline (this was the empty-days bug).
    code, b = await sync(PARTNER_PLAIN)
    check("partner asks: ok", code == "ok")
    check("partner asks: days length 28 (bug fix)", len(b["days"]) == 28)
    check("partner asks: strip has them, me None",
          all(d["them"] is not None and d["me"] is None for d in b["days"]))
    check("partner asks: strip identical to what owner sees of herself",
          [d["them"] for d in b["days"]] == [d["me"] for d in a["days"]]
          and [d["date"] for d in b["days"]] == [d["date"] for d in a["days"]])
    check("partner asks: them block still carries owner cycle data",
          b["them"]["cycle_day"] == 15 and b["them"]["phase"] == "ovulatory"
          and b["them"]["next_period_date"] is not None)
    check("partner asks: no overlap claimed with one timeline",
          b["overlap_days"] == 0 and b["both_period_days"] == 0)
    strip_keys = set()
    for d in b["days"]:
        strip_keys |= set(d.keys()) | set(d["them"].keys())
    check("partner asks: strip carries no private fields",
          strip_keys <= {"date", "me", "them", "same_phase", "both_period", "cycle_day", "phase"})

    # (c) Both partners track: combined strip behavior unchanged.
    server.db = FakeDB(REL, {"u-owner": OWNER_TRACKING, "u-partner": PARTNER_TRACKING})
    code, c = await sync(OWNER_TRACKING)
    check("both track: ok", code == "ok")
    check("both track: days length 28", len(c["days"]) == 28)
    check("both track: every day has both sides",
          all(d["me"] is not None and d["them"] is not None for d in c["days"]))
    check("both track: day 1 sides are cycle days 15 and 5",
          c["days"][0]["me"]["cycle_day"] == 15 and c["days"][0]["them"]["cycle_day"] == 5)
    check("both track: overlap/both_period counts match the strip",
          c["overlap_days"] == sum(1 for d in c["days"] if d["same_phase"])
          and c["both_period_days"] == sum(1 for d in c["days"] if d["both_period"]))
    check("both track: same_phase flags are real comparisons",
          all(d["same_phase"] == (d["me"]["phase"] == d["them"]["phase"]) for d in c["days"]))
    # And from the other side the same combined strip comes back.
    code, c2 = await sync(PARTNER_TRACKING)
    check("both track: partner side also gets 28 combined days",
          code == "ok" and len(c2["days"]) == 28
          and c2["days"][0]["me"]["cycle_day"] == 5 and c2["days"][0]["them"]["cycle_day"] == 15)

    # (d) Neither partner tracks: an empty strip is correct.
    server.db = FakeDB(REL, {"u-owner": OWNER_PLAIN, "u-partner": PARTNER_PLAIN})
    code, dres = await sync(OWNER_PLAIN)
    check("neither tracks: ok", code == "ok")
    check("neither tracks: days empty", dres["days"] == [])
    check("neither tracks: counts zero", dres["overlap_days"] == 0 and dres["both_period_days"] == 0)
    code, dres2 = await sync(PARTNER_PLAIN)
    check("neither tracks: partner side days empty too", code == "ok" and dres2["days"] == [])

    failed = [name for name, ok in results if not ok]
    for name, ok in results:
        print(("PASS" if ok else "FAIL"), "-", name)
    print(f"\n{len(results) - len(failed)}/{len(results)} passed")
    sys.exit(1 if failed else 0)


asyncio.run(main())
