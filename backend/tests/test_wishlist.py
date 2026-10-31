"""Standalone verification for the Attuned Gifts wishlist / boutique
endpoints (GET/POST/DELETE /wishlist, GET /partner/wishlist) and the
boutique_visibility profile field.

Runs server.py with in-memory fake collections for partner_relationships,
users, and wishlist_items. No network, no real Mongo.
"""
import os, sys, asyncio

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

    async def update_one(self, filt, update):
        u = self.users.get(filt.get("id"))
        if u is None:
            return FakeResult(0)
        u.update(update.get("$set", {}))
        return FakeResult(1)


class FakeCursor:
    def __init__(self, docs):
        self.docs = docs

    def sort(self, *a, **k):
        return self

    async def to_list(self, length=None):
        return [dict(d) for d in self.docs]


class FakeWishlistCollection:
    def __init__(self):
        self.docs = []

    def find(self, filt, projection=None):
        return FakeCursor([d for d in self.docs if _matches(d, filt)])

    async def find_one(self, filt, projection=None):
        for d in self.docs:
            if _matches(d, filt):
                return dict(d)
        return None

    async def insert_one(self, doc):
        self.docs.append(dict(doc))
        return FakeResult()

    async def delete_many(self, filt):
        before = len(self.docs)
        self.docs = [d for d in self.docs if not _matches(d, filt)]
        return FakeResult(before - len(self.docs))


class FakeEmptyCollection:
    async def find_one(self, filt, projection=None):
        return None


OWNER_PHOTO = "data:image/png;base64,OWNERPHOTO"
OWNER = {"id": "u-owner", "email": "owner@example.com", "name": "Olivia",
         "profile_photo": OWNER_PHOTO}
PARTNER = {"id": "u-partner", "email": "partner@example.com", "name": "Pat"}
STRANGER = {"id": "u-stranger", "email": "solo@example.com", "name": "Solo"}

REL = {"id": "rel-1", "user_id": "u-owner", "partner_user_id": "u-partner", "active": True}
USERS = {
    "u-owner": dict(OWNER),
    "u-partner": dict(PARTNER),
}


class FakeDB:
    def __init__(self, rel, users):
        self.partner_relationships = FakeRelCollection(rel)
        self.users = FakeUsersCollection(users)
        self.wishlist_items = FakeWishlistCollection()
        self._empty = FakeEmptyCollection()

    def __getattr__(self, name):
        return self._empty


fake_db = FakeDB(REL, USERS)
server.db = fake_db

TEA = "B0FHBXCCLM"        # Dona Tea Library, Comfort Collection
PADS = "B07NLSLP9K"       # Always Radiant, Comfort Collection
BRACELET = "B0CNC67C8B"   # Diamond tennis bracelet, Romance Collection


async def add(user, pid):
    try:
        res = await server.add_wishlist_item(server.WishlistAdd(product_id=pid), user)
        return ("ok", res)
    except HTTPException as e:
        return (e.status_code, e.detail)


async def mine(user):
    try:
        res = await server.get_wishlist(user)
        return ("ok", res)
    except HTTPException as e:
        return (e.status_code, e.detail)


async def remove(user, pid):
    try:
        res = await server.remove_wishlist_item(pid, user)
        return ("ok", res)
    except HTTPException as e:
        return (e.status_code, e.detail)


async def partner_view(user):
    try:
        res = await server.get_partner_wishlist(user)
        return ("ok", res)
    except HTTPException as e:
        return (e.status_code, e.detail)


async def set_boutique(user, value):
    try:
        res = await server.update_profile(server.ProfileUpdate(boutique_visibility=value), user)
        return ("ok", res)
    except HTTPException as e:
        return (e.status_code, e.detail)


