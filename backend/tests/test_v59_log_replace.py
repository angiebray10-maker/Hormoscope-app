"""Standalone verification for v59 (Angelita, Oct 31, 2026):
replace-on-save for the question UI's cycle logs.

The bug on her phone in v58: the Journal "LOGGED THIS DAY" list
showed a staircase of cumulative duplicate rows for one day
("fatigue" / "fatigue, backache" / "fatigue, backache, tender
breasts", the same Energy entry twice, the same supplements entry
twice), because FloatingCarousel posts ONE new cycle log per
category on every selection change and POST /cycle-logs always
inserted a new row.

The fix, proven here:
(a) saving symptoms twice for one date leaves exactly ONE current
    symptoms log for that date, holding the latest values;
(b) saving mood for the same date does not remove the symptoms
    log, and vice versa;
(c) an emptied-group save ("No symptoms") replaces the previous
    symptoms log;
(d) a period log for the date is never removed by a category save;
(e) GET /journal/day/{date} returns only the latest row per
    category even when multiple rows were inserted directly into
    the DB (legacy staircase data), and deletes nothing.

Category detection mirrors the frontend prefill in
FloatingCarousel.js: mood:/emotion: tags are mood, energy: is
energy, sleep:/sleep_quality: are sleep, craving: is cravings,
collection: is collection, supplements: is supplements, plain
strings (no known prefix) and "No symptoms" notes are symptoms,
and an emptied group is named by its "No ..." note.

Runs server.py against in-memory fake collections. No network, no
real Mongo.
"""
import os, sys, asyncio, json

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

    async def delete_one(self, filt):
        before = len(self.docs)
        for i, d in enumerate(self.docs):
            if _matches(d, filt):
                del self.docs[i]
                break
        return FakeResult(before - len(self.docs))

    async def delete_many(self, filt):
        before = len(self.docs)
        self.docs = [d for d in self.docs if not _matches(d, filt)]
        return FakeResult(before - len(self.docs))


class FakeDB:
    def __init__(self):
        self.users = FakeCollection()
        self.cycle_logs = FakeCollection()
        self.journal_entries = FakeCollection()
        self.intimacy_logs = FakeCollection()
        self.daily_content = FakeCollection()


OWNER = {"id": "u-owner", "email": "owner@example.com", "name": "Olivia"}
OTHER = {"id": "u-other", "email": "other@example.com", "name": "Oona"}
DAY = "2026-10-20"


async def call(fn, *args):
    try:
        return ("ok", await fn(*args))
    except HTTPException as e:
        return (e.status_code, e.detail)


async def save(user, date, symptoms, notes, is_period=False, flow=None):
    return await call(server.create_cycle_log,
                      server.CycleLogCreate(date=date, is_period=is_period,
                                            flow=flow, symptoms=symptoms,
                                            notes=notes),
                      dict(user))


def day_logs(db, user_id=OWNER["id"], date=DAY):
    return [d for d in db.cycle_logs.docs
            if d.get("user_id") == user_id and d.get("date") == date]


def by_category(db, category, user_id=OWNER["id"], date=DAY):
    return [d for d in day_logs(db, user_id, date)
            if server._cycle_log_category(d) == category]


# ---------------- Detection unit checks ----------------

def section_detection(results):
    cases = [
        ("mood tag is mood", {"is_period": False, "symptoms": ["mood:4"], "notes": "Mood 4/5"}, "mood"),
        ("emotion tag is mood", {"is_period": False, "symptoms": ["emotion:happy"], "notes": "Feeling Happy"}, "mood"),
        ("mood plus emotions is still mood", {"is_period": False, "symptoms": ["mood:4", "emotion:calm"], "notes": "Feeling Calm"}, "mood"),
        ("emptied mood note is mood", {"is_period": False, "symptoms": [], "notes": "No mood or feelings"}, "mood"),
        ("energy tag is energy", {"is_period": False, "symptoms": ["energy:2"], "notes": "Energy 2/5"}, "energy"),
        ("sleep tags are sleep", {"is_period": False, "symptoms": ["sleep:7h", "sleep_quality:deep"], "notes": "7h, deep"}, "sleep"),
        ("craving tag is cravings", {"is_period": False, "symptoms": ["craving:chocolate"], "notes": "chocolate"}, "cravings"),
        ("emptied cravings note is cravings", {"is_period": False, "symptoms": [], "notes": "No cravings"}, "cravings"),
        ("collection tag is collection", {"is_period": False, "symptoms": ["collection:Tampon"], "notes": "Collection: Tampon"}, "collection"),
        ("emptied collection note is collection", {"is_period": False, "symptoms": [], "notes": "No collection"}, "collection"),
        ("supplements tag is supplements", {"is_period": False, "symptoms": ["supplements:iron"], "notes": "Supplements: iron"}, "supplements"),
        ("emptied supplements note is supplements", {"is_period": False, "symptoms": [], "notes": "No supplements"}, "supplements"),
        ("plain strings are symptoms", {"is_period": False, "symptoms": ["fatigue", "backache"], "notes": "fatigue, backache"}, "symptoms"),
        ("emptied symptoms note is symptoms", {"is_period": False, "symptoms": [], "notes": "No symptoms"}, "symptoms"),
        ("period log has no category", {"is_period": True, "symptoms": ["cramps"], "notes": "Period started"}, None),
        ("mixed row has no single category", {"is_period": False, "symptoms": ["mood:3", "supplements:Vitamin D"], "notes": "mixed"}, None),
        ("empty row is unclassifiable", {"is_period": False, "symptoms": [], "notes": ""}, None),
        ("empty row with plain note is unclassifiable", {"is_period": False, "symptoms": [], "notes": "just words"}, None),
    ]
    for name, log, want in cases:
        results.append((f"detection: {name}",
                        server._cycle_log_category(log) == want))


