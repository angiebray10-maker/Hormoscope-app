// The current cycle day, for the tiny peaches (Angelita, Oct 30,
// 2026, fix list item 26): every peach carries the day she is
// actually on, from the same dashboard cycle_info the rest of the
// app reads. Returns null when there is no real current cycle day:
// no dashboard data, the no-periods path, or the dashboard's
// placeholder block (phase "unknown" carries a fake cycle_day of 1,
// which must never be shown as if it were her day).
export function cycleDayFromDashboard(data) {
  if (!data || typeof data !== 'object') return null;
  if (data.no_periods) return null;
  const ci = data.cycle_info;
  if (!ci || typeof ci !== 'object') return null;
  if (!ci.phase || ci.phase === 'unknown') return null;
  const day = parseInt(ci.cycle_day, 10);
  if (!Number.isFinite(day) || day < 1) return null;
  return day;
}

// The current phase, for the tiny peaches' glow (v55): the peaches
// wear the phase pair colors of the day she is on, around the art,
// never on it. Same guards as the day number: null on the no-periods
// path, on placeholder data, and whenever there is no real phase.
export function phaseFromDashboard(data) {
  if (!data || typeof data !== 'object') return null;
  if (data.no_periods) return null;
  const ci = data.cycle_info;
  if (!ci || typeof ci !== 'object') return null;
  if (!ci.phase || ci.phase === 'unknown') return null;
  return ci.phase;
}