async def main():
    results = []

    # 1. Add a catalog item: doc shape is clean.
    code, res = await add(OWNER, TEA)
    results.append(("add ok", code == "ok"))
    results.append(("add returns product_id", res.get("product_id") == TEA))
    results.append(("add returns user_id", res.get("user_id") == "u-owner"))
    results.append(("add has created_at", bool(res.get("created_at"))))
    results.append(("no _id in returned doc", "_id" not in res))

    # 2. Unknown ASIN is refused and stores nothing.
    code, _ = await add(OWNER, "B0H4S1M9F2")
    results.append(("unidentified pick ASIN refused 400", code == 400))
    code, _ = await add(OWNER, "NOTANASIN")
    results.append(("garbage ASIN refused 400", code == 400))
    results.append(("still one doc after refusals", len(fake_db.wishlist_items.docs) == 1))

    # 3. Duplicate add is idempotent.
    code, res2 = await add(OWNER, TEA)
    results.append(("duplicate add ok", code == "ok"))
    results.append(("duplicate add returns same doc", res2.get("id") == res.get("id")))
    results.append(("still one doc after duplicate", len(fake_db.wishlist_items.docs) == 1))

    # 4. List mine; the partner's own list is separate and empty.
    code, res = await mine(OWNER)
    results.append(("owner list ok", code == "ok"))
    results.append(("owner list has the tea", [i["product_id"] for i in res["items"]] == [TEA]))
    code, res = await mine(PARTNER)
    results.append(("partner own list empty", code == "ok" and res["items"] == []))

    # 5. A second pick, then remove one.
    await add(OWNER, PADS)
    code, res = await mine(OWNER)
    results.append(("two picks listed in order", [i["product_id"] for i in res["items"]] == [TEA, PADS]))
    code, res = await remove(OWNER, TEA)
    results.append(("remove ok with removed 1", code == "ok" and res.get("removed") == 1))
    code, res = await mine(OWNER)
    results.append(("list after remove has only pads", [i["product_id"] for i in res["items"]] == [PADS]))
    code, res = await remove(OWNER, TEA)
    results.append(("removing again is a no-op, not an error", code == "ok" and res.get("removed") == 0))

    # 6. Partner view while the boutique is private (the default).
    # Rule change (Angelita, Oct 26, 2026): the wishlist is ALWAYS part
    # of the partner experience, so a linked partner sees it even when
    # the stored boutique visibility still says private. Strangers are
    # still blocked.
    code, _ = await partner_view(PARTNER)
    results.append(("partner allowed while private (wishlist always on)", code == "ok"))
    code, _ = await partner_view(STRANGER)
    results.append(("unlinked user blocked 403", code == 403))

    # 7. boutique_visibility through the profile mechanism; bad value 400.
    code, res = await set_boutique(dict(USERS["u-owner"]), "everyone")
    results.append(("invalid boutique_visibility refused 400", code == 400))
    code, res = await set_boutique(dict(USERS["u-owner"]), "partner")
    results.append(("profile PUT sets partner sharing", code == "ok" and res.boutique_visibility == "partner"))
    results.append(("stored on the user record", USERS["u-owner"].get("boutique_visibility") == "partner"))

    # 8. Shared boutique but the wishlist toggle off: the old toggle
    # gate is gone too (same Oct 26, 2026 rule). Her control is the
    # contents of the list, not a switch.
    USERS["u-owner"]["partner_visibility"] = {"wishlist": False}
    code, res = await partner_view(PARTNER)
    results.append(("partner allowed when share_wishlist off (gate removed)", code == "ok" and [i["product_id"] for i in res["items"]] == [PADS]))

    # 9. Both gates on: partner sees the picks, with name and photo.
    USERS["u-owner"]["partner_visibility"] = {"wishlist": True}
    code, res = await partner_view(PARTNER)
    results.append(("partner allowed when both on", code == "ok"))
    results.append(("partner view has her picks", [i["product_id"] for i in res["items"]] == [PADS]))
    results.append(("partner view carries her name", res.get("partner_name") == "Olivia"))
    results.append(("partner view carries her photo", res.get("partner_photo") == OWNER_PHOTO))
    results.append(("partner view carries visibility", res.get("boutique_visibility") == "partner"))

    # 10. Public also permits the partner view.
    code, res = await set_boutique(dict(USERS["u-owner"]), "public")
    results.append(("profile PUT sets public", code == "ok" and res.boutique_visibility == "public"))
    code, res = await partner_view(PARTNER)
    results.append(("partner allowed when public", code == "ok"))

    # 11. Every catalog ASIN from the shipped list is accepted.
    accepted = 0
    for pid in sorted(server.CATALOG_PRODUCT_IDS):
        c, _ = await add(PARTNER, pid)
        if c == "ok":
            accepted += 1
    # v50: the catalog grew from 27 to 30 (three newly identified
    # picks added Oct 27, 2026); the shipped-size literal follows it.
    # v56: 30 to 33 (three picks she sent Oct 30, 2026).
    # v57 data completion (Oct 31, 2026): 33 to 95 (the rest of
    # the Oct 30 to 31 batch with verified name, price and
    # picture, plus the 22 v57 ASINs that were already in
    # CATALOG_PRODUCTS but missing from the ID set).
    results.append(("all server catalog ASINs accepted", accepted == len(server.CATALOG_PRODUCT_IDS) == 95))

    failed = [name for name, ok in results if not ok]
    for name, ok in results:
        print(("PASS" if ok else "FAIL"), "-", name)
    print(f"\n{len(results) - len(failed)}/{len(results)} passed")
    sys.exit(1 if failed else 0)


asyncio.run(main())