# ---------------- (a) same category replaces ----------------

async def section_replace(results):
    db = FakeDB()
    server.db = db

    code, _ = await save(OWNER, DAY, ["fatigue"], "fatigue")
    results.append(("a: first symptoms save ok", code == "ok"))
    code, _ = await save(OWNER, DAY, ["fatigue", "backache"],
                         "fatigue, backache")
    results.append(("a: second symptoms save ok", code == "ok"))
    code, _ = await save(OWNER, DAY, ["fatigue", "backache", "tender breasts"],
                         "fatigue, backache, tender breasts")
    results.append(("a: third symptoms save ok", code == "ok"))

    syms = by_category(db, "symptoms")
    results.append(("a: exactly one current symptoms log for the date",
                    len(syms) == 1))
    results.append(("a: the one log holds the latest symptoms",
                    len(syms) == 1
                    and syms[0].get("symptoms") == ["fatigue", "backache", "tender breasts"]))
    results.append(("a: the one log holds the latest notes",
                    len(syms) == 1
                    and syms[0].get("notes") == "fatigue, backache, tender breasts"))
    results.append(("a: no staircase rows left for the date at all",
                    len(day_logs(db)) == 1))

    # The exact-duplicate half of the bug: the same value saved
    # twice (Energy 2/5 twice) must also collapse to one row.
    await save(OWNER, DAY, ["energy:2"], "Energy 2/5")
    code, res = await save(OWNER, DAY, ["energy:2"], "Energy 2/5")
    results.append(("a: duplicate energy save ok, return shape unchanged",
                    code == "ok" and bool(res.get("id"))
                    and res.get("message") == "Log created successfully"))
    energy = by_category(db, "energy")
    results.append(("a: exact duplicate energy saves leave one energy log",
                    len(energy) == 1 and energy[0].get("symptoms") == ["energy:2"]))


# ---------------- (b) categories do not remove each other ----------------

async def section_cross_category(results):
    db = FakeDB()
    server.db = db

    await save(OWNER, DAY, ["mood:3"], "Mood 3/5")
    await save(OWNER, DAY, ["fatigue"], "fatigue")
    results.append(("b: mood save then symptoms save keeps both",
                    len(by_category(db, "mood")) == 1
                    and len(by_category(db, "symptoms")) == 1))

    await save(OWNER, DAY, ["mood:5", "emotion:happy"],
               "Feeling Happy · Mood 5/5")
    results.append(("b: re-saving mood leaves the symptoms log alone",
                    len(by_category(db, "mood")) == 1
                    and len(by_category(db, "symptoms")) == 1
                    and by_category(db, "symptoms")[0].get("symptoms") == ["fatigue"]))

    await save(OWNER, DAY, ["fatigue", "cramps"], "fatigue, cramps")
    results.append(("b: re-saving symptoms leaves the mood log alone",
                    len(by_category(db, "symptoms")) == 1
                    and len(by_category(db, "mood")) == 1
                    and by_category(db, "mood")[0].get("symptoms") == ["mood:5", "emotion:happy"]))

    # Every other category behaves the same way: two saves each,
    # one row each, and the earlier categories untouched.
    await save(OWNER, DAY, ["craving:chocolate"], "chocolate")
    await save(OWNER, DAY, ["craving:chocolate", "craving:sweets"],
               "chocolate, sweets")
    await save(OWNER, DAY, ["collection:Tampon"], "Collection: Tampon")
    await save(OWNER, DAY, ["collection:Pads"], "Collection: Pads")
    await save(OWNER, DAY, ["sleep:6h", "sleep_quality:restless"], "6h, restless")
    await save(OWNER, DAY, ["sleep:8h", "sleep_quality:deep"], "8h, deep")
    await save(OWNER, DAY, ["supplements:iron"], "Supplements: iron")
    await save(OWNER, DAY, ["supplements:iron and vitamin D"],
               "Supplements: iron and vitamin D")
    await save(OWNER, DAY, ["energy:2"], "Energy 2/5")
    await save(OWNER, DAY, ["energy:4"], "Energy 4/5")
    for cat in ("cravings", "collection", "sleep", "supplements", "energy"):
        results.append((f"b: two {cat} saves leave exactly one {cat} log",
                        len(by_category(db, cat)) == 1))
    results.append(("b: latest sleep values win",
                    by_category(db, "sleep")[0].get("symptoms")
                    == ["sleep:8h", "sleep_quality:deep"]))
    results.append(("b: latest supplements values win",
                    by_category(db, "supplements")[0].get("symptoms")
                    == ["supplements:iron and vitamin D"]))
    results.append(("b: all seven categories coexist, one row each",
                    len(day_logs(db)) == 7))

    # Another user's log for the same date and category is not hers
    # to replace.
    await save(OTHER, DAY, ["fatigue"], "fatigue")
    await save(OWNER, DAY, ["nausea"], "nausea")
    results.append(("b: her save never touches another user's log",
                    len(by_category(db, "symptoms", user_id=OTHER["id"])) == 1
                    and by_category(db, "symptoms", user_id=OTHER["id"])[0]
                    .get("symptoms") == ["fatigue"]))


