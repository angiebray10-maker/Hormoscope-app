import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePremium } from '../context/PremiumContext';
import { Link } from 'react-router-dom';
import { Heart, Shield, Loader2, Calendar as CalendarIcon, Send, Trash2, Link2, Camera, BookOpen, Bell } from 'lucide-react';
import axios from 'axios';
import { PHASE_COLORS as SHARED_PHASE_COLORS, PHASE_PAIRS } from '../lib/phases';
import { syncLocalNotifications, getNotificationPrefs, NOTIFICATION_TIMES } from '../utils/localNotifications';
import logger from '../utils/logger';
import CycleSync from '../components/CycleSync';
import { PartnerAvatar } from './AttunementPage';


const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PHASE_COLORS = SHARED_PHASE_COLORS;

const PHASE_NAMES = {
  menstrual: 'Menstrual Phase',
  follicular: 'Follicular Phase',
  ovulatory: 'Ovulatory Phase',
  luteal: 'Luteal Phase',
  late: 'Period Expected',
  unknown: 'Unknown',
};

const KIND_STYLES = {
  period: { bg: 'rgba(232,90,107,0.25)', label: 'Period' },
  fertile: { bg: 'rgba(85,239,196,0.18)', label: 'Fertile' },
  ovulation: { bg: 'rgba(85,239,196,0.45)', label: 'Ovulation' },
  expected_period: { bg: 'rgba(255,107,107,0.14)', label: 'Period expected' },
};

