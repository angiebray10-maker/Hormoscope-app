"""Standalone verification for partner mood logging (/partner/mood).

Runs server.py with in-memory fake collections for partner_relationships,
users, and partner_mood_logs. No network, no real Mongo.
"""
import os, sys, asyncio
from datetime import datetime, timezone

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("JWT_SECRET", "test-secret-for-local-verification")
os.environ.setdefault("ANTHROPIC_API_KEY", "test-key-not-real")

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import server
from fastapi import HTTPException


class FakeResult:
    def __init__(self, n=1):
        self.modified_count = n
        self.deleted_count = n


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


class FakeMoodCollection:
    def __init__(self):
        self.docs = []

    async def find_one(self, filt, projection=None):
        for d in self.docs:
            if _matches(d, filt):
                return dict(d)
        return None

    async def insert_one(self, doc):
        self.docs.append(dict(doc))
        return FakeResult()

    async def update_one(self, filt, update):
        for d in self.docs:
            if _matches(d, filt):
                d.update(update.get("$set", {}))
                return FakeResult(1)
        return FakeResult(0)


class FakeEmptyCollection:
    async def find_one(self, filt, projection=None):
        return None


class FakeDB:
    def __init__(self, rel, users):
        self.partner_relationships = FakeRelCollection(rel)
        self.users = FakeUsersCollection(users)
        self.partner_mood_logs = FakeMoodCollection()
        self._empty = FakeEmptyCollection()

    def __getattr__(self, name):
        return self._empty


OWNER = {"id": "u-owner", "email": "owner@example.com", "name": "Olivia"}
PARTNER = {"id": "u-partner", "email": "partner@example.com", "name": "Pat"}
STRANGER = {"id": "u-stranger", "email": "solo@example.com", "name": "Solo"}

REL = {"id": "rel-1", "user_id": "u-owner", "partner_user_id": "u-partner", "active": True}
USERS = {
    "u-owner": {"id": "u-owner", "name": "Olivia"},
    "u-partner": {"id": "u-partner", "name": "Pat"},
}

fake_db = FakeDB(REL, USERS)
server.db = fake_db


async def post(user, mood, feelings):
    req = server.PartnerMoodCreate(mood=mood, feelings=feelings)
    try:
        res = await server.create_partner_mood(req, user)
        return ("ok", res)
    except HTTPException as e:
        return (e.status_code, e.detail)


async def get(user):
    try:
        res = await server.get_partner_mood(user)
        return ("ok", res)
    except HTTPException as e:
        return (e.status_code, e.detail)


async def main():
    results = []
    today = datetime.now(timezone.utc).date().isoformat()

    # 1. Unlinked user is refused on both endpoints.
    code, _ = await post(STRANGER, 4, ["Calm"])
    results.append(("unlinked POST 403", code == 403))
    code, _ = await get(STRANGER)
    results.append(("unlinked GET 403", code == 403))

    # 2. Validation.
    code, _ = await post(OWNER, 0, [])
    results.append(("mood 0 refused 400", code == 400))
    code, _ = await post(OWNER, 6, [])
    results.append(("mood 6 refused 400", code == 400))
    code, _ = await post(OWNER, None, [])
    results.append(("empty mood and feelings refused 400", code == 400))
    code, _ = await post(OWNER, 3, [f"F{i}" for i in range(13)])
    results.append(("13 feelings refused 400", code == 400))
    results.append(("no docs stored after validation failures", len(fake_db.partner_mood_logs.docs) == 0))

    # 3. Owner logs: label, trimming, recipient, date are correct.
    code, res = await post(OWNER, 4, ["Calm", " Happy "])
    results.append(("owner POST ok", code == "ok"))
    results.append(("mood_label Good for 4", res.get("mood_label") == "Good"))
    results.append(("feelings trimmed", res.get("feelings") == ["Calm", "Happy"]))
    results.append(("recipient is partner", res.get("recipient_id") == "u-partner"))
    results.append(("date is UTC today", res.get("date") == today))
    results.append(("no _id in returned doc", "_id" not in res))

    # 4. Relogging today upserts, never stacks.
    code, res = await post(OWNER, 5, ["Joyful"])
    results.append(("relog POST ok with Great label", code == "ok" and res.get("mood_label") == "Great"))
    results.append(("still one doc for owner today", len([d for d in fake_db.partner_mood_logs.docs if d["author_id"] == "u-owner"]) == 1))
    results.append(("relog updated feelings", res.get("feelings") == ["Joyful"]))

    # 5. GET as owner before partner logs: mine present, theirs null, name right.
    code, res = await get(OWNER)
    results.append(("owner GET ok", code == "ok"))
    results.append(("owner mine_today present", bool(res.get("mine_today")) and res["mine_today"]["mood"] == 5))
    results.append(("owner theirs_today null before partner logs", res.get("theirs_today") is None))
    results.append(("owner partner_name is Pat", res.get("partner_name") == "Pat"))

    # 6. Partner logs; both sides now see each other (pair visibility).
    code, res = await post(PARTNER, 2, ["Tired"])
    results.append(("partner POST ok, recipient is owner", code == "ok" and res.get("recipient_id") == "u-owner"))
    code, res = await get(OWNER)
    results.append(("owner sees partner mood", bool(res.get("theirs_today")) and res["theirs_today"]["mood_label"] == "Meh" and res["theirs_today"]["feelings"] == ["Tired"]))
    results.append(("owner mine unchanged", bool(res.get("mine_today")) and res["mine_today"]["mood"] == 5))
    code, res = await get(PARTNER)
    results.append(("partner sees owner mood", bool(res.get("theirs_today")) and res["theirs_today"]["mood"] == 5 and res.get("partner_name") == "Olivia"))
    results.append(("two docs total, one per author", len(fake_db.partner_mood_logs.docs) == 2))

    failed = [name for name, ok in results if not ok]
    for name, ok in results:
        print(("PASS" if ok else "FAIL"), "-", name)
    print(f"\n{len(results) - len(failed)}/{len(results)} passed")
    sys.exit(1 if failed else 0)


asyncio.run(main())
