// Pure scheduling math for on-device local notifications (v43).
//
// No Capacitor, no network, no React imports in this file: it only
// turns (user record, saved preference, headline, now) into a concrete
// plan of notifications to schedule. utils/localNotifications.js does
// the native calls with the plan built here. Keeping this pure means
// the exact same logic can be traced and tested outside the app.
//
// Cycle math mirrors what the Calendar already uses (and what the
// server computes): next period = last period start + cycle_length,
// rolled forward cycle by cycle; ovulation = next period - 14 days;
// fertile window = ovulation - 5 days through ovulation day.
// Predictions are always labelled "estimated", matching the wording
// rule used across the app (Calendar: "Fertile window (estimated)").

export const NOTIF_KEYS = {
  enabled: 'hormoscope-notifications-enabled',
  time: 'hormoscope-notification-time',
  permission: 'hormoscope-notifications-permission',
};

// Stable ids so every reschedule cancels and replaces, never stacks.
export const DAILY_NOTIFICATION_ID = 7101;
export const PERIOD_NOTIFICATION_ID = 7102;
export const OVULATION_NOTIFICATION_ID = 7103;
export const ALL_NOTIFICATION_IDS = [
  DAILY_NOTIFICATION_ID,
  PERIOD_NOTIFICATION_ID,
  OVULATION_NOTIFICATION_ID,
];

// Same choices onboarding offers (OnboardingPage TIMES).
export const NOTIFICATION_TIMES = [
  { time: '07:00', label: '7 AM' },
  { time: '09:00', label: '9 AM' },
  { time: '12:00', label: '12 PM' },
  { time: '18:00', label: '6 PM' },
  { time: '20:00', label: '8 PM' },
  { time: '22:00', label: '10 PM' },
];

// Cycle alerts fire at fixed local times from the plan (Oct 22):
// the period alert the EVENING before, the ovulation alert that MORNING.
export const PERIOD_ALERT_HOUR = 19; // 7 PM, evening before
export const OVULATION_ALERT_HOUR = 9; // 9 AM, morning of

// Cycle situations where the app switches predictions off entirely
// (onboarding copy: "Fertility predictions stay off"). no_periods
// joined in v46 (Feature B): no period or ovulation alerts for her,
// ever; her daily notification at her chosen time still stands.
const PREDICTIONS_OFF = ['hormonal_birth_control', 'pregnant', 'postpartum', 'menopause', 'no_periods'];

