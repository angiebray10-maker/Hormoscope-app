"""Standalone verification for the v46 features (Angelita, Oct 26, 2026):

Feature B: the "I no longer have periods" path. Profile flag round
trip, /partner/sync log-based days for a no_periods owner (28 days, no
cycle_day / phase keys), visibility gating of those days, a privacy
scan, and a cycling owner unchanged.

Feature A (owner-branched invites, Refinements 2 and 3): sync invites
are codes, view invites carry an unguessable token for the read-only
partner link page; a view code can never link accounts; the token
payload holds exactly what her visibility choices allow; revoked and
regenerated tokens go inactive; the wishlist is present for partners
and link viewers even with the old share toggle off and the boutique
private (Refinement 4); an account with no cycle data at all can
accept a sync invite and read the owner's days (the non-tracking
viewer path).

Runs server.py against in-memory fake collections. No network, no
real Mongo.
"""
import os, sys, asyncio, json
from datetime import date, datetime, timezone, timedelta

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("JWT_SECRET", "test-secret-for-local-verification")
os.environ.setdefault("ANTHROPIC_API_KEY", "test-key-not-real")

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import server
from fastapi import HTTPException


# ---------------- Fake Mongo ----------------

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
        self.cycle_logs = FakeCollection()
        self.wishlist_items = FakeCollection()
        # Sentinel collections: private data that must NEVER leak into
        # any partner payload or page.
        self.journal_entries = FakeCollection()
        self.intimacy_logs = FakeCollection()
        self.vault_entries = FakeCollection()


SENTINELS = ["SECRETJOURNAL", "SECRETINTIMACY", "SECRETVAULT", "SECRETNOTE"]
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


def mk_user(uid, name, **kw):
    u = {"id": uid, "email": f"{uid}@example.com", "name": name,
         "hashed_password": "x", "onboarding_complete": True}
    u.update(kw)
    return u


async def call(fn, *args):
    try:
        return ("ok", await fn(*args))
    except HTTPException as e:
        return (e.status_code, e.detail)


# ---------------- Feature B: flag round trip ----------------

async def section_flag(results):
    db = FakeDB()
    server.db = db
    u = mk_user("u-np", "Nadia", onboarding_complete=False, birthday="1980-04-02")
    db.users.docs.append(dict(u))
    # She picks "I no longer have periods" and even sends a stale date:
    # onboarding must store the flag and wipe the date.
    data = server.UserOnboarding(
        name="Nadia", birthday="1980-04-02", cycle_length=28,
        last_period_date="2026-09-01", cycle_status="no_periods",
        no_periods=True)
    code, _ = await call(server.complete_onboarding, data, dict(u))
    results.append(("onboarding accepts no_periods", code == "ok"))
    stored = db.users.docs[0]
    results.append(("flag stored true", stored.get("no_periods") is True))
    results.append(("period date wiped", stored.get("last_period_date") is None))
    results.append(("no initial period logs written", len(db.cycle_logs.docs) == 0))
    resp = server.build_user_response(stored)
    results.append(("auth/profile response carries the flag", resp.no_periods is True))

    # Profile PUT flips it off (with her situation back to regular, the
    # way the app would send it) and on again: the round trip.
    code, resp = await call(server.update_profile,
                            server.ProfileUpdate(no_periods=False, cycle_status="regular"),
                            dict(stored))
    results.append(("profile PUT flag off", code == "ok" and resp.no_periods is False
                    and db.users.docs[0].get("no_periods") is False))
    code, resp = await call(server.update_profile,
                            server.ProfileUpdate(no_periods=True), dict(db.users.docs[0]))
    results.append(("profile PUT flag on clears date",
                    code == "ok" and resp.no_periods is True
                    and db.users.docs[0].get("last_period_date") is None))


# ---------------- Feature B: sync log days ----------------