# ---------------- (c) emptied group replaces ----------------

async def section_emptied(results):
    db = FakeDB()
    server.db = db

    await save(OWNER, DAY, ["fatigue", "backache"], "fatigue, backache")
    code, _ = await save(OWNER, DAY, [], "No symptoms")
    results.append(("c: emptied symptoms save ok", code == "ok"))
    syms = by_category(db, "symptoms")
    results.append(("c: emptied save replaces, leaving exactly one symptoms log",
                    len(syms) == 1))
    results.append(("c: the surviving log is the emptied snapshot",
                    len(syms) == 1 and syms[0].get("symptoms") == []
                    and (syms[0].get("notes") or "").startswith("No symptoms")))
    results.append(("c: no other rows appeared for the date",
                    len(day_logs(db)) == 1))

    # And the reverse: logging again after emptying replaces the
    # emptied snapshot instead of stacking beside it.
    await save(OWNER, DAY, ["cramps"], "cramps")
    syms = by_category(db, "symptoms")
    results.append(("c: logging after emptying replaces the emptied snapshot",
                    len(syms) == 1 and syms[0].get("symptoms") == ["cramps"]))


# ---------------- (d) period logs are never removed ----------------

async def section_period_safe(results):
    db = FakeDB()
    server.db = db
    db.cycle_logs.docs += [
        {"id": "p-plain", "user_id": OWNER["id"], "date": DAY,
         "is_period": True, "flow": "medium", "symptoms": [],
         "notes": "Period started",
         "created_at": "2026-10-20T08:00:00+00:00"},
        # A period row carrying plain symptom strings: plain strings
        # alone would read as the symptoms category, so this proves
        # the period guard, not the string shape, is what saves it.
        {"id": "p-symptoms", "user_id": OWNER["id"], "date": DAY,
         "is_period": True, "flow": "heavy", "symptoms": ["cramps"],
         "notes": "Period day",
         "created_at": "2026-10-20T08:05:00+00:00"},
        # A mixed legacy row for the same date must survive too:
        # replace only ever targets a single-category snapshot.
        {"id": "x-mixed", "user_id": OWNER["id"], "date": DAY,
         "is_period": False, "flow": None,
         "symptoms": ["mood:3", "supplements:Vitamin D"],
         "notes": "Mood: Good\nSupplements: Vitamin D",
         "created_at": "2026-10-20T08:10:00+00:00"},
    ]

    await save(OWNER, DAY, ["fatigue"], "fatigue")
    await save(OWNER, DAY, [], "No symptoms")
    await save(OWNER, DAY, ["mood:4"], "Mood 4/5")
    await save(OWNER, DAY, ["supplements:iron"], "Supplements: iron")

    ids = {d.get("id") for d in day_logs(db)}
    results.append(("d: plain period log survives every category save",
                    "p-plain" in ids))
    results.append(("d: period log with plain symptoms survives too",
                    "p-symptoms" in ids))
    results.append(("d: period rows unchanged",
                    any(d.get("id") == "p-plain" and d.get("flow") == "medium"
                        and d.get("notes") == "Period started"
                        for d in day_logs(db))))
    results.append(("d: mixed legacy row survives category saves",
                    "x-mixed" in ids))