export function parseTimeHHMM(value) {
  if (typeof value !== 'string') return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

// Read the saved preference. Local storage (written by onboarding and
// by Profile) wins; the user record from the server is the fallback
// for a device that has not been through onboarding on this install.
export function readPrefs(storage, user) {
  let enabled = null;
  let time = null;
  try {
    const rawEnabled = storage ? storage.getItem(NOTIF_KEYS.enabled) : null;
    if (rawEnabled !== null && rawEnabled !== undefined) enabled = rawEnabled === 'true';
    const rawTime = storage ? storage.getItem(NOTIF_KEYS.time) : null;
    if (rawTime) time = rawTime;
  } catch (e) {
    // storage unavailable (private mode etc.): fall through to user record
  }
  if (enabled === null && user && typeof user.notifications_enabled === 'boolean') {
    enabled = user.notifications_enabled;
  }
  if (!time && user && user.notification_time) time = user.notification_time;
  if (!parseTimeHHMM(time)) time = '09:00';
  return { enabled: enabled === true, time };
}

const DAY_MS = 86400000;

export function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function parseISODate(value) {
  if (!value || typeof value !== 'string') return null;
  const d = new Date(value.slice(0, 10) + 'T00:00:00');
  return Number.isNaN(d.getTime()) ? null : d;
}

// Cycle facts for the cycle that contains (or follows) `refDate`.
// Returns null when there is nothing to predict from: no last period
// date, an unparseable date, or a cycle situation with predictions off.
export function cycleInfoFor(user, refDate) {
  if (!user) return null;
  if (user.no_periods) return null;
  if (PREDICTIONS_OFF.includes(user.cycle_status)) return null;
  const start = parseISODate(user.last_period_date);
  if (!start) return null;
  const L = Number(user.cycle_length) > 0 ? Number(user.cycle_length) : 28;
  const ref = startOfDay(refDate);
  const diff = Math.floor((ref - start) / DAY_MS);
  if (diff < 0) return null; // last period is in the future: no sane math

  // Rolling position inside the current cycle (day 1 = a period start).
  const cycleDay = (diff % L) + 1;

  // Phase bands: the same day thresholds lib/phases.js and the server use.
  let phase = 'luteal';
  if (cycleDay <= 5) phase = 'menstrual';
  else if (cycleDay <= 12) phase = 'follicular';
  else if (cycleDay <= 19) phase = 'ovulatory';

  // Next period start: the first start + n*L that is strictly after ref.
  const cyclesElapsed = Math.floor(diff / L);
  const nextPeriodDate = addDays(start, (cyclesElapsed + 1) * L);
  // Ovulation for the cycle that ends at nextPeriodDate, then the
  // first fertile-window start that is today or later (roll one cycle
  // forward when this window has already begun).
  const ovulationDate = addDays(nextPeriodDate, -14);
  let fertileStart = addDays(ovulationDate, -5);
  if (fertileStart < ref) fertileStart = addDays(fertileStart, L);

  return { cycleLength: L, cycleDay, phase, nextPeriodDate, ovulationDate, fertileStart };
}

export function fallbackHeadline(user, now) {
  const info = cycleInfoFor(user, now);
  if (info) {
    const phaseName = info.phase.charAt(0).toUpperCase() + info.phase.slice(1);
    return `Day ${info.cycleDay} of your cycle, your ${phaseName} phase. Your Daily Read is waiting for you.`;
  }
  return 'Your Daily Read is waiting for you. Open HORMOscope to see your day.';
}

// If a one-shot's fire moment has passed but it is still the intended
// day, fire almost immediately instead of dropping the alert.
function clampToToday(at, now) {
  if (at > now) return at;
  if (startOfDay(at).getTime() === startOfDay(now).getTime()) {
    return new Date(now.getTime() + 5 * 60000);
  }
  return null;
}

// Build the full plan. `headline` is today's Daily Read greeting (the
// same data the Home Daily Read renders) or null; the returned items
// are plain data: { id, kind, title, body, on } for the repeating
// daily reminder, { id, kind, title, body, at } for one-shot alerts.
export function buildNotificationPlan({ user, prefs, headline, now }) {
  if (!prefs || !prefs.enabled) return [];
  const time = parseTimeHHMM(prefs.time) || { hour: 9, minute: 0 };
  const body = (headline && headline.trim()) || fallbackHeadline(user, now);
  const plan = [{
    id: DAILY_NOTIFICATION_ID,
    kind: 'daily',
    title: 'Your Daily Read',
    body: body.length > 180 ? body.slice(0, 177).trimEnd() + '...' : body,
    on: { hour: time.hour, minute: time.minute },
  }];

  const info = cycleInfoFor(user, now);
  if (info) {
    // Period tomorrow: evening before the predicted start day.
    const periodAt = addDays(info.nextPeriodDate, -1);
    periodAt.setHours(PERIOD_ALERT_HOUR, 0, 0, 0);
    const periodFire = clampToToday(periodAt, now);
    if (periodFire) {
      plan.push({
        id: PERIOD_NOTIFICATION_ID,
        kind: 'period',
        title: 'Your period is estimated to start tomorrow',
        body: 'A gentle heads-up from HORMOscope: your period is estimated to start tomorrow. Rest up tonight, and keep whatever you need close by.',
        at: periodFire,
      });
    }

    // Ovulation week starts today: the morning the fertile window
    // (the app's ovulation window) begins.
    const ovuAt = new Date(info.fertileStart);
    ovuAt.setHours(OVULATION_ALERT_HOUR, 0, 0, 0);
    const ovuFire = clampToToday(ovuAt, now);
    if (ovuFire) {
      plan.push({
        id: OVULATION_NOTIFICATION_ID,
        kind: 'ovulation',
        title: 'Your ovulation week is estimated to start today',
        body: 'Your ovulation week is estimated to start today. Open your Daily Read for what this phase can bring, and how to make the most of it.',
        at: ovuFire,
      });
    }
  }
  return plan;
}
