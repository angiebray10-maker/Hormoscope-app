"""Standalone verification for v49 journal sharing (Angelita, Oct 26, 2026).

Her journal is shared with her linked in-app partner ONLY when she
turns the Journal choice on (partner_visibility.share_journal). The
default is off for everyone: no stored preference, an explicit off,
and turning it back off all mean the partner journal endpoint refuses
and no partner payload (status, sync, calendar, either view link)
carries journal entries, journal text, or journal keys. Entries she
marked intimate are never served to a partner even with sharing on.
View links never carry journal entries, whatever she chooses.

Runs server.py against in-memory fake collections. No network, no
real Mongo.
"""
import os, sys, asyncio, json
from datetime import datetime, timezone, timedelta

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("JWT_SECRET", "test-secret-for-local-verification")
os.environ.setdefault("ANTHROPIC_API_KEY", "test-key-not-real")

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import server
from fastapi import HTTPException


# ---------------- Fake Mongo (same harness as test_v46_features) ----------------

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
        self.vault_entries = FakeCollection()


SENTINELS = ["SHAREDWORDSONE", "SHAREDWORDSTWO", "INTIMATESECRETWORDS",
             "PARTNEROWNWORDS", "SECRETINTIMACY", "SECRETVAULT"]
FORBIDDEN_KEYS = ("journal", "vault", "intimacy")


def scan_clean(obj, label, results, sentinels=SENTINELS):
    blob = json.dumps(obj, default=str)
    results.append((f"{label}: no sentinel content",
                    not any(s in blob for s in sentinels)))

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


def mk_user(uid, name, **kw):
    u = {"id": uid, "email": f"{uid}@example.com", "name": name,
         "hashed_password": "x", "onboarding_complete": True,
         "last_period_date": "2026-10-12", "cycle_length": 28,
         "cycle_status": "regular"}
    u.update(kw)
    return u


async def call(fn, *args):
    try:
        return ("ok", await fn(*args))
    except HTTPException as e:
        return (e.status_code, e.detail)


def seed(db, owner_kw=None):
    owner = mk_user("u-owner", "Olivia", **(owner_kw or {}))
    partner = mk_user("u-partner", "Pam")
    db.users.docs += [dict(owner), dict(partner)]
    db.partner_relationships.docs.append(
        {"id": "rel-1", "user_id": "u-owner", "partner_user_id": "u-partner",
         "active": True, "created_at": "2026-10-01T00:00:00+00:00"})
    now = datetime.now(timezone.utc)
    older = now - timedelta(days=2)
    iso = "%Y-%m-%dT%H:%M:%S+00:00"
    db.journal_entries.docs += [
        {"id": "j-old", "user_id": "u-owner", "title": "Two days ago",
         "content": "SHAREDWORDSONE", "is_intimate": False,
         "created_at": older.strftime(iso)},
        {"id": "j-today", "user_id": "u-owner", "title": "Today page",
         "content": "SHAREDWORDSTWO", "is_intimate": False,
         "created_at": now.strftime(iso)},
        {"id": "j-int", "user_id": "u-owner", "title": "Eyes only",
         "content": "INTIMATESECRETWORDS", "is_intimate": True,
         "created_at": now.strftime(iso)},
        {"id": "j-partner", "user_id": "u-partner", "title": "Hers",
         "content": "PARTNEROWNWORDS", "is_intimate": False,
         "created_at": now.strftime(iso)},
    ]
    db.intimacy_logs.docs.append({"id": "i1", "user_id": "u-owner", "content": "SECRETINTIMACY"})
    db.vault_entries.docs.append({"id": "v1", "user_id": "u-owner", "content": "SECRETVAULT"})
    db.partner_invites.docs.append(
        {"id": "inv-v", "inviter_id": "u-owner", "kind": "view",
         "status": "accepted", "view_token": "tok-view-1"})
    db.partner_links.docs.append(
        {"id": "lnk-1", "user_id": "u-owner", "link_code": "LEGACY1", "active": True})
    return owner, partner


async def section_default_off(results):
    db = FakeDB()
    server.db = db
    owner, partner = seed(db)  # no partner_visibility stored at all

    code, _ = await call(server.get_partner_journal, dict(partner))
    results.append(("default off: partner journal refused (403)", code == 403))

    code, res = await call(server.get_partner_status, dict(partner))
    results.append(("default off: status ok", code == "ok"))
    results.append(("default off: status has no shares flag",
                    not has_key_deep(res, "partner_shares_journal")))
    scan_clean(res, "default off status", results)

    code, res = await call(server.get_partner_sync, dict(partner))
    results.append(("default off: sync ok", code == "ok"))
    scan_clean(res, "default off sync", results)

    code, res = await call(server.get_partner_calendar, dict(partner))
    results.append(("default off: calendar ok", code == "ok"))
    scan_clean(res, "default off calendar", results)

    payload = await server._partner_view_payload("tok-view-1")
    results.append(("default off: view payload exists", payload is not None))
    scan_clean(payload, "default off view payload", results)
    page = server._render_partner_view_html(payload)
    scan_clean(page, "default off view page", results)

    code, res = await call(server.get_partner_view, "LEGACY1")
    results.append(("default off: legacy view ok", code == "ok"))
    results.append(("default off: legacy view does not echo share_journal",
                    not has_key_deep(res, "share_journal")))
    scan_clean(res, "default off legacy view", results)