async def section_sync(results):
    db = FakeDB()
    server.db = db
    today = date.today()
    utc_today = datetime.now(timezone.utc).date()
    owner = mk_user("u-owner", "Olivia", cycle_status="no_periods", no_periods=True,
                    profile_photo="data:image/jpeg;base64,OWNERPHOTO",
                    partner_visibility={"phase": True, "mood_energy": True,
                                        "period_dates": True, "fertile_window": False,
                                        "wishlist": True,
                                        # v58: her log data reaches a partner only
                                        # with share_daily_log on.
                                        "share_daily_log": True})
    partner = mk_user("u-partner", "Pam")
    db.users.docs += [dict(owner), dict(partner)]
    db.partner_relationships.docs.append(
        {"id": "rel-1", "user_id": "u-owner", "partner_user_id": "u-partner",
         "active": True, "created_at": "2026-10-01T00:00:00+00:00"})
    db.cycle_logs.docs += [
        {"id": "l1", "user_id": "u-owner", "date": today.isoformat(),
         "symptoms": ["emotion:happy", "mood:5", "collection:cup", "Cramps"],
         "flow": None, "is_period": False, "notes": "SECRETNOTE private words"},
        {"id": "l2", "user_id": "u-owner", "date": (today - timedelta(days=3)).isoformat(),
         "symptoms": ["emotion:tired"], "flow": "light", "is_period": True,
         "notes": "SECRETNOTE again"},
    ]
    db.journal_entries.docs.append({"id": "j1", "user_id": "u-owner", "content": "SECRETJOURNAL"})
    db.intimacy_logs.docs.append({"id": "i1", "user_id": "u-owner", "content": "SECRETINTIMACY"})
    db.vault_entries.docs.append({"id": "v1", "user_id": "u-owner", "content": "SECRETVAULT"})

    code, res = await call(server.get_partner_sync, dict(partner))
    results.append(("sync ok for partner of no_periods owner", code == "ok"))
    them = res["them"]
    results.append(("owner block flagged no_periods", them.get("no_periods") is True))
    results.append(("owner block not tracking a cycle", them.get("tracking") is False))
    log_days = them.get("log_days") or []
    results.append(("28 log days returned", len(log_days) == 28))
    results.append(("log days newest first", log_days and log_days[0]["date"] == today.isoformat()))
    results.append(("no cycle_day key in any log day",
                    not any("cycle_day" in d for d in log_days)))
    results.append(("no phase key in any log day",
                    not any("phase" in d for d in log_days)))
    results.append(("owner block has no cycle_day/phase",
                    "cycle_day" not in them and "phase" not in them))
    today_entry = log_days[0]
    results.append(("today shows feelings from emotion tags",
                    today_entry.get("feelings") == ["Happy"]))
    results.append(("today shows mood word", today_entry.get("mood") == "Great"))
    results.append(("today shows plain symptoms only",
                    today_entry.get("symptoms") == ["Cramps"]))
    older = [d for d in log_days if d["date"] == (today - timedelta(days=3)).isoformat()][0]
    results.append(("older day carries flow and period flag",
                    older.get("flow") == "light" and older.get("is_period") is True))
    results.append(("unlogged day is bare", any(
        d.get("logged") is False and "feelings" not in d for d in log_days)))
    results.append(("cycle strip stays empty for log-based sides", res["days"] == []))
    scan_clean(res, "sync payload", results)

    # Mood/energy off AND phase off: her side goes private entirely.
    db.users.docs[0]["partner_visibility"] = {
        "phase": False, "mood_energy": False, "period_dates": True,
        "fertile_window": False, "wishlist": True}
    code, res = await call(server.get_partner_sync, dict(partner))
    results.append(("both toggles off: side not shared", res["them"].get("shared") is False))
    results.append(("both toggles off: no log_days attached", "log_days" not in res["them"]))

    # Phase on, mood off: days show, feelings do not. (v58: share_daily_log
    # stays on so the days themselves are shared; mood_energy off is what
    # strips the feelings detail.)
    db.users.docs[0]["partner_visibility"] = {
        "phase": True, "mood_energy": False, "period_dates": True,
        "fertile_window": False, "wishlist": True, "share_daily_log": True}
    code, res = await call(server.get_partner_sync, dict(partner))
    ld = res["them"].get("log_days") or []
    results.append(("mood off: log days still returned", len(ld) == 28))
    results.append(("mood off: no feelings detail anywhere",
                    not has_key_deep(ld, "feelings") and not has_key_deep(ld, "mood")))


# ---------------- Cycling owner unchanged ----------------

async def section_cycling(results):
    db = FakeDB()
    server.db = db
    lp = (date.today() - timedelta(days=10)).isoformat()
    owner = mk_user("u-cyc", "Cara", last_period_date=lp, cycle_length=28,
                    cycle_status="regular",
                    partner_visibility={"phase": True, "mood_energy": True,
                                        "period_dates": True, "fertile_window": True,
                                        "wishlist": True})
    partner = mk_user("u-pal", "Paz")
    db.users.docs += [dict(owner), dict(partner)]
    db.partner_relationships.docs.append(
        {"id": "rel-2", "user_id": "u-cyc", "partner_user_id": "u-pal",
         "active": True, "created_at": "2026-10-01T00:00:00+00:00"})
    code, res = await call(server.get_partner_sync, dict(partner))
    them = res["them"]
    results.append(("cycling owner still tracking", them.get("tracking") is True))
    results.append(("cycling owner has cycle_day and phase",
                    them.get("cycle_day") == 11 and bool(them.get("phase"))))
    results.append(("cycling owner has no log_days", "log_days" not in them))
    results.append(("cycling strip still 28 days", len(res["days"]) == 28))
    results.append(("strip entries keep cycle fields",
                    res["days"][0]["them"]["cycle_day"] == 11))


