"""Standalone verification that partner-facing payloads carry the other
person's profile picture (Angelita, Oct 25, 2026: a picture is mandatory
to sync, and the partner sees the face beside the name).

Covers GET /partner/status, GET /partner/mood, GET /partner/sync and
GET /partner/calendar in server.py. Runs with in-memory fakes; no
network, no real Mongo.
"""
import os, sys, asyncio
from datetime import datetime, timezone, timedelta

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("JWT_SECRET", "test-secret-for-local-verification")
os.environ.setdefault("ANTHROPIC_API_KEY", "test-key-not-real")

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import server
from fastapi import HTTPException

OWNER_PHOTO = "data:image/png;base64,OWNERPHOTO"
PARTNER_PHOTO = "data:image/png;base64,PATNERPHOTO"
RECENT = (datetime.now(timezone.utc).date() - timedelta(days=10)).isoformat()

OWNER = {"id": "u-owner", "email": "owner@example.com", "name": "Olivia",
         "profile_photo": OWNER_PHOTO, "last_period_date": RECENT,
         "cycle_length": 28, "cycle_status": "regular"}
PARTNER = {"id": "u-partner", "email": "partner@example.com", "name": "Pat",
           "profile_photo": PARTNER_PHOTO, "last_period_date": RECENT,
           "cycle_length": 28, "cycle_status": "regular"}
STRANGER = {"id": "u-stranger", "email": "solo@example.com", "name": "Solo"}

REL = {"id": "rel-1", "user_id": "u-owner", "partner_user_id": "u-partner", "active": True}
USERS = {"u-owner": OWNER, "u-partner": PARTNER}


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


class FakeCursor:
    def __init__(self, docs):
        self.docs = docs

    def sort(self, *a, **k):
        return self

    async def to_list(self, length=None):
        return list(self.docs)


class FakeLogsCollection:
    def find(self, filt, projection=None):
        return FakeCursor([])

    async def find_one(self, filt, projection=None):
        return None


class FakeDB:
    def __init__(self, rel, users):
        self.partner_relationships = FakeRelCollection(rel)
        self.users = FakeUsersCollection(users)
        self.partner_mood_logs = FakeLogsCollection()
        self.cycle_logs = FakeLogsCollection()


server.db = FakeDB(REL, USERS)


async def call(fn, user):
    try:
        return ("ok", await fn(user))
    except HTTPException as e:
        return (e.status_code, e.detail)


async def main():
    results = []

    # 1. Status: each side sees the OTHER person's name and picture.
    code, res = await call(server.get_partner_status, OWNER)
    results.append(("status ok for owner", code == "ok"))
    results.append(("status partner_name is Pat", res.get("partner_name") == "Pat"))
    results.append(("status partner_photo is partner's", res.get("partner_photo") == PARTNER_PHOTO))
    code, res = await call(server.get_partner_status, PARTNER)
    results.append(("status partner_photo is owner's for partner", res.get("partner_photo") == OWNER_PHOTO))

    # 2. Mood GET carries the partner picture too.
    code, res = await call(server.get_partner_mood, OWNER)
    results.append(("mood GET ok", code == "ok"))
    results.append(("mood GET partner_photo is partner's", res.get("partner_photo") == PARTNER_PHOTO))
    code, res = await call(server.get_partner_mood, PARTNER)
    results.append(("mood GET partner_photo is owner's for partner", res.get("partner_photo") == OWNER_PHOTO))

    # 3. Sync: both sides of the payload carry a picture.
    code, res = await call(server.get_partner_sync, OWNER)
    results.append(("sync ok", code == "ok"))
    results.append(("sync me.profile_photo is owner's", (res.get("me") or {}).get("profile_photo") == OWNER_PHOTO))
    results.append(("sync them.profile_photo is partner's", (res.get("them") or {}).get("profile_photo") == PARTNER_PHOTO))
    results.append(("sync them.name is Pat", (res.get("them") or {}).get("name") == "Pat"))

    # 4. Calendar: the owner's picture rides with her name.
    code, res = await call(server.get_partner_calendar, PARTNER)
    results.append(("calendar ok", code == "ok"))
    results.append(("calendar name is Olivia", res.get("name") == "Olivia"))
    results.append(("calendar profile_photo is owner's", res.get("profile_photo") == OWNER_PHOTO))

    # 5. Unlinked users still get nothing.
    code, _ = await call(server.get_partner_status, STRANGER)
    results.append(("status for stranger is unlinked", code == "ok"))

    failed = [name for name, ok in results if not ok]
    for name, ok in results:
        print(("PASS" if ok else "FAIL"), "-", name)
    print(f"\n{len(results) - len(failed)}/{len(results)} passed")
    sys.exit(1 if failed else 0)


asyncio.run(main())