async def section_on_then_off(results):
    db = FakeDB()
    server.db = db
    vis_on = {"phase": True, "mood_energy": True, "period_dates": True,
              "fertile_window": False, "wishlist": True, "share_journal": True}
    owner, partner = seed(db, owner_kw={"partner_visibility": dict(vis_on)})

    code, res = await call(server.get_partner_status, dict(partner))
    results.append(("on: status flags journal shared",
                    code == "ok" and res.get("partner_shares_journal") is True))

    code, res = await call(server.get_partner_journal, dict(partner))
    results.append(("on: partner journal returns ok", code == "ok"))
    days = res.get("days") or []
    results.append(("on: days newest first",
                    len(days) == 2 and days[0]["date"] > days[1]["date"]))
    blob = json.dumps(res, default=str)
    results.append(("on: shared entries served",
                    "SHAREDWORDSONE" in blob and "SHAREDWORDSTWO" in blob))
    results.append(("on: intimate entry never served",
                    "INTIMATESECRETWORDS" not in blob and "Eyes only" not in blob))
    results.append(("on: partner's own entries not served back",
                    "PARTNEROWNWORDS" not in blob))
    results.append(("on: no intimacy or vault content",
                    "SECRETINTIMACY" not in blob and "SECRETVAULT" not in blob))

    # View links stay clean even while sharing is on.
    payload = await server._partner_view_payload("tok-view-1")
    scan_clean(payload, "on view payload", results)
    page = server._render_partner_view_html(payload)
    scan_clean(page, "on view page", results)
    code, res = await call(server.get_partner_view, "LEGACY1")
    results.append(("on: legacy view does not echo share_journal",
                    code == "ok" and not has_key_deep(res, "share_journal")))
    scan_clean(res, "on legacy view", results)

    # Turn it back off through the profile mechanism she actually uses.
    owner_now = await db.users.find_one({"id": "u-owner"})
    code, res = await call(server.update_profile,
                           server.ProfileUpdate(partner_visibility={"share_journal": False}),
                           dict(owner_now))
    results.append(("off again: profile update ok", code == "ok"))
    stored = (await db.users.find_one({"id": "u-owner"})).get("partner_visibility") or {}
    results.append(("off again: stored flag is False", stored.get("share_journal") is False))
    results.append(("off again: other toggles preserved",
                    stored.get("phase") is True and stored.get("mood_energy") is True))

    code, _ = await call(server.get_partner_journal, dict(partner))
    results.append(("off again: partner journal refused (403)", code == 403))
    code, res = await call(server.get_partner_status, dict(partner))
    results.append(("off again: status flag absent",
                    code == "ok" and not has_key_deep(res, "partner_shares_journal")))
    scan_clean(res, "off again status", results)
    code, res = await call(server.get_partner_sync, dict(partner))
    scan_clean(res, "off again sync", results)


async def section_onboarding(results):
    db = FakeDB()
    server.db = db
    u = mk_user("u-new", "Nia", onboarding_complete=False)
    db.users.docs.append(dict(u))

    # She ticks the Journal choice during onboarding.
    data = server.UserOnboarding(
        name="Nia", cycle_length=28, last_period_date=None,
        cycle_status="regular",
        partner_visibility={"share_journal": True})
    code, res = await call(server.complete_onboarding, data, dict(u))
    results.append(("onboarding with journal ticked ok", code == "ok"))
    stored = (await db.users.find_one({"id": "u-new"})).get("partner_visibility") or {}
    results.append(("onboarding stored share_journal True",
                    stored.get("share_journal") is True))

    # She does not tick it: default off.
    u2 = mk_user("u-new2", "Noor", onboarding_complete=False)
    db.users.docs.append(dict(u2))
    data2 = server.UserOnboarding(
        name="Noor", cycle_length=28, last_period_date=None,
        cycle_status="regular")
    code, res = await call(server.complete_onboarding, data2, dict(u2))
    results.append(("onboarding without the tick ok", code == "ok"))
    stored2 = (await db.users.find_one({"id": "u-new2"})).get("partner_visibility") or {}
    results.append(("onboarding default share_journal False",
                    stored2.get("share_journal") is False))
    resp_vis = res.get("partner_visibility") if isinstance(res, dict) \
        else getattr(res, "partner_visibility", None)
    results.append(("user response default share_journal False",
                    (resp_vis or {}).get("share_journal") is False))


async def main():
    results = []
    await section_default_off(results)
    await section_on_then_off(results)
    await section_onboarding(results)
    failed = [name for name, ok in results if not ok]
    for name, ok in results:
        print(("PASS " if ok else "FAIL ") + name)
    print(f"\n{len(results) - len(failed)}/{len(results)} passed")
    if failed:
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