function NotesTab({ token, currentUserId, onUnreadChange }) {
  const [notes, setNotes] = useState([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchNotes = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/partner/notes`, { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 });
      setNotes(res.data.notes || []);
      onUnreadChange(res.data.unread_count || 0);
    } catch (err) {
      logger.error('Failed to fetch notes:', err);
    } finally {
      setLoading(false);
    }
  }, [token, onUnreadChange]);

  useEffect(() => {
    fetchNotes();
    const t = setInterval(fetchNotes, 15000);
    return () => clearInterval(t);
  }, [fetchNotes]);

  useEffect(() => {
    // Mark as read shortly after opening, so the dot clears naturally
    const t = setTimeout(async () => {
      try {
        await axios.put(`${API}/partner/notes/read`, {}, { headers: { Authorization: `Bearer ${token}` } });
        onUnreadChange(0);
      } catch (err) { /* quiet */ }
    }, 4000);
    return () => clearTimeout(t);
  }, [token, onUnreadChange]);

  const handleSend = async () => {
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true);
    try {
      await axios.post(`${API}/partner/notes`, { content }, { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 });
      setDraft('');
      fetchNotes();
    } catch (err) {
      logger.error('Failed to send note:', err);
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`${API}/partner/notes/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      setNotes(notes.filter(n => n.id !== id));
    } catch (err) {
      logger.error('Failed to delete note:', err);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-[#f4a7b9] animate-spin" /></div>;
  }

  return (
    <div data-testid="partner-notes">
      {notes.length === 0 ? (
        <div className="text-center py-12">
          <Heart className="w-10 h-10 text-[#f4a7b9]/40 mx-auto mb-3" />
          <p className="text-white/75 text-sm" style={{ fontFamily: 'Poppins, sans-serif' }}>Nothing here yet.</p>
          <p className="text-white/25 text-xs mt-1" style={{ fontFamily: 'Poppins, sans-serif' }}>Leave the first little note below.</p>
        </div>
      ) : (
        <div className="space-y-3 mb-4">
          {notes.map((n) => {
            const mine = currentUserId && n.author_id === currentUserId;
            return (
              <div key={n.id}
                className={`rounded-2xl p-4 border border-white/[0.06] ${mine ? 'ml-8' : 'mr-8'}`}
                style={{ background: mine ? 'rgba(255,79,154,0.07)' : 'rgba(255,255,255,0.03)' }}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-white text-sm leading-relaxed whitespace-pre-wrap" style={{ fontFamily: 'Poppins, sans-serif' }}>{n.content}</p>
                  {mine && (
                    <button onClick={() => handleDelete(n.id)} className="text-white/15 hover:text-red-400 p-1 shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <p className="text-white/25 text-[10px] mt-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
                  {n.author_name} · {n.created_at ? new Date(n.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                </p>
              </div>
            );
          })}
        </div>
      )}
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, 280))}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
          placeholder="Write a little note..."
          className="flex-1 px-4 py-3 rounded-full bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder-white/25 outline-none"
          style={{ fontFamily: 'Poppins, sans-serif' }}
          data-testid="note-input"
        />
        <button onClick={handleSend} disabled={sending || !draft.trim()}
          className="w-12 h-12 rounded-full flex items-center justify-center disabled:opacity-40 shrink-0"
          style={{ background: '#FF4F9A' }} data-testid="note-send">
          <Send className="w-5 h-5 text-white" />
        </button>
      </div>
    </div>
  );
}

function CalendarTab({ markedDays }) {
  const [viewDate, setViewDate] = useState(new Date());
  const y = viewDate.getFullYear(), m = viewDate.getMonth();
  const firstDay = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const markMap = {};
  (markedDays || []).forEach(md => { markMap[md.date] = md.kind; });
  const fmt = (d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div data-testid="partner-calendar">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setViewDate(new Date(y, m - 1, 1))} className="px-3 py-1.5 rounded-full text-white/80 text-sm border border-white/10">‹</button>
        <span className="text-white text-base" style={{ fontFamily: "'Poiret One', sans-serif" }}>
          {viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </span>
        <button onClick={() => setViewDate(new Date(y, m + 1, 1))} className="px-3 py-1.5 rounded-full text-white/80 text-sm border border-white/10">›</button>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <span key={i} className="text-center text-white/25 text-[10px] py-1" style={{ fontFamily: 'Poppins, sans-serif' }}>{d}</span>
        ))}
        {Array.from({ length: firstDay }).map((_, i) => <span key={`e${i}`} />)}
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
          const ds = fmt(day);
          const kind = markMap[ds];
          const st = kind ? KIND_STYLES[kind] : null;
          return (
            <div key={day}
              className="aspect-square rounded-lg flex items-center justify-center text-sm"
              style={{
                background: st ? st.bg : 'transparent',
                color: ds === todayStr ? '#fff' : '#d4d4e0',
                fontFamily: 'Poppins, sans-serif',
                border: ds === todayStr ? '1px solid rgba(255,255,255,0.4)' : '1px solid transparent',
                fontWeight: kind === 'ovulation' ? '700' : '400'
              }}>
              {day}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-3 mt-4">
        {Object.entries(KIND_STYLES).map(([k, st]) => (
          <span key={k} className="flex items-center gap-1.5 text-white/75 text-[10px]" style={{ fontFamily: 'Poppins, sans-serif' }}>
            <span className="w-3 h-3 rounded" style={{ background: st.bg }} />
            {st.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// v49 (Angelita, Oct 26, 2026): her journal, readable here only
// because she turned journal sharing on. Read-only. The server
// refuses the moment she turns it off, and this tab explains that
// instead of failing quietly.
function PartnerJournalTab({ token, partnerName }) {
  const [data, setData] = useState(null);
  const [state, setState] = useState('loading'); // loading | ok | off | error

  useEffect(() => {
    let live = true;
    axios.get(`${API}/partner/journal`, { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 })
      .then((res) => { if (live) { setData(res.data); setState('ok'); } })
      .catch((err) => {
        if (!live) return;
        setState(err.response?.status === 403 ? 'off' : 'error');
      });
    return () => { live = false; };
  }, [token]);

  if (state === 'loading') {
    return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-[#f4a7b9] animate-spin" /></div>;
  }
  if (state === 'off') {
    return (
      <p className="text-center text-[#CFC3CC] text-sm leading-relaxed py-6" style={{ fontFamily: 'Poppins, sans-serif' }} data-testid="partner-journal-off">
        {partnerName || 'She'} has not chosen to share her journal. It stays hers unless she turns sharing on.
      </p>
    );
  }
  if (state === 'error') {
    return (
      <p className="text-center text-[#CFC3CC] text-sm py-6" style={{ fontFamily: 'Poppins, sans-serif' }}>
        Her journal could not be loaded just now. Please try again in a moment.
      </p>
    );
  }
  const days = data?.days || [];
  if (!days.length) {
    return (
      <p className="text-center text-[#CFC3CC] text-sm py-6" style={{ fontFamily: 'Poppins, sans-serif' }} data-testid="partner-journal-empty">
        Nothing written yet. When she writes in her journal, her pages will appear here.
      </p>
    );
  }
  return (
    <div className="space-y-4" data-testid="partner-journal">
      <p className="text-center text-[#CFC3CC] text-xs" style={{ fontFamily: 'Poppins, sans-serif' }}>
        She chose to share her journal with you. These pages are read only.
      </p>
      {days.map((d) => (
        <div key={d.date} className="rounded-2xl p-4 border border-white/[0.06] bg-white/[0.03]">
          <p className="text-lg mb-2" style={{ fontFamily: "'Poiret One', sans-serif", color: '#FF4F9A' }}>
            {new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
          <div className="space-y-3">
            {d.entries.map((e) => (
              <div key={e.id}>
                {e.title ? (
                  <p className="text-white text-sm font-medium" style={{ fontFamily: 'Poppins, sans-serif' }}>{e.title}</p>
                ) : null}
                <p className="text-[#E6E0EE] text-sm leading-relaxed whitespace-pre-wrap" style={{ fontFamily: 'Poppins, sans-serif' }}>{e.content}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// v54 (Angelita, Oct 30, 2026): her intimacy log, readable here only
// because she turned intimacy sharing on (she reversed the old
// never-shared rule). Read-only. The server refuses the moment she
// turns it off, and this tab explains that instead of failing quietly.
function PartnerIntimacyTab({ token, partnerName }) {
  const [data, setData] = useState(null);
  const [state, setState] = useState('loading'); // loading | ok | off | error

  useEffect(() => {
    let live = true;
    axios.get(`${API}/partner/intimacy`, { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 })
      .then((res) => { if (live) { setData(res.data); setState('ok'); } })
      .catch((err) => {
        if (!live) return;
        setState(err.response?.status === 403 ? 'off' : 'error');
      });
    return () => { live = false; };
  }, [token]);

  if (state === 'loading') {
    return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-[#f4a7b9] animate-spin" /></div>;
  }
  if (state === 'off') {
    return (
      <p className="text-center text-[#CFC3CC] text-sm leading-relaxed py-6" style={{ fontFamily: 'Poppins, sans-serif' }} data-testid="partner-intimacy-off">
        {partnerName || 'She'} has not chosen to share her intimacy log. It stays private unless she turns sharing on.
      </p>
    );
  }
  if (state === 'error') {
    return (
      <p className="text-center text-[#CFC3CC] text-sm py-6" style={{ fontFamily: 'Poppins, sans-serif' }}>
        Her intimacy log could not be loaded just now. Please try again in a moment.
      </p>
    );
  }
  const days = data?.days || [];
  if (!days.length) {
    return (
      <p className="text-center text-[#CFC3CC] text-sm py-6" style={{ fontFamily: 'Poppins, sans-serif' }} data-testid="partner-intimacy-empty">
        No intimacy days logged yet. When she logs one, it will appear here.
      </p>
    );
  }
  return (
    <div className="space-y-4" data-testid="partner-intimacy">
      <p className="text-center text-[#CFC3CC] text-xs" style={{ fontFamily: 'Poppins, sans-serif' }}>
        She chose to share her intimacy log with you. This is read only.
      </p>
      {days.map((d) => (
        <div key={d.date} className="rounded-2xl p-4 border border-white/[0.06] bg-white/[0.03]">
          <p className="text-lg mb-1 flex items-center gap-2" style={{ fontFamily: "'Poiret One', sans-serif", color: '#FF4F9A' }}>
            <Heart className="w-4 h-4" fill="#FF4F9A" />
            {new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
          {d.partners ? (
            <p className="text-[#E6E0EE] text-sm leading-relaxed" style={{ fontFamily: 'Poppins, sans-serif' }}>{d.partners}</p>
          ) : null}
          {d.notes ? (
            <p className="text-[#CFC3CC] text-sm leading-relaxed whitespace-pre-wrap" style={{ fontFamily: 'Poppins, sans-serif' }}>{d.notes}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

// v55: the partner is ASKED, here in their own hub, whether they want
// the daily partner note reminder on their own phone (Angelita, Oct
// 30, 2026). Their opt-in, their time (default 9 AM). Saving writes
// the same local keys and the same PUT /profile merge as every other
// notification choice, then reschedules on this device. The reminder
// itself is generic and only ever schedules while she shares her
// phase (the gate lives in utils/notificationPlan.js).
function PartnerDailyReminderCard({ user, token }) {
  const prefs = getNotificationPrefs(user);
  const [enabled, setEnabled] = useState(prefs.partnerDaily);
  const [time, setTime] = useState(prefs.partnerTime || '09:00');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const save = async (nextEnabled, nextTime) => {
    setEnabled(nextEnabled);
    setTime(nextTime);
    setSaving(true);
    setMsg('');
    const mergedPrefs = { ...(user.notification_preferences || {}), partner_daily_note: nextEnabled, partner_daily_time: nextTime };
    try {
      localStorage.setItem('hormoscope-notifications-partner-daily', nextEnabled ? 'true' : 'false');
      localStorage.setItem('hormoscope-notification-partner-time', nextTime);
    } catch (e) { /* storage unavailable: the server fields below still save */ }
    try {
      await axios.put(`${API}/profile`, { notification_preferences: mergedPrefs }, { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 });
    } catch (err) {
      logger.error('Partner daily reminder save failed:', err);
    }
    try {
      await syncLocalNotifications({
        user: { ...user, notification_preferences: mergedPrefs },
        token,
        requestPermission: nextEnabled,
      });
    } catch (err) {
      logger.error('Partner daily reminder sync failed:', err);
    }
    setSaving(false);
    setMsg(nextEnabled ? 'Saved. Your daily reminder is on.' : 'Saved. Your daily reminder is off.');
  };

  const row = 'flex items-center gap-3 py-1.5 text-sm text-[#F7F4FA] cursor-pointer';
  return (
    <div className="rounded-3xl p-5 border border-white/10 mb-4" style={{ background: '#15152B', fontFamily: 'Poppins, sans-serif' }} data-testid="partner-daily-reminder">
      <div className="flex items-start gap-3 mb-2">
        <div className="w-10 h-10 rounded-full bg-[#FF4F9A]/20 flex items-center justify-center shrink-0">
          <Bell className="w-5 h-5 text-[#FF4F9A]" />
        </div>
        <div className="flex-1">
          <p className="text-[#F4D3DC] text-sm font-medium">Your daily reminder</p>
          <p className="text-[#CFC3CC] text-xs leading-relaxed">
            Want a daily nudge to check what your person is wishing for today? It only ever says to log in and look. The note itself waits for you here, never on your lock screen.
          </p>
        </div>
      </div>
      <label className={row}>
        <input type="checkbox" className="w-4 h-4 accent-[#FF4F9A]" checked={enabled} disabled={saving}
          onChange={(e) => save(e.target.checked, time)} data-testid="partner-daily-toggle" />
        Daily partner note reminder
      </label>
      <select value={time} disabled={!enabled || saving} onChange={(e) => save(enabled, e.target.value)}
        className="w-full rounded-xl px-3 py-2.5 bg-white/5 border border-white/15 text-white disabled:opacity-50" data-testid="partner-daily-time">
        {NOTIFICATION_TIMES.map((t) => <option key={t.time} value={t.time} className="bg-[#15152B]">{t.label}</option>)}
      </select>
      {msg && <p className="text-sm text-[#E6E0EE] mt-2" role="status">{msg}</p>}
    </div>
  );
}

export default function PartnerHubPage() {
  const { token, user } = useAuth();
  const { loading: rcLoading } = usePremium();
  const [status, setStatus] = useState(null);
  const [calData, setCalData] = useState(null);
  const [syncData, setSyncData] = useState(null);
  const [tab, setTab] = useState('cycle');
  const [inviteCode, setInviteCode] = useState('');
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState(null);
  const [unread, setUnread] = useState(0);

  const loadStatus = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/partner/status`, { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 });
      setStatus(res.data);
      if (res.data.is_linked) {
        const c = await axios.get(`${API}/partner/calendar`, { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 });
        setCalData(c.data);
        // The sync payload carries the owner's side (v46): when she
        // no longer has periods it holds her logged days, which the
        // Cycle tab shows instead of a cycle.
        try {
          const s = await axios.get(`${API}/partner/sync`, { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 });
          setSyncData(s.data);
        } catch (syncErr) {
          logger.error('Partner sync load error:', syncErr);
        }
      }
    } catch (err) {
      logger.error('Partner hub load error:', err);
      setStatus({ is_linked: false });
    }
  }, [token]);

  useEffect(() => {
    if (token) loadStatus();
  }, [token, loadStatus]);

  const handleAccept = async () => {
    const code = inviteCode.trim();
    if (!code || accepting) return;
    // Picture gate (v42): the form is hidden without a picture, and
    // this refuses here too so no path accepts an invite pictureless.
    if (!user?.profile_photo) {
      setAcceptError('Add your profile picture first: tap "Add my picture" above.');
      return;
    }
    setAccepting(true);
    setAcceptError(null);
    try {
      await axios.post(`${API}/partner/accept-invite`, { invite_code: code }, { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 });
      setInviteCode('');
      loadStatus();
    } catch (err) {
      setAcceptError(err.response?.data?.detail || 'Could not link with that code.');
    } finally {
      setAccepting(false);
    }
  };

  if (status === null || rcLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0B0B1E' }}>
        <Loader2 className="w-8 h-8 text-[#f4a7b9] animate-spin" />
      </div>
    );
  }

  // Hub access follows the link itself. Entitlement is enforced on the
  // server when an invite is created (a woman invite is free; a man or
  // untyped invite requires Pro), so a linked user, owner or partner,
  // free or Pro, always reaches the shared calendar and notes here.
  // Not linked: invite-code entry
  if (!status.is_linked) {
    return (
      <div className="min-h-screen px-5 py-10 pb-24" style={{ background: '#0B0B1E' }}>
        <div className="max-w-md mx-auto text-center">
          <div className="w-16 h-16 rounded-full bg-[#FF4F9A]/15 flex items-center justify-center mx-auto mb-5">
            <Link2 className="w-7 h-7 text-[#FF4F9A]" />
          </div>
          <p className="text-[10px] tracking-widest uppercase mb-2" style={{ fontFamily: 'Poppins, sans-serif', color: '#f4a7b9' }}>
            Attunement Mode
          </p>
          <h1 className="text-2xl text-white mb-3" style={{ fontFamily: "'Poiret One', sans-serif" }}>Link Your Accounts</h1>
          <p className="text-[#CFC3CC] text-sm mb-6 leading-relaxed" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Ask her for the invite code from her Attunement tab, then enter it below. You will be able to follow her cycle —
            ovulation days, fertile window, and when to expect her period.
          </p>
          {!user?.profile_photo ? (
            /* v42 (Angelita, Oct 25, 2026): a picture is mandatory to
               sync, on the accepting side too. No picture, no link: she
               adds one first, so the person she syncs with sees her
               face beside her name. */
            <div className="rounded-3xl p-6 border border-white/10 mb-3" style={{ background: '#15152B' }} data-testid="photo-required">
              <div className="w-12 h-12 rounded-full bg-[#FF4F9A]/15 flex items-center justify-center mx-auto mb-3">
                <Camera className="w-5 h-5 text-[#FF4F9A]" />
              </div>
              <h2 className="text-white text-xl mb-2" style={{ fontFamily: "'Poiret One', sans-serif" }}>Add your picture first</h2>
              <p className="text-[#CFC3CC] text-sm leading-relaxed mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
                A profile picture is required to sync your cycle, so your partner can see who they are syncing with. Add yours, then come back and enter the code.
              </p>
              <Link to="/profile" className="block w-full py-3 rounded-full text-white text-sm font-medium" style={{ fontFamily: 'Poppins, sans-serif', background: '#FF4F9A' }} data-testid="photo-required-btn">
                Add my picture
              </Link>
            </div>
          ) : (
          <>
          <input
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value.toUpperCase().slice(0, 8))}
            placeholder="INVITE CODE"
            className="w-full px-5 py-4 rounded-2xl bg-white/[0.04] border border-white/[0.1] text-white text-center text-xl tracking-[0.3em] placeholder-white/20 outline-none mb-3"
            style={{ fontFamily: 'Poppins, sans-serif' }}
            data-testid="invite-code-input"
          />
          {acceptError && (
            <p className="text-red-400 text-xs mb-3" style={{ fontFamily: 'Poppins, sans-serif' }}>{acceptError}</p>
          )}
          <button onClick={handleAccept} disabled={accepting || !inviteCode.trim()}
            className="w-full py-3.5 rounded-full text-white text-sm font-medium disabled:opacity-40"
            style={{ fontFamily: 'Poppins, sans-serif', background: '#FF4F9A' }}
            data-testid="accept-invite-btn">
            {accepting ? 'Linking...' : 'Link Accounts'}
          </button>
          </>
          )}
          <p className="text-[#B4B0C8] text-[10px] mt-6 leading-relaxed" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Her intimacy log is private unless she chooses to share it. You only see what she chose to share.
          </p>
        </div>
      </div>
    );
  }

  const phasePair = PHASE_PAIRS[calData?.phase] || PHASE_PAIRS.unknown;
  const phaseColor = phasePair.primary;
  const tips = calData?.partner_tips;
  // Feature B (v46): the cycle OWNER's sync block. When she no longer
  // has periods, her Cycle tab is her logged days, not a cycle strip.
  const ownerBlock = syncData ? (status.role === 'owner' ? syncData.me : syncData.them) : null;
  const ownerNoPeriods = !!ownerBlock?.no_periods;

  return (
    <div className="min-h-screen px-5 py-8 pb-28" style={{ background: '#0B0B1E' }} data-testid="partner-hub">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-6">
          <p className="text-[10px] tracking-widest uppercase mb-2" style={{ fontFamily: 'Poppins, sans-serif', color: '#f4a7b9' }}>
            Attunement Mode
          </p>
          {/* Her face beside her name (v42): the cycle belongs to a
              person, and her partner sees who it is. */}
          {calData && (
            <div className="flex justify-center mb-2">
              <PartnerAvatar photo={calData.profile_photo || status.partner_photo} name={calData.name || status.partner_name} size={52} />
            </div>
          )}
          <h1 className="text-2xl text-white mb-1" style={{ fontFamily: "'Poiret One', sans-serif" }}>
            {calData ? (ownerNoPeriods ? `${calData.name}'s Days` : `${calData.name}'s Cycle`) : 'Partner Hub'}
          </h1>
          {status.role === 'owner' && (
            <p className="text-[#CFC3CC] text-xs" style={{ fontFamily: 'Poppins, sans-serif' }}>
              Linked with {status.partner_name} · this is what they see
            </p>
          )}
        </div>

        {/* Two-cycle sync: shows both cycles when both share their phase */}
        {status.role === 'partner' && <CycleSync token={token} />}

        {/* The daily reminder ask lives with the partner, not the owner */}
        {status.role === 'partner' && <PartnerDailyReminderCard user={user} token={token} />}

        {/* Tabs — Notes sits here quietly, discovered naturally */}
        <div className="flex gap-2 mb-6">
          {[
            { id: 'cycle', label: 'Cycle', icon: Heart },
            { id: 'calendar', label: 'Calendar', icon: CalendarIcon },
            { id: 'notes', label: 'Notes', icon: null },
            ...(status.partner_shares_journal ? [{ id: 'journal', label: 'Journal', icon: BookOpen }] : []),
            ...(status.partner_shares_intimacy ? [{ id: 'intimacy', label: 'Intimacy', icon: Heart }] : []),
          ].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className="flex-1 py-2.5 rounded-full text-sm font-medium relative"
                style={{
                  fontFamily: 'Poppins, sans-serif',
                  background: tab === t.id ? '#FF4F9A' : 'rgba(255,255,255,0.04)',
                  color: tab === t.id ? '#fff' : 'rgba(255,255,255,0.5)',
                  border: '1px solid rgba(255,255,255,0.08)'
                }}
                data-testid={`hub-tab-${t.id}`}>
                {t.label}
                {t.id === 'notes' && unread > 0 && (
                  <span className="absolute top-1.5 right-3 w-2 h-2 rounded-full" style={{ background: '#55efc4' }} />
                )}
              </button>
          ))}
        </div>

        {tab === 'cycle' && ownerNoPeriods && (
          <div data-testid="partner-logged-days">
            <p className="text-center text-[#E6E0EE] text-sm mb-5" style={{ fontFamily: 'Poppins, sans-serif' }}>
              She no longer has periods, so there is no cycle to show. These are her days, from what she logs.
            </p>
            {!ownerBlock.shared ? (
              <p className="text-center text-[#CFC3CC] text-sm" style={{ fontFamily: 'Poppins, sans-serif' }}>She is keeping her days private right now.</p>
            ) : (ownerBlock.log_days || []).filter((d) => d.logged).length === 0 ? (
              <p className="text-center text-[#CFC3CC] text-sm" style={{ fontFamily: 'Poppins, sans-serif' }}>Nothing logged in the last few weeks yet.</p>
            ) : (
              <div className="space-y-3">
                {(ownerBlock.log_days || []).filter((d) => d.logged).map((d) => {
                  const bits = [];
                  if (d.feelings?.length) bits.push(`Feeling ${d.feelings.join(', ')}`);
                  if (d.mood) bits.push(`Mood: ${d.mood}`);
                  if (d.symptoms?.length) bits.push(d.symptoms.join(', '));
                  if (d.flow) bits.push(`Flow: ${d.flow}`);
                  if (d.is_period) bits.push('Period day');
                  return (
                    <div key={d.date} className="rounded-2xl p-4 border border-white/[0.06] bg-white/[0.03]">
                      <p className="text-[#f4a7b9] text-xs mb-1" style={{ fontFamily: 'Poppins, sans-serif' }}>
                        {new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </p>
                      <p className="text-white text-sm leading-relaxed" style={{ fontFamily: 'Poppins, sans-serif' }}>
                        {bits.length ? bits.join(' · ') : 'She logged this day'}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="text-center mt-6">
              <div className="flex items-center justify-center gap-1.5">
                <Shield className="w-3 h-3 text-[#B4B0C8]" />
                <span className="text-[#B4B0C8] text-[10px]" style={{ fontFamily: 'Poppins, sans-serif' }}>You only see what she chose to share.</span>
              </div>
            </div>
          </div>
        )}

        {tab === 'cycle' && calData && syncData && !ownerNoPeriods && (
          <div>
            <div className="flex flex-col items-center mb-8">
              <div className="w-32 h-32 rounded-full flex flex-col items-center justify-center"
                style={{ background: `linear-gradient(135deg, ${phasePair.primary}40, ${phasePair.secondary}30)`, boxShadow: `0 0 40px ${phasePair.secondary}30` }}>
                <span className="text-white/70 text-[10px] tracking-widest uppercase" style={{ fontFamily: 'Poppins, sans-serif' }}>Day</span>
                <span className="text-5xl font-bold text-white">{calData.cycle_day}</span>
              </div>
              <h2 className="mt-4 text-xl" style={{ fontFamily: "'Poiret One', sans-serif", color: phaseColor }}>
                {PHASE_NAMES[calData.phase] || calData.phase}
              </h2>
              {calData.next_period_date && (
                <p className="text-[#CFC3CC] text-xs mt-1" style={{ fontFamily: 'Poppins, sans-serif' }}>
                  Next period {calData.days_until_period === 0 ? 'expected today' : `in ${calData.days_until_period} days`} · {calData.next_period_date}
                </p>
              )}
              {calData.ovulation_date && (
                <p className="text-[#CFC3CC] text-xs mt-1" style={{ fontFamily: 'Poppins, sans-serif' }}>
                  Ovulation around {calData.ovulation_date}
                </p>
              )}
            </div>

            {/* Partner Daily Note: today's one line for the partner,
                present only while she shares her phase. */}
            {calData.partner_daily_note && (
              <div className="rounded-2xl p-5 mb-4 border border-white/[0.06] bg-white/[0.03]" data-testid="partner-daily-note">
                <h3 className="text-lg mb-2" style={{ fontFamily: "'Poiret One', sans-serif", color: '#f4a7b9' }}>For you, today</h3>
                <p className="text-white text-sm leading-relaxed mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>{calData.partner_daily_note.text}</p>
                <p className="text-[#E6E0EE] text-sm leading-relaxed" style={{ fontFamily: 'Poppins, sans-serif' }}>{calData.partner_daily_note.prompt}</p>
              </div>
            )}

            {tips && (
              <>
                <div className="rounded-2xl p-5 mb-4 text-center" style={{ background: `${phaseColor}10`, border: `1px solid ${phaseColor}25` }}>
                  <p className="text-white text-base font-medium" style={{ fontFamily: 'Poppins, sans-serif' }}>{tips.headline}</p>
                </div>
                <div className="rounded-2xl p-5 mb-4 border border-white/[0.06] bg-white/[0.03]">
                  <p className="text-[10px] tracking-widest uppercase mb-2" style={{ fontFamily: 'Poppins, sans-serif', color: '#f4a7b9' }}>Conversation</p>
                  <p className="text-white text-sm leading-relaxed" style={{ fontFamily: 'Poppins, sans-serif' }}>{tips.conversation}</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                  <div className="rounded-2xl p-5 border border-white/[0.06] bg-white/[0.03]">
                    <p className="text-[10px] tracking-widest uppercase mb-3" style={{ fontFamily: 'Poppins, sans-serif', color: '#55efc4' }}>Do</p>
                    <div className="space-y-2">
                      {tips.do.map((item) => (
                        <p key={`do-${item}`} className="text-[#d4d4e0] text-xs leading-relaxed" style={{ fontFamily: 'Poppins, sans-serif' }}>+ {item}</p>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-2xl p-5 border border-white/[0.06] bg-white/[0.03]">
                    <p className="text-[10px] tracking-widest uppercase mb-3" style={{ fontFamily: 'Poppins, sans-serif', color: '#ff6b6b' }}>Avoid</p>
                    <div className="space-y-2">
                      {tips.avoid.map((item) => (
                        <p key={`avoid-${item}`} className="text-[#d4d4e0] text-xs leading-relaxed" style={{ fontFamily: 'Poppins, sans-serif' }}>- {item}</p>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
            <div className="text-center mt-6">
              <div className="flex items-center justify-center gap-1.5">
                <Shield className="w-3 h-3 text-[#B4B0C8]" />
                <span className="text-[#B4B0C8] text-[10px]" style={{ fontFamily: 'Poppins, sans-serif' }}>You only see what she chose to share.</span>
              </div>
            </div>
          </div>
        )}

        {tab === 'cycle' && !ownerNoPeriods && (!calData || !syncData) && (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-[#f4a7b9] animate-spin" /></div>
        )}

        {tab === 'calendar' && <CalendarTab markedDays={calData?.marked_days} />}

        {tab === 'notes' && <NotesTab token={token} currentUserId={user?.id} onUnreadChange={setUnread} />}

        {tab === 'journal' && <PartnerJournalTab token={token} partnerName={status.partner_name} />}

        {tab === 'intimacy' && <PartnerIntimacyTab token={token} partnerName={status.partner_name} />}

      </div>
    </div>
  );
}
