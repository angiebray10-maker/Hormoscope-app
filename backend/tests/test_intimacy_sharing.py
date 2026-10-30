"""Standalone verification for v54 intimacy sharing (Angelita, Oct 30, 2026).

She REVERSED the old "intimacy log is never shared" rule: her intimacy
LOG is shared with her linked in-app partner ONLY when she turns the
Intimacy choice on (partner_visibility.share_intimacy). The default
is off for everyone: no stored preference, an explicit off, and
turning it back off all mean the partner intimacy endpoint refuses
and no partner payload (status, sync, calendar, either view link)
carries intimacy dates, names, notes, or the share_intimacy key.
View links never carry intimacy data, whatever she chooses. Journal
entries she marked intimate are a separate thing and stay unserved
even while intimacy sharing is on.

Also verifies GET /journal/logged-days (item 20): owner only, dates
only, the union of her journal days and her cycle log days.

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


SENTINELS = ["LOVERNAMESECRET", "INTIMACYNOTESECRET", "INTIMATESECRETWORDS"]


def scan_clean(obj, label, results):
    blob = json.dumps(obj, default=str)
    results.append((f"{label}: no sentinel content",
                    not any(s in blob for s in SENTINELS)))
    results.append((f"{label}: share_intimacy key absent",
                    not has_key_deep(obj, "share_intimacy")))


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
    iso = "%Y-%m-%dT%H:%M:%S+00:00"
    db.intimacy_logs.docs += [
        {"id": "i1", "user_id": "u-owner", "date": "2026-10-20",
         "partners": "LOVERNAMESECRET", "notes": "INTIMACYNOTESECRET",
         "created_at": now.strftime(iso)},
        {"id": "i2", "user_id": "u-owner", "date": "2026-10-25",
         "partners": "", "notes": "",
         "created_at": now.strftime(iso)},
        {"id": "i3", "user_id": "u-partner", "date": "2026-10-21",
         "partners": "PARTNEROWNLOG", "notes": "",
         "created_at": now.strftime(iso)},
    ]
    db.journal_entries.docs.append(
        {"id": "j-int", "user_id": "u-owner", "title": "Eyes only",
         "content": "INTIMATESECRETWORDS", "is_intimate": True,
         "created_at": now.strftime(iso)})
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

    code, _ = await call(server.get_partner_intimacy, dict(partner))
    results.append(("default off: partner intimacy refused (403)", code == 403))

    code, res = await call(server.get_partner_status, dict(partner))
    results.append(("default off: status ok", code == "ok"))
    results.append(("default off: status has no shares flag",
                    not has_key_deep(res, "partner_shares_intimacy")))
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
    results.append(("default off: view page clean",
                    not any(s in page for s in SENTINELS)))

    code, res = await call(server.get_partner_view, "LEGACY1")
    results.append(("default off: legacy view ok", code == "ok"))
    scan_clean(res, "default off legacy view", results)


async def section_on_then_off(results):
    db = FakeDB()
    server.db = db
    vis_on = {"phase": True, "mood_energy": True, "period_dates": True,
              "fertile_window": False, "wishlist": True,
              "share_journal": True, "share_intimacy": True}
    owner, partner = seed(db, owner_kw={"partner_visibility": dict(vis_on)})

    code, res = await call(server.get_partner_status, dict(partner))
    results.append(("on: status flags intimacy shared",
                    code == "ok" and res.get("partner_shares_intimacy") is True))

    code, res = await call(server.get_partner_intimacy, dict(partner))
    results.append(("on: partner intimacy returns ok", code == "ok"))
    days = res.get("days") or []
    results.append(("on: days newest first",
                    len(days) == 2 and days[0]["date"] == "2026-10-25" and days[1]["date"] == "2026-10-20"))
    blob = json.dumps(res, default=str)
    results.append(("on: names and notes served via the gated path",
                    "LOVERNAMESECRET" in blob and "INTIMACYNOTESECRET" in blob))
    results.append(("on: partner's own logs not served back",
                    "PARTNEROWNLOG" not in blob))
    results.append(("on: intimate journal entry never served here",
                    "INTIMATESECRETWORDS" not in blob))

    # The journal endpoint still protects intimate entries while on.
    code, res = await call(server.get_partner_journal, dict(partner))
    jblob = json.dumps(res, default=str)
    results.append(("on: partner journal ok, intimate entry still never served",
                    code == "ok" and "INTIMATESECRETWORDS" not in jblob))

    # View links stay clean even while sharing is on.
    payload = await server._partner_view_payload("tok-view-1")
    scan_clean(payload, "on view payload", results)
    page = server._render_partner_view_html(payload)
    results.append(("on: view page clean",
                    not any(s in page for s in SENTINELS)))
    code, res = await call(server.get_partner_view, "LEGACY1")
    results.append(("on: legacy view ok", code == "ok"))
    scan_clean(res, "on legacy view", results)

    # Turn it back off through the profile mechanism she actually uses.
    owner_now = await db.users.find_one({"id": "u-owner"})
    code, res = await call(server.update_profile,
                           server.ProfileUpdate(partner_visibility={"share_intimacy": False}),
                           dict(owner_now))
    results.append(("off again: profile update ok", code == "ok"))
    stored = (await db.users.find_one({"id": "u-owner"})).get("partner_visibility") or {}
    results.append(("off again: stored flag is False", stored.get("share_intimacy") is False))
    results.append(("off again: other toggles preserved",
                    stored.get("phase") is True and stored.get("share_journal") is True))

    code, _ = await call(server.get_partner_intimacy, dict(partner))
    results.append(("off again: partner intimacy refused (403)", code == 403))
    code, res = await call(server.get_partner_status, dict(partner))
    results.append(("off again: status flag absent",
                    code == "ok" and not has_key_deep(res, "partner_shares_intimacy")))
    scan_clean(res, "off again status", results)


async def section_onboarding(results):
    db = FakeDB()
    server.db = db
    u = mk_user("u-new", "Nia", onboarding_complete=False)
    db.users.docs.append(dict(u))
    data = server.UserOnboarding(
        name="Nia", cycle_length=28, last_period_date=None,
        cycle_status="regular",
        partner_visibility={"share_intimacy": True})
    code, res = await call(server.complete_onboarding, data, dict(u))
    results.append(("onboarding with intimacy ticked ok", code == "ok"))
    stored = (await db.users.find_one({"id": "u-new"})).get("partner_visibility") or {}
    results.append(("onboarding stored share_intimacy True",
                    stored.get("share_intimacy") is True))

    u2 = mk_user("u-new2", "Noor", onboarding_complete=False)
    db.users.docs.append(dict(u2))
    data2 = server.UserOnboarding(
        name="Noor", cycle_length=28, last_period_date=None,
        cycle_status="regular")
    code, res = await call(server.complete_onboarding, data2, dict(u2))
    results.append(("onboarding without the tick ok", code == "ok"))
    stored2 = (await db.users.find_one({"id": "u-new2"})).get("partner_visibility") or {}
    results.append(("onboarding default share_intimacy False",
                    stored2.get("share_intimacy") is False))
    resp_vis = res.get("partner_visibility") if isinstance(res, dict) \
        else getattr(res, "partner_visibility", None)
    results.append(("user response default share_intimacy False",
                    (resp_vis or {}).get("share_intimacy") is False))


async def section_logged_days(results):
    db = FakeDB()
    server.db = db
    owner = mk_user("u-owner", "Olivia")
    other = mk_user("u-other", "Ola")
    db.users.docs += [dict(owner), dict(other)]
    now = datetime.now(timezone.utc)
    older = now - timedelta(days=3)
    iso = "%Y-%m-%dT%H:%M:%S+00:00"
    db.journal_entries.docs += [
        {"id": "j1", "user_id": "u-owner", "title": "SecretTitleWords",
         "content": "SecretContentWords", "is_intimate": False,
         "created_at": older.strftime(iso)},
        {"id": "j2", "user_id": "u-owner", "title": "Today",
         "content": "TodayWords", "is_intimate": False,
         "created_at": now.strftime(iso)},
        {"id": "j3", "user_id": "u-other", "title": "Not hers",
         "content": "OtherWords", "is_intimate": False,
         "created_at": older.strftime(iso)},
    ]
    log_day = (now - timedelta(days=1)).date().isoformat()
    db.cycle_logs.docs += [
        {"id": "c1", "user_id": "u-owner", "date": log_day,
         "symptoms": ["mood:4"], "notes": "SecretNoteWords"},
        {"id": "c2", "user_id": "u-other", "date": "2020-01-01",
         "symptoms": [], "notes": ""},
    ]
    code, res = await call(server.get_journal_logged_days, dict(owner))
    results.append(("logged-days: ok", code == "ok"))
    older_day = older.date().isoformat()
    today_day = now.date().isoformat()
    results.append(("logged-days: journal days are hers only",
                    res.get("journal_days") == sorted([older_day, today_day])))
    results.append(("logged-days: log days are hers only",
                    res.get("log_days") == [log_day]))
    results.append(("logged-days: union correct",
                    res.get("logged_days") == sorted([older_day, today_day, log_day])))
    blob = json.dumps(res, default=str)
    results.append(("logged-days: dates only, no content",
                    not any(s in blob for s in
                            ["SecretTitleWords", "SecretContentWords",
                             "SecretNoteWords", "OtherWords", "TodayWords"])))


async def main():
    results = []
    await section_default_off(results)
    await section_on_then_off(results)
    await section_onboarding(results)
    await section_logged_days(results)
    failed = [name for name, ok in results if not ok]
    for name, ok in results:
        print(("PASS " if ok else "FAIL ") + name)
    print(f"\n{len(results) - len(failed)}/{len(results)} passed")
    if failed:
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
