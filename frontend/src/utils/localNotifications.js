// On-device local notifications (v43, per the Oct 22 plan).
//
// Fully on-device: the Capacitor LocalNotifications plugin schedules
// alarms on the phone itself. No server push, no subscription, nothing
// to wake up on Render. The old Web Push path never delivered inside
// the Android WebView; this replaces it.
//
// Entry point: syncLocalNotifications(). It is called
//   - on onboarding completion (permission asked in context there),
//   - on app open for a signed-in user (keeps the Daily Read text and
//     the phase fresh, and picks up cycle data changes),
//   - from Profile whenever the preference is changed there.
// Every call cancels our three stable ids before scheduling, so
// schedules never stack. On web (non-native) everything no-ops.
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import axios from 'axios';
import logger from './logger';
import {
  NOTIF_KEYS,
  ALL_NOTIFICATION_IDS,
  readPrefs,
  buildNotificationPlan,
} from './notificationPlan';

export { NOTIF_KEYS, NOTIFICATION_TIMES } from './notificationPlan';
export { readPrefs as getNotificationPrefs } from './notificationPlan';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export function isNativePlatform() {
  try {
    return Capacitor.isNativePlatform();
  } catch (e) {
    return false;
  }
}

// 'granted' | 'denied' | 'prompt' on native, null on web.
export async function checkNotificationPermission() {
  if (!isNativePlatform()) return null;
  try {
    const res = await LocalNotifications.checkPermissions();
    return res.display;
  } catch (e) {
    logger.error('LocalNotifications checkPermissions failed:', e);
    return null;
  }
}

async function fetchDailyReadHeadline(token) {
  if (!token) return null;
  try {
    // Same endpoint and payload the Home Daily Read renders.
    const res = await axios.get(`${API}/premium/daily-read`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 20000,
    });
    const greeting = res.data?.reading?.greeting;
    return typeof greeting === 'string' && greeting.trim() ? greeting.trim() : null;
  } catch (e) {
    // Backend asleep or offline: the local fallback headline is used.
    return null;
  }
}

async function cancelOurs() {
  try {
    const pending = await LocalNotifications.getPending();
    const ours = (pending.notifications || []).filter((n) => ALL_NOTIFICATION_IDS.includes(n.id));
    if (ours.length) {
      await LocalNotifications.cancel({ notifications: ours.map((n) => ({ id: n.id })) });
    }
  } catch (e) {
    logger.error('LocalNotifications cancel failed:', e);
  }
}

// Reconcile the on-device schedules with the saved preference.
// Returns a status object: { status: 'web' | 'disabled' | 'denied' |
// 'prompt' | 'scheduled', permission, count }.
export async function syncLocalNotifications({ user, token, requestPermission = false } = {}) {
  if (!isNativePlatform()) return { status: 'web', permission: null, count: 0 };

  let storage = null;
  try { storage = window.localStorage; } catch (e) { /* no storage: user record only */ }
  const prefs = readPrefs(storage, user);

  // v49: the daily reminder and the two cycle alerts are separate
  // choices now. Only when she chose none of them is there nothing
  // to schedule.
  if (!prefs.enabled && !prefs.period && !prefs.ovulation) {
    await cancelOurs();
    return { status: 'disabled', permission: null, count: 0 };
  }

  let display = await checkNotificationPermission();
  if (display !== 'granted' && requestPermission && display === 'prompt') {
    try {
      const res = await LocalNotifications.requestPermissions();
      display = res.display;
    } catch (e) {
      logger.error('LocalNotifications requestPermissions failed:', e);
    }
  }
  try { storage && storage.setItem(NOTIF_KEYS.permission, display || 'unknown'); } catch (e) { /* ignore */ }

  if (display !== 'granted') {
    // Nothing scheduled without permission. Profile shows one plain
    // line for the denied case; we never nag from here.
    await cancelOurs();
    return { status: display === 'denied' ? 'denied' : 'prompt', permission: display, count: 0 };
  }

  const headline = await fetchDailyReadHeadline(token);
  const plan = buildNotificationPlan({ user, prefs, headline, now: new Date() });

  await cancelOurs();
  const notifications = plan.map((item) => {
    const base = {
      id: item.id,
      title: item.title,
      body: item.body,
      // No custom sound or icon: the plugin/app defaults apply.
    };
    if (item.on) {
      // Repeating daily at the user's chosen time. Rebuilt on every
      // app open, so the body text is that day's Daily Read headline.
      return { ...base, schedule: { on: { hour: item.on.hour, minute: item.on.minute }, allowWhileIdle: true } };
    }
    return { ...base, schedule: { at: item.at, allowWhileIdle: true } };
  });

  try {
    await LocalNotifications.schedule({ notifications });
  } catch (e) {
    logger.error('LocalNotifications schedule failed:', e);
    return { status: 'error', permission: display, count: 0 };
  }
  logger.log('Local notifications scheduled:', notifications.map((n) => n.id));
  return { status: 'scheduled', permission: display, count: notifications.length };
}
