"""Standalone verification for v56 (Angelita, Oct 30, 2026):

- OVULATION ANCHOR CHANGE: ovulation day = logged period start
  + 14 days, replacing next period minus 14, in the backend
  calculate_cycle_info. Spec case: a 35 day cycle with a period
  start of Jan 1 puts ovulation on Jan 15 (the old rule would have
  said Jan 22), the fertile window runs Jan 10 through Jan 16
  (5 days before through 1 day after), peak Jan 14 and Jan 15, and
  the phase ON Jan 15 is ovulatory.
- The projected-cycle case: when today is more than a cycle past
  the logged start, the anchor follows the projected start of the
  cycle today falls in, not the stale logged date.
- ESTIMATE FLAG EXPOSURE: build_user_response carries
  cycle_length_is_estimate through (Home's estimate label reads
  it), True when stored True, False when absent.

Runs server.py functions directly. No network, no real Mongo.
"""
import os, sys
from datetime import datetime as RealDT, timezone

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("JWT_SECRET", "test-secret-for-local-verification")
os.environ.setdefault("ANTHROPIC_API_KEY", "test-key-not-real")

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import server

passed = failed = 0

def check(name, cond, extra=""):
    global passed, failed
    if cond:
        passed += 1
        print(f"  PASS {name}")
    else:
        failed += 1
        print(f"  FAIL {name} {extra}")

class FakeDT(RealDT):
    NOW = None
    @classmethod
    def now(cls, tz=None):
        return cls.NOW

def set_today(y, m, d):
    FakeDT.NOW = RealDT(y, m, d, 12, 0, tzinfo=timezone.utc)
    server.datetime = FakeDT

try:
    # --- Spec case: 35 day cycle, period start Jan 1, 2026 ---
    set_today(2026, 1, 10)
    info = server.calculate_cycle_info("2026-01-01", 35)
    check("ovulation is start + 14 (Jan 15)", info.get("ovulation_date") == "2026-01-15",
          f"got {info.get('ovulation_date')}")
    check("old rule would differ (not Jan 22)", info.get("ovulation_date") != "2026-01-22")
    fw = info.get("fertile_window") or {}
    check("fertile start is ov - 5 (Jan 10)", fw.get("start") == "2026-01-10", f"got {fw.get('start')}")
    check("fertile end is ov + 1 (Jan 16)", fw.get("end") == "2026-01-16", f"got {fw.get('end')}")
    check("peak starts ov - 1 (Jan 14)", fw.get("peak_start") == "2026-01-14", f"got {fw.get('peak_start')}")
    check("peak ends on ov (Jan 15)", fw.get("peak_end") == "2026-01-15", f"got {fw.get('peak_end')}")
    check("next period unchanged (Feb 5)", info.get("next_period_date") == "2026-02-05",
          f"got {info.get('next_period_date')}")
    check("cycle day on Jan 10 is 10", info.get("cycle_day") == 10, f"got {info.get('cycle_day')}")

    # --- Phase on the ovulation day itself is ovulatory ---
    set_today(2026, 1, 15)
    info2 = server.calculate_cycle_info("2026-01-01", 35)
    check("cycle day on Jan 15 is 15", info2.get("cycle_day") == 15, f"got {info2.get('cycle_day')}")
    check("phase on ovulation day is ovulatory", info2.get("phase") == "ovulatory",
          f"got {info2.get('phase')}")
    check("ovulation date still Jan 15", info2.get("ovulation_date") == "2026-01-15")

    # --- 28 day cycle sanity: start Jan 1, ovulation Jan 15 ---
    set_today(2026, 1, 3)
    info3 = server.calculate_cycle_info("2026-01-01", 28)
    check("28 day cycle ovulation also Jan 15", info3.get("ovulation_date") == "2026-01-15",
          f"got {info3.get('ovulation_date')}")

    # --- Projected cycle: start Jan 1, 28 day cycle, today Mar 20.
    # Projected starts: Jan 29, Feb 26, Mar 26... today falls in the
    # cycle that started Feb 26, so ovulation anchors to Feb 26 + 14.
    set_today(2026, 3, 20)
    info4 = server.calculate_cycle_info("2026-01-01", 28)
    check("projected cycle ovulation is Mar 12", info4.get("ovulation_date") == "2026-03-12",
          f"got {info4.get('ovulation_date')} cycle_day={info4.get('cycle_day')}")

    # --- Estimate flag exposure through build_user_response ---
    base_user = {"id": "u1", "email": "t@example.com", "birthday": "1990-01-01",
                 "cycle_length": 28, "cycle_length_is_estimate": True}
    resp = server.build_user_response(base_user)
    check("estimate flag True is exposed", resp.cycle_length_is_estimate is True)
    base_user2 = {"id": "u2", "email": "t@example.com", "birthday": "1990-01-01",
                  "cycle_length": 31}
    resp2 = server.build_user_response(base_user2)
    check("estimate flag absent reads False", resp2.cycle_length_is_estimate is False)
finally:
    server.datetime = RealDT

print(f"\n{passed} passed, {failed} failed")
sys.exit(1 if failed else 0)
