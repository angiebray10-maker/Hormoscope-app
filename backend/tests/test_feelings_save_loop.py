"""Standalone verification (Angelita's report, Oct 31, 2026):
"when I type save for my feelings day it doesnt save into the
calendar I dont even see anything I logged in."

Root cause was frontend-only and is fixed there: FloatingCarousel
and JournalPage computed "today" as the UTC date
(`new Date().toISOString().split('T')[0]`), which for San Diego
rolls to tomorrow at 5 PM local, so evening feelings saves were
filed under tomorrow's date string: the POST succeeded, but the
calendar marked that other day and the day she lived showed
nothing. Both helpers now build the date from local parts, the
same formula HomePage and the calendar grid have always used.

This suite guards the backend half of the contract the fixed
frontend relies on, using the EXACT payload shapes
FloatingCarousel.buildPayload('mood') sends:

(a) saving feelings for a date puts that date in
    GET /journal/logged-days (the calendar's logged set);
(b) GET /journal/day/{date} returns the feelings back (so
    reopening the day shows them);
(c) saving again updates the day's feelings instead of
    stacking duplicates;
(d) an emptied feelings save ("No mood or feelings") still
    counts the day as logged and reads back as emptied.

Runs server.py against in-memory fake collections. No network,
no real Mongo.
"""
import os, sys, asyncio

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("JWT_SECRET", "test-secret-for-local-verification")
os.environ.setdefault("ANTHROPIC_API_KEY", "test-key-not-real")

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.dirname(__file__))
import server
from test_v59_log_replace import FakeDB, OWNER

DAY = "2026-10-31"


async def save_feelings(user, date, symptoms, notes):
    """POST /cycle-logs with the sheet's mood-group payload shape:
    {date, is_period: false, symptoms, notes} and no flow field."""
    return await server.create_cycle_log(
        server.CycleLogCreate(date=date, is_period=False,
                              symptoms=symptoms, notes=notes),
        dict(user))


def day_rows(db, user_id=OWNER["id"], date=DAY):
    return [d for d in db.cycle_logs.docs
            if d.get("user_id") == user_id and d.get("date") == date]


async def main():
    results = []

    def check(name, ok):
        results.append((name, bool(ok)))

    db = FakeDB()
    server.db = db

    # --- (a) + (b): the feelings save lands on the day, everywhere.
    # Tap "Calm" with no mood face picked: symptoms carry only the
    # emotion tag, notes carry the readable label.
    res = await save_feelings(OWNER, DAY, ["emotion:calm"], "Feeling Calm")
    check("save returns the created id", bool(res.get("id")))
    rows = day_rows(db)
    check("exactly one row stored for the day", len(rows) == 1)
    check("the row is filed under the day itself",
          len(rows) == 1 and rows[0].get("date") == DAY)
    check("the row holds the emotion tag",
          len(rows) == 1 and rows[0].get("symptoms") == ["emotion:calm"])

    logged = await server.get_journal_logged_days(dict(OWNER))
    check("(a) the date is in logged_days for the calendar",
          DAY in logged["logged_days"])
    check("(a) the date is in log_days", DAY in logged["log_days"])

    day = await server.get_journal_day(DAY, dict(OWNER))
    day_logs = day["logs"]
    check("(b) the day view returns the feelings log",
          len(day_logs) == 1
          and day_logs[0].get("symptoms") == ["emotion:calm"]
          and day_logs[0].get("notes") == "Feeling Calm")

    # --- (c): saving again updates instead of duplicating.
    await save_feelings(OWNER, DAY, ["emotion:calm", "emotion:tired"],
                        "Feeling Calm, Tired")
    rows = day_rows(db)
    check("(c) re-saving feelings leaves exactly one row",
          len(rows) == 1)
    check("(c) the one row holds the latest feelings",
          len(rows) == 1
          and rows[0].get("symptoms") == ["emotion:calm", "emotion:tired"]
          and rows[0].get("notes") == "Feeling Calm, Tired")
    day = await server.get_journal_day(DAY, dict(OWNER))
    check("(c) the day view shows the updated feelings once",
          len(day["logs"]) == 1
          and day["logs"][0].get("notes") == "Feeling Calm, Tired")

    # A mood face tap carries the mood tag with the feelings; it is
    # the same group, so it still leaves one current row.
    await save_feelings(OWNER, DAY,
                        ["mood:4", "emotion:calm", "emotion:tired"],
                        "Feeling Calm, Tired · Mood 4/5")
    rows = day_rows(db)
    day = await server.get_journal_day(DAY, dict(OWNER))
    check("(c) mood face plus feelings still leaves one row",
          len(rows) == 1 and len(day["logs"]) == 1
          and day["logs"][0].get("symptoms")
          == ["mood:4", "emotion:calm", "emotion:tired"])

    # --- (d): untapping every feeling saves the emptied group; the
    # day stays logged and reads back empty, not lost.
    await save_feelings(OWNER, DAY, [], "No mood or feelings")
    rows = day_rows(db)
    logged = await server.get_journal_logged_days(dict(OWNER))
    day = await server.get_journal_day(DAY, dict(OWNER))
    check("(d) the emptied save replaces the feelings row",
          len(rows) == 1 and rows[0].get("symptoms") == []
          and rows[0].get("notes") == "No mood or feelings")
    check("(d) the day is still in logged_days",
          DAY in logged["logged_days"])
    check("(d) the day view returns the emptied row",
          len(day["logs"]) == 1
          and day["logs"][0].get("notes") == "No mood or feelings")

    # Another user's feelings on the same date never leak in.
    await save_feelings({"id": "u-other", "email": "o@example.com",
                         "name": "Oona"},
                        DAY, ["emotion:happy"], "Feeling Happy")
    logged = await server.get_journal_logged_days(dict(OWNER))
    day = await server.get_journal_day(DAY, dict(OWNER))
    check("another user's same-day feelings stay hers alone",
          len(day["logs"]) == 1
          and day["logs"][0].get("notes") == "No mood or feelings")

    failed = [name for name, ok in results if not ok]
    for name, ok in results:
        print(("PASS " if ok else "FAIL ") + name)
    print(f"\n{len(results) - len(failed)}/{len(results)} passed")
    if failed:
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
