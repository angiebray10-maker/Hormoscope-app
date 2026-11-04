import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import logger from './logger';

// v64 (Angelita, Nov 4, 2026): notifications are back in ONE narrow
// shape. At signup the app sets a 9 AM reminder twice a week
// (Monday and Thursday by default) using on-device local
// notifications, never web push (the old web push sender never
// actually sent anything). She can change the days or turn them
// off in Profile. Android still owns the permission itself: the
// system asks once, and nothing here can switch it on silently.
//
// Capacitor weekday numbers: 1 = Sunday, 2 = Monday, ... 7 = Saturday.
export const NOTIF_PREFS_KEY = 'hormoscope-notif-prefs';
export const WEEKDAY_LABELS = [
  { id: 1, label: 'Sun' },
  { id: 2, label: 'Mon' },
  { id: 3, label: 'Tue' },
  { id: 4, label: 'Wed' },
  { id: 5, label: 'Thu' },
  { id: 6, label: 'Fri' },
  { id: 7, label: 'Sat' },
];
export const DEFAULT_NOTIF_PREFS = { enabled: true, days: [2, 5], hour: 9, minute: 0 };

const notifIdForDay = (weekday) => 6400 + weekday;
const ALL_IDS = [1, 2, 3, 4, 5, 6, 7].map(notifIdForDay);

export function loadNotifPrefs() {
  try {
    const raw = localStorage.getItem(NOTIF_PREFS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.days)) return null;
    return { ...DEFAULT_NOTIF_PREFS, ...parsed };
  } catch {
    return null;
  }
}

export function saveNotifPrefs(prefs) {
  try {
    localStorage.setItem(NOTIF_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Storage full or blocked: the schedule still applies this run.
  }
}

async function cancelAll() {
  try {
    await LocalNotifications.cancel({ notifications: ALL_IDS.map((id) => ({ id })) });
  } catch (err) {
    logger.error('Notification cancel error:', err);
  }
}

// Applies the schedule. When askPermission is true and permission
// has not been decided yet, the system prompt is shown (used at
// signup and when she flips the switch herself, never on app load).
export async function applyNotificationSchedule(prefs, { askPermission = false } = {}) {
  if (!Capacitor.isNativePlatform()) return { scheduled: false, reason: 'web' };
  try {
    await cancelAll();
    if (!prefs.enabled || !prefs.days.length) return { scheduled: false, reason: 'off' };
    let perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted' && askPermission) {
      perm = await LocalNotifications.requestPermissions();
    }
    if (perm.display !== 'granted') return { scheduled: false, reason: 'denied' };
    await LocalNotifications.schedule({
      notifications: prefs.days.map((weekday) => ({
        id: notifIdForDay(weekday),
        title: 'HORMOscope',
        body: 'Your Daily Read is waiting. See what today holds for your cycle.',
        schedule: {
          on: { weekday, hour: prefs.hour, minute: prefs.minute },
          allowWhileIdle: true,
        },
      })),
    });
    return { scheduled: true };
  } catch (err) {
    logger.error('Notification schedule error:', err);
    return { scheduled: false, reason: 'error' };
  }
}

// Called once when onboarding completes: stores the default prefs
// and asks the system for permission a single time.
export async function ensureSignupNotifications() {
  if (loadNotifPrefs()) return { scheduled: false, reason: 'exists' };
  saveNotifPrefs(DEFAULT_NOTIF_PREFS);
  return applyNotificationSchedule(DEFAULT_NOTIF_PREFS, { askPermission: true });
}

// Called on app load: re-applies stored prefs only when permission
// is already granted, so a denial is never re-prompted.
export async function rescheduleIfPermitted() {
  const prefs = loadNotifPrefs();
  if (!prefs || !prefs.enabled) return;
  if (!Capacitor.isNativePlatform()) return;
  try {
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display === 'granted') {
      await applyNotificationSchedule(prefs, { askPermission: false });
    }
  } catch (err) {
    logger.error('Notification reschedule error:', err);
  }
}
