import React, { useState } from 'react';
import { Bell, X } from 'lucide-react';
import axios from 'axios';
import logger from '../utils/logger';
import { syncLocalNotifications, getNotificationPrefs, NOTIFICATION_TIMES } from '../utils/localNotifications';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const poppins = { fontFamily: 'Poppins, sans-serif' };

// Reminders card (v50, Angelita, Oct 26, 2026): onboarding no longer
// asks about notifications, so Home carries ONE gentle invitation to
// set them, shown only to someone who has never set notification
// preferences (no onboarding keys, no Profile save, no earlier
// dismissal). Saving writes the exact same local keys and the same
// PUT /profile merge the Profile Daily Notifications section and the
// old onboarding step used. Dismissing is forever: it never nags again.
const LS_DISMISSED = 'hormoscope-reminders-dismissed';
const LS_SET = 'hormoscope-reminders-set';
const LS_ENABLED = 'hormoscope-notifications-enabled';

function alreadyHandled() {
  try {
    return !!(
      localStorage.getItem(LS_DISMISSED) ||
      localStorage.getItem(LS_SET) ||
      localStorage.getItem(LS_ENABLED)
    );
  } catch (e) {
    return true; // no storage: never nag
  }
}

export default function RemindersCard({ user, token, updateUser }) {
  const prefs = getNotificationPrefs(user);
  const [visible, setVisible] = useState(() => !alreadyHandled());
  const [enabled, setEnabled] = useState(true);
  const [time, setTime] = useState(prefs.time || '09:00');
  const [periodAlert, setPeriodAlert] = useState(true);
  const [ovulationAlert, setOvulationAlert] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  if (!visible || !user) return null;

  const dismiss = () => {
    try { localStorage.setItem(LS_DISMISSED, 'true'); } catch (e) { /* ignore */ }
    setVisible(false);
  };

  const save = async () => {
    setSaving(true);
    setMsg('');
    const mergedPrefs = { ...(user.notification_preferences || {}), period_reminder: periodAlert, ovulation_reminder: ovulationAlert };
    try {
      localStorage.setItem('hormoscope-notifications-enabled', enabled ? 'true' : 'false');
      localStorage.setItem('hormoscope-notification-time', time);
      localStorage.setItem('hormoscope-notifications-period', periodAlert ? 'true' : 'false');
      localStorage.setItem('hormoscope-notifications-ovulation', ovulationAlert ? 'true' : 'false');
      localStorage.setItem(LS_SET, 'true');
    } catch (e) { /* storage unavailable: the server fields below still save */ }
    try {
      const res = await axios.put(`${API}/profile`, {
        notifications_enabled: enabled,
        notification_time: time,
        notification_preferences: mergedPrefs,
      }, { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 });
      if (updateUser) updateUser(res.data);
    } catch (err) {
      logger.error('Reminders card save failed:', err);
    }
    try {
      await syncLocalNotifications({
        user: { ...user, notifications_enabled: enabled, notification_time: time, notification_preferences: mergedPrefs },
        token,
        requestPermission: enabled || periodAlert || ovulationAlert,
      });
    } catch (err) {
      logger.error('Reminders card notification sync failed:', err);
    }
    setSaving(false);
    setVisible(false);
  };

  const row = 'flex items-center gap-3 py-1.5 text-sm text-[#F7F4FA] cursor-pointer';

  return (
    <div className="glass-card p-5 mb-4" data-testid="reminders-card" style={poppins}>
      <div className="flex items-start gap-3 mb-2">
        <div className="w-10 h-10 rounded-full bg-[#FF4F9A]/20 flex items-center justify-center shrink-0">
          <Bell className="w-5 h-5 text-[#FF4F9A]" />
        </div>
        <div className="flex-1">
          <p className="text-[#F4D3DC] text-sm font-medium">Set your reminders</p>
          <p className="text-[#CFC3CC] text-xs leading-relaxed">A little note from your cycle, only the ones you tick. You can change these any time in Profile.</p>
        </div>
        <button onClick={dismiss} aria-label="Dismiss" className="p-1 text-white/50 hover:text-white" data-testid="reminders-dismiss">
          <X className="w-4 h-4" />
        </button>
      </div>
      <label className={row}>
        <input type="checkbox" className="w-4 h-4 accent-[#FF4F9A]" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} data-testid="reminders-daily-toggle" />
        Daily Read reminder
      </label>
      <div className="mb-1">
        <select value={time} disabled={!enabled} onChange={(e) => setTime(e.target.value)} className="w-full rounded-xl px-3 py-2.5 bg-white/5 border border-white/15 text-white disabled:opacity-50" data-testid="reminders-time-select">
          {NOTIFICATION_TIMES.map((t) => <option key={t.time} value={t.time} className="bg-[#15152B]">{t.label}</option>)}
        </select>
      </div>
      <label className={row}>
        <input type="checkbox" className="w-4 h-4 accent-[#FF4F9A]" checked={periodAlert} onChange={(e) => setPeriodAlert(e.target.checked)} data-testid="reminders-period-toggle" />
        <span>Period coming
          <span className="block text-xs text-[#CFC3CC]">A gentle note the evening before your period is estimated to start.</span>
        </span>
      </label>
      <label className={row}>
        <input type="checkbox" className="w-4 h-4 accent-[#FF4F9A]" checked={ovulationAlert} onChange={(e) => setOvulationAlert(e.target.checked)} data-testid="reminders-ovulation-toggle" />
        <span>Ovulation week starting
          <span className="block text-xs text-[#CFC3CC]">A note the morning your ovulation week is estimated to begin.</span>
        </span>
      </label>
      {msg && <p className="text-sm text-[#E6E0EE] mt-2" role="status">{msg}</p>}
      <button
        onClick={save}
        disabled={saving}
        className="w-full mt-3 py-2.5 rounded-full text-white text-sm font-medium disabled:opacity-50"
        style={{ background: '#FF4F9A' }}
        data-testid="reminders-save-btn"
      >
        {saving ? 'Saving…' : 'Save my reminders'}
      </button>
    </div>
  );
}