# ---------------- (e) journal day dedupes legacy staircases ----------------

async def section_journal_day(results):
    db = FakeDB()
    server.db = db
    legacy_day = "2026-10-22"

    def legacy(id_, symptoms, notes, stamp, is_period=False, flow=None):
        return {"id": id_, "user_id": OWNER["id"], "date": legacy_day,
                "is_period": is_period, "flow": flow, "symptoms": symptoms,
                "notes": notes, "created_at": stamp}

    db.cycle_logs.docs += [
        legacy("s-old", ["fatigue"], "fatigue",
               "2026-10-22T09:00:00+00:00"),
        legacy("s-mid", ["fatigue", "backache"], "fatigue, backache",
               "2026-10-22T09:01:00+00:00"),
        legacy("s-new", ["fatigue", "backache", "tender breasts"],
               "fatigue, backache, tender breasts",
               "2026-10-22T09:02:00+00:00"),
        legacy("e-old", ["energy:2"], "Energy 2/5",
               "2026-10-22T09:00:30+00:00"),
        legacy("e-new", ["energy:2"], "Energy 2/5",
               "2026-10-22T09:03:00+00:00"),
        legacy("supp-old", ["supplements:iron"], "Supplements: iron",
               "2026-10-22T09:00:45+00:00"),
        legacy("supp-new", ["supplements:iron"], "Supplements: iron",
               "2026-10-22T09:04:00+00:00"),
        legacy("m-old", ["mood:2"], "Mood 2/5",
               "2026-10-22T09:01:30+00:00"),
        legacy("m-new", ["mood:5", "emotion:happy"], "Feeling Happy · Mood 5/5",
               "2026-10-22T09:05:00+00:00"),
        legacy("p-day", [], "Period started",
               "2026-10-22T08:00:00+00:00", is_period=True, flow="medium"),
        legacy("x-mixed", ["mood:3", "supplements:Vitamin D"],
               "Mood: Good\nSupplements: Vitamin D",
               "2026-10-22T09:02:30+00:00"),
    ]
    db.journal_entries.docs.append(
        {"id": "j-day", "user_id": OWNER["id"], "title": "Day page",
         "content": "DAYPAGEWORDS", "is_intimate": False,
         "created_at": "2026-10-22T10:00:00+00:00"})
    db.intimacy_logs.docs.append(
        {"id": "i-day", "user_id": OWNER["id"], "date": legacy_day,
         "notes": "INTIMACYWORDS", "partners": "",
         "created_at": "2026-10-22T21:00:00+00:00"})
    stored_before = len(db.cycle_logs.docs)

    code, res = await call(server.get_journal_day, legacy_day, dict(OWNER))
    results.append(("e: journal day returns ok", code == "ok"))
    got_ids = [l.get("id") for l in res.get("logs") or []]
    results.append(("e: only the latest symptoms row is returned",
                    "s-new" in got_ids and "s-old" not in got_ids
                    and "s-mid" not in got_ids))
    results.append(("e: only the latest energy row is returned",
                    "e-new" in got_ids and "e-old" not in got_ids))
    results.append(("e: only the latest supplements row is returned",
                    "supp-new" in got_ids and "supp-old" not in got_ids))
    results.append(("e: only the latest mood row is returned",
                    "m-new" in got_ids and "m-old" not in got_ids))
    results.append(("e: the latest symptoms row holds the full latest values",
                    any(l.get("id") == "s-new"
                        and l.get("symptoms") == ["fatigue", "backache", "tender breasts"]
                        for l in res.get("logs") or [])))
    results.append(("e: period log returned as it is",
                    "p-day" in got_ids))
    results.append(("e: mixed legacy row returned as it is",
                    "x-mixed" in got_ids))
    results.append(("e: returned log ids are exactly the deduped set",
                    set(got_ids) == {"s-new", "e-new", "supp-new",
                                     "m-new", "p-day", "x-mixed"}))
    blob = json.dumps(res, default=str)
    results.append(("e: journal entries stay in the response",
                    "DAYPAGEWORDS" in blob))
    results.append(("e: intimacy stays in the response",
                    "INTIMACYWORDS" in blob))
    results.append(("e: dedupe deletes nothing from storage",
                    len(db.cycle_logs.docs) == stored_before))


async def main():
    results = []
    section_detection(results)
    await section_replace(results)
    await section_cross_category(results)
    await section_emptied(results)
    await section_period_safe(results)
    await section_journal_day(results)
    failed = [name for name, ok in results if not ok]
    for name, ok in results:
        print(("PASS " if ok else "FAIL ") + name)
    print(f"\n{len(results) - len(failed)}/{len(results)} passed")
    if failed:
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