# ---------------- Invites: sync code + non-tracking accept ----------------

async def section_sync_invite(results):
    db = FakeDB()
    server.db = db
    lp = (date.today() - timedelta(days=5)).isoformat()
    owner = mk_user("u-own2", "Oona", last_period_date=lp, cycle_length=28,
                    cycle_status="regular")
    # A brand-new account: no cycle fields at all.
    guest = mk_user("u-guest", "Gus", onboarding_complete=False)
    db.users.docs += [dict(owner), dict(guest)]

    code, res = await call(server.create_partner_invite,
                           server.PartnerInviteRequest(partner_type="woman", kind="sync"),
                           dict(owner))
    results.append(("sync invite returns a code", code == "ok" and bool(res.get("invite_code"))))
    results.append(("sync invite kind recorded", res.get("kind") == "sync"))
    results.append(("sync invite has no view token", res.get("view_token") is None))
    invite_code = res["invite_code"]

    code, res = await call(server.accept_partner_invite,
                           server.AcceptInviteRequest(invite_code=invite_code),
                           dict(guest))
    results.append(("no-cycle account can accept", code == "ok" and res.get("ok") is True))
    results.append(("accept names the owner", res.get("linked_to") == "Oona"))
    code, res = await call(server.get_partner_status, dict(guest))
    results.append(("status shows linked for the guest",
                    code == "ok" and res.get("is_linked") is True
                    and res.get("role") == "partner"))
    code, res = await call(server.get_partner_sync, dict(guest))
    results.append(("guest sync returns the owner's 28 days",
                    code == "ok" and len(res["days"]) == 28
                    and res["days"][0]["them"]["cycle_day"] == 6))
    results.append(("guest's own side is not tracking",
                    res["me"].get("tracking") is False))
    scan_clean(res, "guest sync payload", results)


# ---------------- Invites: view token page ----------------

async def section_view(results):
    db = FakeDB()
    server.db = db
    today = date.today()
    lp = (today - timedelta(days=10)).isoformat()
    # v58: all_on also turns on the two new sharing choices, so log-derived
    # payload fields (feeling today, log days) and note text are served.
    all_on = {"phase": True, "mood_energy": True, "period_dates": True,
              "fertile_window": True, "wishlist": True,
              "share_daily_log": True, "include_note": True}
    owner = mk_user("u-view", "Vera", last_period_date=lp, cycle_length=28,
                    cycle_status="regular", profile_photo="data:image/jpeg;base64,VERAPHOTO",
                    partner_visibility=dict(all_on), boutique_visibility="private")
    db.users.docs.append(dict(owner))
    db.cycle_logs.docs.append(
        {"id": "m1", "user_id": "u-view",
         "date": datetime.now(timezone.utc).date().isoformat(),
         "symptoms": ["mood:3"], "flow": None, "is_period": False})
    db.wishlist_items.docs.append(
        {"id": "w1", "user_id": "u-view", "product_id": "B0FHBXCCLM",
         "created_at": "2026-10-20T00:00:00+00:00"})
    db.journal_entries.docs.append({"id": "j9", "user_id": "u-view", "content": "SECRETJOURNAL"})
    db.intimacy_logs.docs.append({"id": "i9", "user_id": "u-view", "content": "SECRETINTIMACY"})
    db.vault_entries.docs.append({"id": "v9", "user_id": "u-view", "content": "SECRETVAULT"})

    # Defaulting: a man's invite with no explicit kind is a view invite.
    code, res = await call(server.create_partner_invite,
                           server.PartnerInviteRequest(partner_type="man"), dict(owner))
    token = res.get("view_token")
    results.append(("man invite defaults to view kind with token",
                    code == "ok" and res.get("kind") == "view" and bool(token)))

    # A view code can never link accounts.
    code2, _ = await call(server.accept_partner_invite,
                          server.AcceptInviteRequest(invite_code=res["invite_code"]),
                          mk_user("u-hopeful", "Hal"))
    results.append(("view code refused at accept (400)", code2 == 400))

    payload = await server._partner_view_payload(token)
    results.append(("payload exists for live token", payload is not None))
    results.append(("payload has phase and cycle day",
                    payload.get("phase") is not None and payload.get("cycle_day") == 11))
    results.append(("payload has next period", bool(payload.get("next_period_date"))))
    results.append(("payload has fertile window", bool(payload.get("fertile_window"))))
    results.append(("payload has feeling today", payload.get("feeling_today") == "Okay"))
    results.append(("wishlist present despite toggle history and private boutique",
                    [w["name"] for w in payload.get("wishlist") or []] == ["Dona Tea Library"]))
    results.append(("wishlist link carries her tag",
                    "tag=hormoscope20-20" in (payload["wishlist"][0]["url"])))
    scan_clean(payload, "view payload all-on", results)
    page = server._render_partner_view_html(payload)
    results.append(("page renders phase", "phase" in page.lower()))
    scan_clean(page, "view page all-on", results)

    # Old wishlist toggle OFF in stored data: still present (Refinement 4).
    db.users.docs[0]["partner_visibility"] = {**all_on, "wishlist": False}
    payload = await server._partner_view_payload(token)
    results.append(("wishlist present with old toggle off",
                    len(payload.get("wishlist") or []) == 1))

    # Everything off: only identity and the always-on wishlist remain.
    db.users.docs[0]["partner_visibility"] = {
        "phase": False, "mood_energy": False, "period_dates": False,
        "fertile_window": False, "wishlist": False}
    payload = await server._partner_view_payload(token)
    keys = set(payload.keys())
    results.append(("all-off payload holds only name, photo, wishlist",
                    keys <= {"owner_name", "owner_photo", "wishlist"}))
    results.append(("all-off wishlist still there and non-empty",
                    len(payload.get("wishlist") or []) == 1))
    page = server._render_partner_view_html(payload)
    results.append(("all-off page hides phase", "in her cycle" not in page))
    results.append(("all-off page hides next period", "next period is estimated" not in page))
    results.append(("all-off page hides feeling", "feeling today" not in page.lower()))
    scan_clean(page, "view page all-off", results)

    # Revoke kills the token.
    code, res = await call(server.revoke_view_link, dict(owner))
    results.append(("revoke reports the removal", code == "ok" and res.get("removed") == 1))
    payload = await server._partner_view_payload(token)
    results.append(("revoked token payload is None", payload is None))
    page = server._render_partner_view_html(payload)
    results.append(("revoked token page reads inactive", "no longer active" in page))

    # Regenerating replaces the token: old dead, new live.
    db.users.docs[0]["partner_visibility"] = dict(all_on)
    code, res = await call(server.create_partner_invite,
                           server.PartnerInviteRequest(partner_type="woman", kind="view"),
                           dict(owner))
    token2 = res.get("view_token")
    results.append(("regenerated invite has a fresh token",
                    bool(token2) and token2 != token))
    results.append(("old token stays dead after regeneration",
                    await server._partner_view_payload(token) is None))
    results.append(("new token is live",
                    await server._partner_view_payload(token2) is not None))
    results.append(("unknown token is inactive",
                    await server._partner_view_payload("nope-not-a-token") is None))

    # A no_periods owner's link shows logged days, never cycle fields.
    db2_owner = mk_user("u-npv", "Nia", cycle_status="no_periods", no_periods=True,
                        partner_visibility=dict(all_on))
    db.users.docs.append(dict(db2_owner))
    db.cycle_logs.docs.append(
        {"id": "n1", "user_id": "u-npv", "date": today.isoformat(),
         "symptoms": ["emotion:calm", "mood:4"], "flow": None, "is_period": False})
    code, res = await call(server.create_partner_invite,
                           server.PartnerInviteRequest(partner_type="man", kind="view"),
                           dict(db2_owner))
    payload = await server._partner_view_payload(res["view_token"])
    results.append(("no_periods view payload has log days",
                    len(payload.get("log_days") or []) == 28))
    results.append(("no_periods view payload has no cycle fields",
                    "phase" not in payload and "cycle_day" not in payload
                    and "next_period_date" not in payload))
    results.append(("no_periods view payload has feeling today",
                    payload.get("feeling_today") == "Good"))
    results.append(("no_periods view wishlist is an empty list, cleanly",
                    payload.get("wishlist") == []))
    scan_clean(payload, "no_periods view payload", results)


async def main():
    results = []
    await section_flag(results)
    await section_sync(results)
    await section_cycling(results)
    await section_sync_invite(results)
    await section_view(results)
    failed = [n for n, ok in results if not ok]
    for n, ok in results:
        print(("PASS" if ok else "FAIL"), "-", n)
    print(f"\n{len(results) - len(failed)}/{len(results)} passed")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    asyncio.run(main())
