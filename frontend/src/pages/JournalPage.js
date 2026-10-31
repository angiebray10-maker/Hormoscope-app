import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { Trash2, ChevronLeft, ChevronRight, Heart, Droplet, Calendar, Lock } from 'lucide-react';
import axios from 'axios';
import logger from '../utils/logger';
import { PHASE_PAIRS, PHASE_NAMES, phaseTint, phaseForDate } from '../lib/phases';
import FloatingCarousel from '../components/FloatingCarousel';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const GOLD = '#C9B8F0';
const MENSTRUAL_TINT = PHASE_PAIRS.menstrual.primary;
const OVULATION_TINT = PHASE_PAIRS.ovulatory.secondary;
// The pretty blue for logged days (Angelita, Oct 30, 2026): any day she
// logged anything lights up in this blue on the Journal calendars.
const LOGGED_BLUE = '#74B9FF';
// Journal ENTRY text only (Angelita, Oct 29): her own handwriting feel,
// Architects Daughter, self-hosted. Headings stay Poiret One and all
// other journal UI text stays Poppins; the .journal-handwriting class
// in index.css carries the app pink ink (#F74093) and the slight tilt.
const SERIF = "'Architects Daughter', 'Poppins', cursive";
const POPPINS = { fontFamily: 'Poppins, sans-serif' };
const POIRET = { fontFamily: "'Poiret One', sans-serif" };
const FLOW_OPTIONS = ['light', 'medium', 'heavy'];

const todayISO = () => new Date().toISOString().split('T')[0];
const fmtDayLong = (dateStr) => new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
const fmtTime = (iso) => (iso ? new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '');

function MiniCalendar({ token, user, selectedDate, onSelectDate, onClose }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [cycleLogs, setCycleLogs] = useState([]);
  const [intimacyLogs, setIntimacyLogs] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [loggedDays, setLoggedDays] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [c, i, d, j] = await Promise.all([
          axios.get(`${API}/cycle-logs`, { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 }),
          axios.get(`${API}/intimacy-logs`, { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 }),
          axios.get(`${API}/dashboard`, { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 }).catch(() => ({ data: null })),
          axios.get(`${API}/journal/logged-days`, { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 }).catch(() => ({ data: null }))
        ]);
        setCycleLogs(c.data || []);
        setIntimacyLogs(i.data || []);
        setDashboard(d.data || null);
        setLoggedDays(j.data?.logged_days || []);
      } catch (err) { logger.error('Failed to fetch calendar data:', err); }
    };
    if (token) fetchData();
  }, [token]);

  const getNextPeriodDate = () => {
    if (dashboard?.cycle_info?.next_period_date) return dashboard.cycle_info.next_period_date;
    if (!user?.last_period_date) return null;
    const cycleLen = user.cycle_length || 28;
    const next = new Date(user.last_period_date + 'T00:00:00');
    const todayD = new Date();
    todayD.setHours(0, 0, 0, 0);
    while (next <= todayD) next.setDate(next.getDate() + cycleLen);
    return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
  };
  const ovulationWindow = () => {
    const npd = getNextPeriodDate();
    if (!npd) return null;
    const cycleLen = user?.cycle_length || 28;
    const ov = new Date(npd + 'T00:00:00');
    ov.setDate(ov.getDate() - (cycleLen - 14));
    const start = new Date(ov);
    start.setDate(start.getDate() - 5);
    const end = new Date(ov);
    end.setDate(end.getDate() + 1);
    return { ov, start, end };
  };
  const isOvulation = (d) => {
    const w = ovulationWindow();
    if (!w) return false;
    const check = new Date(fmt(d) + 'T00:00:00');
    return check >= w.start && check <= w.end;
  };
  const isPeak = (d) => {
    const w = ovulationWindow();
    if (!w) return false;
    const check = new Date(fmt(d) + 'T00:00:00');
    const diff = Math.floor((check - w.ov) / (1000 * 60 * 60 * 24));
    return diff >= -1 && diff <= 0;
  };

  const y = currentMonth.getFullYear(), m = currentMonth.getMonth();
  const firstDay = new Date(y, m, 1).getDay();
  const days = new Date(y, m + 1, 0).getDate();
  const fmt = (d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const isPeriod = (d) => cycleLogs.some(l => l.date === fmt(d) && l.is_period);
  const isIntimacy = (d) => intimacyLogs.some(l => l.date === fmt(d));
  const loggedSet = new Set(loggedDays);
  const isLogged = (d) => loggedSet.has(fmt(d));
  const today = todayISO();

  return (
    <div className="rounded-xl p-2.5 w-56" style={{ background: 'rgba(20,15,30,0.97)', border: '1px solid rgba(255,79,154,0.2)', backdropFilter: 'blur(20px)', boxShadow: '0 10px 40px rgba(0,0,0,0.5)' }}>
      <div className="flex items-center justify-between mb-1.5">
        <button onClick={() => setCurrentMonth(new Date(y, m - 1))} className="p-0.5 text-white/70"><ChevronLeft className="w-3 h-3" /></button>
        <span className="text-[9px] text-white/80" style={POPPINS}>{currentMonth.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
        <button onClick={() => setCurrentMonth(new Date(y, m + 1))} className="p-0.5 text-white/70"><ChevronRight className="w-3 h-3" /></button>
      </div>
      <div className="grid grid-cols-7 gap-px">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <span key={`dow-${i}-${d}`} className="text-[7px] text-center text-white/25" style={POPPINS}>{d}</span>)}
        {Array.from({ length: firstDay }).map((_, i) => <span key={`e${i}`} />)}
        {Array.from({ length: days }, (_, i) => i + 1).map(day => {
          const ds = fmt(day), sel = selectedDate === ds, td = ds === today;
          const ov = !sel && !isPeriod(day) && isOvulation(day);
          const pk = ov && isPeak(day);
          const logged = isLogged(day);
          const tint = phaseTint(phaseForDate(ds, user?.last_period_date, user?.cycle_length || 28));
          return (
            <button key={day} onClick={() => { onSelectDate(ds); onClose(); }}
              className="relative w-6 h-6 flex flex-col items-center justify-center rounded text-[8px]"
              style={{ background: sel ? '#FF4F9A' : isPeriod(day) ? `${MENSTRUAL_TINT}40` : pk ? `${OVULATION_TINT}66` : ov ? `${OVULATION_TINT}38` : logged ? 'rgba(116,185,255,0.20)' : td ? 'rgba(255,255,255,0.08)' : 'transparent', color: sel ? '#fff' : tint, opacity: 1, fontFamily: 'Poppins, sans-serif', border: logged && !sel ? `1px solid ${LOGGED_BLUE}` : '1px solid transparent' }}>
              {day}
              {logged && !sel && <span aria-hidden="true" style={{ width: 8, height: 2, borderRadius: 2, background: tint, marginTop: 1 }} />}
              {isIntimacy(day) && <Heart className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5" style={{ color: '#FF4F9A' }} fill="#FF4F9A" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// The month calendar for Browse your days: month by month, every
// logged day outlined in blue with a phase accent in that day's phase
// color, day numbers at full opacity. Tapping a logged day selects it
// and the full day view above shows it.
function BrowseCalendar({ loggedDays, selectedDate, onSelectDay, phaseColorFor, focusMonth }) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = selectedDate ? new Date(selectedDate + 'T12:00:00') : new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  useEffect(() => {
    if (focusMonth) setCurrentMonth(new Date(focusMonth.getFullYear(), focusMonth.getMonth(), 1));
  }, [focusMonth]);
  const y = currentMonth.getFullYear(), m = currentMonth.getMonth();
  const firstDay = new Date(y, m, 1).getDay();
  const days = new Date(y, m + 1, 0).getDate();
  const fmt = (d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const today = todayISO();
  const logged = loggedDays || new Set();
  return (
    <div className="rounded-2xl p-4 mb-6" style={{ background: 'rgba(20,15,30,0.85)', border: '1px solid rgba(116,185,255,0.25)' }} data-testid="journal-calendar">
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setCurrentMonth(new Date(y, m - 1))} className="p-1.5 text-white/70" aria-label="Previous month" data-testid="journal-cal-prev">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm text-white/85" style={POPPINS}>
          {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </span>
        <button onClick={() => setCurrentMonth(new Date(y, m + 1))} className="p-1.5 text-white/70" aria-label="Next month" data-testid="journal-cal-next">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <span key={`bdow-${i}-${d}`} className="text-[10px] text-center text-white/30 py-1" style={POPPINS}>{d}</span>
        ))}
        {Array.from({ length: firstDay }).map((_, i) => <span key={`be${i}`} />)}
        {Array.from({ length: days }, (_, i) => i + 1).map((day) => {
          const ds = fmt(day);
          const isLoggedDay = logged.has(ds);
          const sel = selectedDate === ds;
          const td = ds === today;
          const tint = phaseColorFor ? phaseColorFor(ds) : '#fff';
          return (
            <button
              key={day}
              onClick={() => { if (isLoggedDay) onSelectDay(ds); }}
              disabled={!isLoggedDay}
              className="h-11 flex flex-col items-center justify-center rounded-lg text-sm"
              style={{
                background: sel ? LOGGED_BLUE : isLoggedDay ? 'rgba(116,185,255,0.15)' : 'transparent',
                border: isLoggedDay ? `2px solid ${LOGGED_BLUE}` : '2px solid transparent',
                color: sel ? '#0B0B1E' : tint,
                opacity: 1,
                fontFamily: 'Poppins, sans-serif',
                fontWeight: sel ? 600 : 400,
              }}
              data-testid={`journal-cal-day-${ds}`}
            >
              {day}
              {isLoggedDay && <span aria-hidden="true" style={{ width: 14, height: 3, borderRadius: 3, background: sel ? '#0B0B1E' : tint, marginTop: 2 }} />}
            </button>
          );
        })}
      </div>
      <p className="text-[11px] mt-3 text-center" style={{ ...POPPINS, color: '#9CC8F5' }}>
        Days outlined in blue are days you logged something. The little line under a day wears that day&apos;s phase color. Tap one to open it.
      </p>
    </div>
  );
}

// The year view for Browse your days: all twelve months small at
// once. Logged days carry the same blue marking and phase tinted
// numbers; tapping a marked day opens that day, and tapping a month
// name jumps the month view to that month.
function YearCalendar({ year, onYearChange, loggedDays, selectedDate, phaseColorFor, onSelectDay, onPickMonth }) {
  const logged = loggedDays || new Set();
  const months = Array.from({ length: 12 }, (_, i) => i);
  return (
    <div className="rounded-2xl p-4 mb-6" style={{ background: 'rgba(20,15,30,0.85)', border: '1px solid rgba(116,185,255,0.25)' }} data-testid="journal-year-calendar">
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => onYearChange(year - 1)} className="p-1.5 text-white/70" aria-label="Previous year" data-testid="year-cal-prev">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm text-white/85" style={POPPINS}>{year}</span>
        <button onClick={() => onYearChange(year + 1)} className="p-1.5 text-white/70" aria-label="Next year" data-testid="year-cal-next">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {months.map((m) => {
          const firstDay = new Date(year, m, 1).getDay();
          const days = new Date(year, m + 1, 0).getDate();
          const fmt = (d) => `${year}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          return (
            <div key={m}>
              <button
                onClick={() => onPickMonth(new Date(year, m, 1))}
                className="text-[11px] text-white/80 mb-1 underline decoration-white/20 underline-offset-2"
                style={POPPINS}
                data-testid={`year-cal-month-${m}`}
              >
                {new Date(year, m, 1).toLocaleDateString('en-US', { month: 'long' })}
              </button>
              <div className="grid grid-cols-7 gap-px">
                {Array.from({ length: firstDay }).map((_, i) => <span key={`ye${i}`} />)}
                {Array.from({ length: days }, (_, i) => i + 1).map((day) => {
                  const ds = fmt(day);
                  const isLoggedDay = logged.has(ds);
                  const sel = selectedDate === ds;
                  return (
                    <button
                      key={day}
                      onClick={() => { if (isLoggedDay) onSelectDay(ds); }}
                      disabled={!isLoggedDay}
                      className="h-5 flex items-center justify-center rounded text-[9px]"
                      style={{
                        background: sel ? LOGGED_BLUE : isLoggedDay ? 'rgba(116,185,255,0.20)' : 'transparent',
                        border: isLoggedDay ? `1px solid ${LOGGED_BLUE}` : '1px solid transparent',
                        borderBottom: isLoggedDay ? `2px solid ${phaseColorFor ? phaseColorFor(ds) : LOGGED_BLUE}` : undefined,
                        color: sel ? '#0B0B1E' : phaseColorFor ? phaseColorFor(ds) : '#CFC3CC',
                        opacity: 1,
                        fontFamily: 'Poppins, sans-serif',
                        fontWeight: isLoggedDay ? 600 : 400,
                      }}
                      data-testid={`year-cal-day-${ds}`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] mt-3 text-center" style={{ ...POPPINS, color: '#9CC8F5' }}>
        Your whole year at a glance. Days outlined in blue are days you logged something. Tap one to open that day.
      </p>
    </div>
  );
}

export default function JournalPage() {
  const { token, user, updateUser } = useAuth();
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [showCal, setShowCal] = useState(false);
  const [dayData, setDayData] = useState({ entries: [], logs: [], intimacy: null });
  const [dayLoading, setDayLoading] = useState(true);
  const [dayError, setDayError] = useState(false);
  const [allLogs, setAllLogs] = useState([]);
  const [intimacyLogs, setIntimacyLogs] = useState([]);
  const [cycleStats, setCycleStats] = useState(null);
  const [loggedDays, setLoggedDays] = useState(null);
  // The note: the writing area in the day view. Saving it files a
  // journal entry to the selected day, and that entry IS the day's
  // journal entry, shown in the day view below.
  const [note, setNote] = useState('');
  const [noteTitle, setNoteTitle] = useState('');
  const [noteIntimate, setNoteIntimate] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [noteError, setNoteError] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);
  const [flowChoice, setFlowChoice] = useState('medium');
  const [periodBusy, setPeriodBusy] = useState(false);
  const [partnerNames, setPartnerNames] = useState('');
  const [intimacyBusy, setIntimacyBusy] = useState(false);
  const [intimacyMsg, setIntimacyMsg] = useState('');
  // Browse your days: month or year at a glance.
  const [browseView, setBrowseView] = useState('month'); // month | year
  const [browseYear, setBrowseYear] = useState(() => new Date().getFullYear());
  const [browseFocus, setBrowseFocus] = useState(null);

  const firstName = (user?.name || '').trim().split(/\s+/).filter(Boolean)[0] || null;
  const auth = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` }, timeout: 15000 }), [token]);
  const phaseColorFor = useCallback(
    (ds) => phaseTint(phaseForDate(ds, user?.last_period_date, user?.cycle_length || 28)),
    [user?.last_period_date, user?.cycle_length]
  );
  const selectedPhase = phaseForDate(selectedDate, user?.last_period_date, user?.cycle_length || 28);
  const selectedPhaseColor = phaseTint(selectedPhase);

  // Same refresh CalendarPage does on mount: pull the fresh user
  // record so last_period_date is current and phase colors paint
  // right, instead of the stale copy from sign-in.
  const refreshUser = useCallback(async () => {
    if (!token) return;
    try {
      const res = await axios.get(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { _t: Date.now() },
        timeout: 15000
      });
      if (res.data) updateUser(res.data);
    } catch (err) { logger.error('Refresh user error:', err); }
  }, [token, updateUser]);

  const fetchLoggedDays = useCallback(async () => {
    if (!token) return;
    try {
      const res = await axios.get(`${API}/journal/logged-days`, auth);
      // logged_days includes intimacy days (Package B contract).
      setLoggedDays(new Set(res.data?.logged_days || []));
    } catch (err) {
      logger.error('Logged days failed:', err);
      setLoggedDays(new Set());
    }
  }, [token, auth]);

  const fetchAllLogs = useCallback(async () => {
    if (!token) return;
    try {
      const [c, i] = await Promise.all([
        axios.get(`${API}/cycle-logs`, auth).catch(() => ({ data: [] })),
        axios.get(`${API}/intimacy-logs`, auth).catch(() => ({ data: [] }))
      ]);
      setAllLogs(Array.isArray(c.data) ? c.data : []);
      setIntimacyLogs(Array.isArray(i.data) ? i.data : []);
    } catch (err) { logger.error('Fetch logs failed:', err); }
  }, [token, auth]);

  const fetchCycleStats = useCallback(async () => {
    if (!token) return;
    try {
      const res = await axios.get(`${API}/cycle-stats`, auth);
      setCycleStats(res.data);
    } catch (err) { logger.error('Cycle stats failed:', err); }
  }, [token, auth]);

  const fetchDay = useCallback(async (dateStr) => {
    if (!token) { setDayLoading(false); return; }
    setDayError(false);
    try {
      const res = await axios.get(`${API}/journal/day/${dateStr}`, auth);
      setDayData({
        entries: Array.isArray(res.data?.entries) ? res.data.entries : [],
        logs: Array.isArray(res.data?.logs) ? res.data.logs : [],
        intimacy: Array.isArray(res.data?.intimacy) ? res.data.intimacy : null
      });
    } catch (err) {
      logger.error('Fetch journal day failed:', err);
      setDayError(true);
      setDayData({ entries: [], logs: [], intimacy: null });
    } finally { setDayLoading(false); }
  }, [token, auth]);

  const refreshAll = useCallback(async () => {
    await Promise.all([fetchDay(selectedDate), fetchLoggedDays(), fetchAllLogs(), fetchCycleStats()]);
  }, [fetchDay, fetchLoggedDays, fetchAllLogs, fetchCycleStats, selectedDate]);

  useEffect(() => { refreshUser(); }, [refreshUser]);
  useEffect(() => { fetchLoggedDays(); fetchAllLogs(); fetchCycleStats(); }, [fetchLoggedDays, fetchAllLogs, fetchCycleStats]);
  useEffect(() => { setDayLoading(true); fetchDay(selectedDate); }, [fetchDay, selectedDate]);

  // The day's intimacy, from the day endpoint when it carries it,
  // otherwise from the intimacy logs list.
  const dayIntimacy = useMemo(() => {
    if (Array.isArray(dayData.intimacy)) return dayData.intimacy;
    return intimacyLogs.filter((l) => l.date === selectedDate);
  }, [dayData.intimacy, intimacyLogs, selectedDate]);
  const intimacyLog = dayIntimacy[0] || null;

  useEffect(() => {
    setPartnerNames(intimacyLog?.partners || '');
    setIntimacyMsg('');
    // Only reset the names field when a different day's log loads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intimacyLog?.id, selectedDate]);

  const periodLog = useMemo(() => dayData.logs.find((l) => l.is_period) || null, [dayData.logs]);

  const handleSelectDay = (dateStr) => {
    setSelectedDate(dateStr);
    setNote(''); setNoteTitle(''); setNoteIntimate(false); setNoteError(false); setNoteSaved(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const shiftDay = (delta) => {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() + delta);
    handleSelectDay(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  };

  const handleSaveNote = async () => {
    if (!note.trim() || savingNote) return;
    setSavingNote(true); setNoteError(false); setNoteSaved(false);
    try {
      await axios.post(`${API}/journal`, {
        title: noteTitle.trim() || new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
        content: note,
        is_intimate: noteIntimate,
        date: selectedDate
      }, auth);
      setNote(''); setNoteTitle(''); setNoteIntimate(false);
      setNoteSaved(true);
      await Promise.all([fetchDay(selectedDate), fetchLoggedDays()]);
    } catch (err) {
      logger.error('Failed to save journal entry:', err);
      setNoteError(true);
    } finally { setSavingNote(false); }
  };

  const handleDeleteEntry = async (id) => {
    if (!window.confirm('Delete this entry?')) return;
    try {
      await axios.delete(`${API}/journal/${id}`, auth);
      await Promise.all([fetchDay(selectedDate), fetchLoggedDays()]);
    } catch (err) { logger.error('Failed to delete journal entry:', err); }
  };

  const handleDeleteLog = async (id) => {
    if (!window.confirm('Delete this log?')) return;
    try {
      await axios.delete(`${API}/cycle-logs/${id}`, auth);
      await refreshAll();
      refreshUser();
    } catch (err) { logger.error('Failed to delete cycle log:', err); }
  };

  const handleLogPeriod = async () => {
    if (periodBusy) return;
    setPeriodBusy(true);
    try {
      // Same payload shape the Calendar day view uses.
      await axios.post(`${API}/cycle-logs`, {
        date: selectedDate,
        is_period: true,
        flow: flowChoice
      }, auth);
      await refreshAll();
      refreshUser();
    } catch (err) { logger.error('Log period error:', err); }
    finally { setPeriodBusy(false); }
  };

  const handleRemovePeriod = async () => {
    if (!periodLog || periodBusy) return;
    if (!window.confirm('Remove the period day for this day?')) return;
    setPeriodBusy(true);
    try {
      await axios.delete(`${API}/cycle-logs/${periodLog.id}`, auth);
      await refreshAll();
      refreshUser();
    } catch (err) { logger.error('Remove period error:', err); }
    finally { setPeriodBusy(false); }
  };

  const handleMarkIntimacy = async () => {
    if (intimacyBusy) return;
    setIntimacyBusy(true); setIntimacyMsg('');
    try {
      await axios.post(`${API}/intimacy-logs`, { date: selectedDate }, auth);
      await Promise.all([fetchDay(selectedDate), fetchAllLogs(), fetchLoggedDays()]);
    } catch (err) { logger.error('Log intimacy error:', err); setIntimacyMsg("That didn't save. Try again in a moment."); }
    finally { setIntimacyBusy(false); }
  };

  const handleSavePartners = async () => {
    if (intimacyBusy || !intimacyLog) return;
    setIntimacyBusy(true); setIntimacyMsg('');
    try {
      await axios.post(`${API}/intimacy-logs/update-partners`, {
        date: selectedDate,
        partners: partnerNames.trim()
      }, auth);
      setIntimacyMsg('Saved.');
      await fetchAllLogs();
    } catch (err) { logger.error('Update partners error:', err); setIntimacyMsg("That didn't save. Try again in a moment."); }
    finally { setIntimacyBusy(false); }
  };

  const handleDeleteIntimacy = async () => {
    if (!intimacyLog || intimacyBusy) return;
    if (!window.confirm('Remove the intimacy mark for this day?')) return;
    setIntimacyBusy(true); setIntimacyMsg('');
    try {
      await axios.delete(`${API}/intimacy-logs/${intimacyLog.id}`, auth);
      await Promise.all([fetchDay(selectedDate), fetchAllLogs(), fetchLoggedDays()]);
    } catch (err) { logger.error('Remove intimacy error:', err); }
    finally { setIntimacyBusy(false); }
  };

  // Mood / energy trend: the latest mood:N and energy:N snapshot per
  // logged day, oldest first, from the same symptom prefixes the
  // quick log writes.
  const trendDays = useMemo(() => {
    const byDate = new Map();
    [...allLogs]
      .sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''))
      .forEach((l) => {
        if (!l.date) return;
        const S = Array.isArray(l.symptoms) ? l.symptoms : [];
        const moodTag = S.find((s) => typeof s === 'string' && s.startsWith('mood:'));
        const energyTag = S.find((s) => typeof s === 'string' && s.startsWith('energy:'));
        if (!moodTag && !energyTag) return;
        const cur = byDate.get(l.date) || { date: l.date, mood: null, energy: null };
        if (moodTag) { const v = parseInt(moodTag.slice(5), 10); if (!Number.isNaN(v)) cur.mood = v; }
        if (energyTag) { const v = parseInt(energyTag.slice(7), 10); if (!Number.isNaN(v)) cur.energy = v; }
        byDate.set(l.date, cur);
      });
    return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-14);
  }, [allLogs]);

  // Cycle progression chart, mirroring the Calendar page: both the
  // bleeding length and the cycle length, month to month, newest
  // first, with her usual as a dashed line on each track.
  const chartCycles = useMemo(() => (cycleStats?.recent_cycles || []).slice().reverse(), [cycleStats]);
  const periodCompleted = (c, i) => {
    if (i > 0) return true;
    const end = new Date(c.start + 'T00:00:00');
    end.setDate(end.getDate() + (c.period_length || 1) - 1);
    const t = new Date(); t.setHours(0, 0, 0, 0);
    return end < t;
  };
  const bleedMax = Math.max(10, ...chartCycles.map((c) => c.period_length || 0));
  const cycleRowsForChart = chartCycles.filter((c) => c.cycle_length);
  const cycleMax = Math.max(40, ...cycleRowsForChart.map((c) => c.cycle_length || 0));
  const monthLabel = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

  const trendRow = (label, key) => (
    <div className="mb-4" data-testid={`journal-trend-${key}`}>
      <p className="text-[#CFC3CC] text-[10px] tracking-widest uppercase mb-2" style={POPPINS}>{label}</p>
      <div className="flex items-end gap-2 overflow-x-auto pb-1">
        {trendDays.map((d) => {
          const v = d[key];
          const tint = phaseColorFor(d.date);
          return (
            <div key={`${key}-${d.date}`} className="flex flex-col items-center gap-1 shrink-0" title={`${d.date}: ${v == null ? 'not logged' : `${v}/5`}`}>
              <span className="text-[10px] text-white/80" style={POPPINS}>{v == null ? '·' : v}</span>
              <div className="w-5 rounded-full" style={{ height: v == null ? 6 : 8 + (v / 5) * 30, background: v == null ? 'rgba(255,255,255,0.10)' : tint }} />
              <span className="text-[9px] text-white/40" style={POPPINS}>{new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })}</span>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="relative min-h-screen pb-40 lg:ml-64" style={{ background: 'linear-gradient(180deg, #15152B 0%, #0f0a1a 30%, #0B0B1E 100%)' }} data-testid="journal-page">
      <div className="absolute inset-x-0 bottom-0 pointer-events-none overflow-hidden" aria-hidden="true" data-testid="journal-life-stages-backdrop">
        <img src="/images/life-stages-silhouettes.webp" alt="" className="w-full max-w-3xl mx-auto block" style={{ opacity: 0.13, transform: 'translateX(10px)' }} />
      </div>
      <div className="absolute top-0 left-0 w-full h-64 pointer-events-none overflow-hidden opacity-20">
        <div className="absolute top-4 left-4 text-2xl" style={{ color: '#f4a7b9' }}>✿</div>
        <div className="absolute top-12 right-8 text-xl" style={{ color: '#c9b8f0' }}>✿</div>
        <div className="absolute top-24 left-1/3 text-lg" style={{ color: '#74b9ff' }}>✿</div>
        <div className="absolute top-8 right-1/3 text-sm" style={{ color: '#f4a7b9' }}>✿</div>
        <div className="absolute top-32 right-16 text-2xl" style={{ color: '#c9b8f0' }}>✿</div>
      </div>

      <div className="max-w-2xl mx-auto px-5 pt-6 relative">
        {/* Header Row */}
        <div className="flex items-start justify-between mb-1">
          <div>
            <p className="text-[10px] tracking-widest uppercase" style={{ ...POPPINS, color: '#f4a7b9' }}>Your pages</p>
            <h1 className="text-3xl text-white" style={POIRET}>{firstName ? `${firstName}'s Journal` : 'Journal'}</h1>
          </div>
          <button onClick={() => setShowCal(!showCal)} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ border: '1px solid rgba(201,184,240,0.3)', background: showCal ? 'rgba(201,184,240,0.15)' : 'rgba(201,184,240,0.05)' }} data-testid="toggle-calendar-btn" aria-label="Pick a day">
            <Calendar className="w-4 h-4" style={{ color: '#c9b8f0' }} />
          </button>
        </div>

        {showCal && (
          <div className="absolute right-5 top-16 z-50">
            <MiniCalendar token={token} user={user} selectedDate={selectedDate} onSelectDate={handleSelectDay} onClose={() => setShowCal(false)} />
          </div>
        )}

        {/* The selected day: its date, and its phase name in its
            phase color. Everything below belongs to this day. */}
        <div className="flex items-center justify-between mt-3 mb-1" data-testid="journal-day-header">
          <button onClick={() => shiftDay(-1)} className="p-1.5 text-white/70" aria-label="Previous day" data-testid="journal-prev-day">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="text-center">
            <p className="text-base" style={{ ...POIRET, color: '#F4D3DC' }}>{fmtDayLong(selectedDate)}</p>
            <p className="text-xs mt-0.5" style={{ ...POPPINS, color: selectedPhaseColor }} data-testid="journal-day-phase">
              {selectedPhase === 'unknown' ? PHASE_NAMES.unknown : `${PHASE_NAMES[selectedPhase] || PHASE_NAMES.unknown} phase`}
            </p>
            {selectedDate !== todayISO() && (
              <button onClick={() => handleSelectDay(todayISO())} className="text-[11px] underline mt-0.5" style={{ ...POPPINS, color: '#CFC3CC' }} data-testid="journal-back-to-today">
                Back to today
              </button>
            )}
          </div>
          <button onClick={() => shiftDay(1)} className="p-1.5 text-white/70" aria-label="Next day" data-testid="journal-next-day">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center justify-center gap-3 mt-2 mb-5" aria-hidden="true">
          <span style={{ height: '1px', width: '52px', background: 'linear-gradient(90deg, transparent, rgba(201,184,240,0.5))' }} />
          <span style={{ color: 'rgba(201,184,240,0.65)', fontSize: '11px' }}>✿</span>
          <span style={{ height: '1px', width: '52px', background: 'linear-gradient(90deg, rgba(201,184,240,0.5), transparent)' }} />
        </div>

        {/* The day's questions: the full quick log set, filed to the
            selected day. The answers ARE this day's journal entry. */}
        <FloatingCarousel key={selectedDate} token={token} date={selectedDate} onLogged={refreshAll} />

        {/* Period and intimacy for this day */}
        <div className="rounded-2xl p-4 mb-5" style={{ background: 'rgba(20,15,30,0.85)', border: '1px solid rgba(255,255,255,0.08)' }} data-testid="journal-day-marks">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Droplet className="w-4 h-4" style={{ color: MENSTRUAL_TINT }} fill={periodLog ? MENSTRUAL_TINT : 'transparent'} />
              <span className="text-sm text-white" style={POPPINS}>Period day</span>
            </div>
            {periodLog ? (
              <div className="flex items-center gap-2">
                <span className="text-xs capitalize" style={{ ...POPPINS, color: '#F4D3DC' }}>Flow: {periodLog.flow || 'medium'}</span>
                <button onClick={handleRemovePeriod} disabled={periodBusy} className="px-3 py-1.5 rounded-full text-xs disabled:opacity-40" style={{ ...POPPINS, color: '#CFC3CC', border: '1px solid rgba(255,255,255,0.2)' }} data-testid="period-remove-btn">
                  Remove
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex gap-1" role="group" aria-label="Flow">
                  {FLOW_OPTIONS.map((f) => (
                    <button key={f} onClick={() => setFlowChoice(f)} className="px-2.5 py-1 rounded-full text-[11px] capitalize" style={{ ...POPPINS, border: `1px solid ${flowChoice === f ? MENSTRUAL_TINT : 'rgba(255,255,255,0.12)'}`, background: flowChoice === f ? `${MENSTRUAL_TINT}22` : 'rgba(255,255,255,0.04)', color: flowChoice === f ? '#fff' : '#b8b8d1' }} data-testid={`flow-${f}`}>
                      {f}
                    </button>
                  ))}
                </div>
                <button onClick={handleLogPeriod} disabled={periodBusy} className="px-3 py-1.5 rounded-full text-xs text-white disabled:opacity-40" style={{ ...POPPINS, background: MENSTRUAL_TINT }} data-testid="period-add-btn">
                  Log period day
                </button>
              </div>
            )}
          </div>

          <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Heart className="w-4 h-4" style={{ color: '#FF4F9A' }} fill={intimacyLog ? '#FF4F9A' : 'transparent'} />
                <span className="text-sm text-white" style={POPPINS}>Intimate day</span>
              </div>
              {intimacyLog ? (
                <button onClick={handleDeleteIntimacy} disabled={intimacyBusy} className="px-3 py-1.5 rounded-full text-xs disabled:opacity-40" style={{ ...POPPINS, color: '#CFC3CC', border: '1px solid rgba(255,255,255,0.2)' }} data-testid="intimacy-remove-btn">
                  Remove
                </button>
              ) : (
                <button onClick={handleMarkIntimacy} disabled={intimacyBusy} className="px-3 py-1.5 rounded-full text-xs text-white disabled:opacity-40" style={{ ...POPPINS, background: '#FF4F9A' }} data-testid="intimacy-add-btn">
                  Mark intimate day
                </button>
              )}
            </div>
            {intimacyLog && (
              <div className="mt-3">
                <label className="text-xs text-[#CFC3CC] block mb-2" style={POPPINS}>Partner name(s), separate with commas</label>
                <input
                  type="text"
                  value={partnerNames}
                  onChange={(e) => setPartnerNames(e.target.value)}
                  placeholder="e.g. James, Michael"
                  className="w-full rounded-xl px-4 py-3 text-sm text-white focus:outline-none"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', fontFamily: 'Poppins, sans-serif' }}
                  data-testid="journal-partner-name-input"
                />
                <p className="text-[10px] text-[#CFC3CC] mt-1.5" style={POPPINS}>Completely private to you.</p>
                <button onClick={handleSavePartners} disabled={intimacyBusy} className="px-4 py-1.5 rounded-full text-xs mt-2 disabled:opacity-40" style={{ ...POPPINS, color: '#F4D3DC', border: '1px solid rgba(244,167,185,0.4)', background: 'rgba(255,79,154,0.08)' }} data-testid="journal-partner-save-btn">
                  Save names
                </button>
                {intimacyMsg && <p className="text-xs mt-2" style={{ ...POPPINS, color: '#CFC3CC' }} role="status">{intimacyMsg}</p>}
              </div>
            )}
          </div>
        </div>

        {/* The note: her writing for this day, saved as this day's
            journal entry. There is no separate entry place. */}
        <div className="rounded-2xl mb-5 overflow-hidden" style={{ border: '1px solid rgba(244,167,185,0.2)', background: 'linear-gradient(180deg, rgba(253,243,246,0.05) 0%, rgba(255,79,154,0.02) 100%)', boxShadow: '0 18px 40px rgba(0,0,0,0.35)' }} data-testid="journal-note">
          <div className="p-4">
            <h2 className="text-lg text-white mb-3" style={POIRET}>Your note for this day</h2>
            <input
              type="text" value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)}
              placeholder="Title (optional)"
              className="w-full bg-transparent border-none text-white text-sm mb-3 placeholder-white/20 outline-none"
              style={{ ...POIRET, fontSize: '16px', borderBottom: '1px solid rgba(244,167,185,0.14)', paddingBottom: '8px' }}
              data-testid="journal-note-title"
            />
            <textarea
              value={note} onChange={(e) => { setNote(e.target.value); if (noteError) setNoteError(false); if (noteSaved) setNoteSaved(false); }}
              placeholder="Write whatever is on your mind..."
              className="journal-handwriting w-full bg-transparent border-none min-h-[140px] resize-none outline-none placeholder-white/15"
              style={{ fontFamily: SERIF, fontSize: '16px', lineHeight: '28px', color: '#F74093' }}
              data-testid="journal-note-input"
            />
          </div>
          {noteError && (
            <p className="px-4 pb-2 text-xs" style={{ ...POPPINS, color: '#ff8fa3' }} data-testid="journal-note-error">
              That didn&apos;t save. Your words are still here. Give it a moment and tap Save again.
            </p>
          )}
          {noteSaved && (
            <p className="px-4 pb-2 text-xs" style={{ ...POPPINS, color: '#7FD9A8' }} role="status" data-testid="journal-note-saved">Saved to this day.</p>
          )}
          <div className="flex gap-2 p-3 border-t border-white/5 items-center">
            <button
              onClick={() => setNoteIntimate(!noteIntimate)}
              title={noteIntimate ? 'Intimate' : 'Mark as intimate'}
              className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
              style={{ border: noteIntimate ? `1px solid ${GOLD}` : '1px solid rgba(255,255,255,0.12)', background: noteIntimate ? 'rgba(201,184,240,0.12)' : 'transparent' }}
              data-testid="journal-note-intimate-toggle">
              <Lock className="w-4 h-4" style={{ color: noteIntimate ? GOLD : 'rgba(255,255,255,0.35)' }} />
            </button>
            <span className="text-[11px] text-white/50 flex-1" style={POPPINS}>{noteIntimate ? 'This note is marked intimate.' : 'Tap the lock to mark this note intimate.'}</span>
            <button onClick={handleSaveNote} disabled={savingNote || !note.trim()}
              className="px-6 py-2 rounded-full text-white text-xs font-medium disabled:opacity-40"
              style={{ ...POPPINS, background: '#FF4F9A' }}
              data-testid="journal-note-save">
              {savingNote ? 'Saving...' : 'Save note'}
            </button>
          </div>
        </div>

        {/* Everything saved to this day: her entries, her answers,
            her period and intimacy, each with its own delete. */}
        <div data-testid="journal-day-saved">
          <h2 className="text-xl text-white mb-3" style={POIRET}>Saved this day</h2>
          {dayLoading ? (
            <div className="flex flex-col items-center py-8">
              <div className="cycle-orb orb-follicular w-10 h-10 mb-3" />
              <p className="text-white/70 text-sm" style={POPPINS}>Opening this day...</p>
            </div>
          ) : dayError ? (
            <div className="text-center py-8">
              <p className="text-white/70 text-sm mb-3" style={POPPINS}>This day could not be opened just now.</p>
              <button onClick={() => fetchDay(selectedDate)} className="px-6 py-2.5 rounded-full text-white text-sm" style={{ ...POPPINS, background: '#FF4F9A' }}>Try again</button>
            </div>
          ) : dayData.entries.length === 0 && dayData.logs.length === 0 && dayIntimacy.length === 0 ? (
            <p className="text-white/50 text-sm leading-relaxed py-4" style={POPPINS} data-testid="journal-day-empty">
              Nothing saved for this day yet. Answer the questions above, mark your period or an intimate moment, or write a note, and it will all be kept right here.
            </p>
          ) : (
            <div className="relative rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(244,167,185,0.16)', borderLeft: `3px solid ${selectedPhaseColor}`, background: 'linear-gradient(180deg, rgba(253,243,246,0.05) 0%, rgba(255,79,154,0.02) 100%)', boxShadow: '0 18px 40px rgba(0,0,0,0.35), inset 8px 0 16px rgba(0,0,0,0.22)' }}>
              {dayData.entries.map((entry, i) => (
                <div key={entry.id} className="p-4" style={i > 0 ? { borderTop: '1px solid rgba(201,184,240,0.08)' } : {}} data-testid={`journal-entry-${entry.id}`}>
                  <div className="flex items-start justify-between mb-1">
                    <div>
                      <h3 className="text-white text-sm" style={POIRET}>{entry.title}</h3>
                      <p className="text-white/30 text-[10px] mt-0.5" style={POPPINS}>{fmtTime(entry.created_at)}</p>
                    </div>
                    <button onClick={() => handleDeleteEntry(entry.id)} className="text-white/30 hover:text-red-400 p-1" title="Delete this entry" data-testid={`delete-entry-${entry.id}`}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {entry.is_intimate && (
                    <p className="text-[10px] tracking-widest uppercase mb-1" style={{ ...POPPINS, color: GOLD }}>Intimate</p>
                  )}
                  <p className="journal-handwriting whitespace-pre-wrap mt-2" style={{ fontFamily: SERIF, fontSize: '16px', lineHeight: '28px', color: '#F74093' }}>{entry.content}</p>
                </div>
              ))}
              {dayData.logs.length > 0 && (
                <div className="p-4" style={dayData.entries.length > 0 ? { borderTop: '1px solid rgba(201,184,240,0.08)' } : {}}>
                  <p className="text-[#CFC3CC] text-[10px] tracking-widest uppercase mb-2" style={POPPINS}>Logged this day</p>
                  <div className="space-y-2">
                    {dayData.logs.map((log) => (
                      <div key={log.id} className="flex items-start justify-between gap-2" data-testid={`journal-log-${log.id}`}>
                        <div>
                          {log.is_period ? (
                            <p className="text-[#FDF8FA] text-xs leading-relaxed capitalize" style={POPPINS}>Period day · Flow: {log.flow || 'medium'}</p>
                          ) : (
                            <>
                              {log.notes && (
                                <p className="text-[#FDF8FA] text-xs leading-relaxed whitespace-pre-wrap" style={POPPINS}>{log.notes}</p>
                              )}
                              {!log.notes && log.symptoms?.length > 0 && (
                                <p className="text-[#FDF8FA] text-xs leading-relaxed" style={POPPINS}>{log.symptoms.join(', ')}</p>
                              )}
                              {log.flow && (
                                <p className="text-[#CFC3CC] text-[11px] capitalize" style={POPPINS}>Period day · Flow: {log.flow}</p>
                              )}
                            </>
                          )}
                        </div>
                        <button onClick={() => handleDeleteLog(log.id)} className="text-white/30 hover:text-red-400 p-1 shrink-0" title="Delete this log" data-testid={`delete-log-${log.id}`}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {dayIntimacy.length > 0 && (
                <div className="p-4" style={(dayData.entries.length > 0 || dayData.logs.length > 0) ? { borderTop: '1px solid rgba(201,184,240,0.08)' } : {}}>
                  <p className="text-[#CFC3CC] text-[10px] tracking-widest uppercase mb-2" style={POPPINS}>Intimacy</p>
                  {dayIntimacy.map((log) => (
                    <div key={log.id} className="flex items-start justify-between gap-2" data-testid={`journal-intimacy-${log.id}`}>
                      <p className="text-[#FDF8FA] text-xs leading-relaxed" style={POPPINS}>
                        <Heart className="w-3 h-3 inline mr-1" style={{ color: '#FF4F9A' }} fill="#FF4F9A" />
                        Intimate day{log.partners ? ` · with ${log.partners}` : ''}
                      </p>
                      <button onClick={handleDeleteIntimacy} className="text-white/30 hover:text-red-400 p-1 shrink-0" title="Delete this intimacy log" data-testid={`delete-intimacy-${log.id}`}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <img src="/images/peach-mini.png" alt="" aria-hidden="true" className="absolute bottom-2 right-2 w-6 h-6 object-contain pointer-events-none" style={{ opacity: 0.9 }} />
            </div>
          )}
        </div>

        {/* Browse your days: the calendars live here in the Journal
            tab, month by month or the whole year. Blue days hold
            saved data; tapping one selects it and the full day view
            above shows it. */}
        <div className="mt-10" data-testid="journal-browse">
          <h2 className="text-xl text-white mb-1" style={POIRET}>Browse your days</h2>
          <p className="text-white/50 text-xs mb-4" style={POPPINS}>
            Every day you wrote something or logged something is outlined in blue.
          </p>
          <div className="flex gap-2 mb-4" role="tablist" aria-label="Calendar view">
            {[{ id: 'month', label: 'Month' }, { id: 'year', label: 'Year' }].map((v) => (
              <button
                key={v.id}
                role="tab"
                aria-selected={browseView === v.id}
                onClick={() => setBrowseView(v.id)}
                className="px-4 py-1.5 rounded-full text-xs"
                style={{
                  fontFamily: 'Poppins, sans-serif',
                  background: browseView === v.id ? LOGGED_BLUE : 'rgba(255,255,255,0.05)',
                  color: browseView === v.id ? '#0B0B1E' : '#CFC3CC',
                  border: `1px solid ${browseView === v.id ? LOGGED_BLUE : 'rgba(255,255,255,0.12)'}`,
                  fontWeight: browseView === v.id ? 600 : 400,
                }}
                data-testid={`browse-view-${v.id}`}
              >
                {v.label}
              </button>
            ))}
          </div>
          {browseView === 'month' ? (
            <BrowseCalendar
              loggedDays={loggedDays}
              selectedDate={selectedDate}
              onSelectDay={handleSelectDay}
              phaseColorFor={phaseColorFor}
              focusMonth={browseFocus}
            />
          ) : (
            <YearCalendar
              year={browseYear}
              onYearChange={setBrowseYear}
              loggedDays={loggedDays}
              selectedDate={selectedDate}
              phaseColorFor={phaseColorFor}
              onSelectDay={handleSelectDay}
              onPickMonth={(d) => { setBrowseFocus(d); setBrowseView('month'); }}
            />
          )}
        </div>

        {/* Your history: the charts. Cycle progression mirrors the
            Calendar page, and the mood and energy trend reads the
            mood:N and energy:N tags back from her logged days. */}
        <div className="mt-10" data-testid="journal-history">
          <h2 className="text-xl text-white mb-1" style={POIRET}>Your history</h2>
          <p className="text-white/50 text-xs mb-4" style={POPPINS}>Your cycles, your moods and your energy, month by month.</p>

          <div className="rounded-2xl p-4 mb-5" style={{ background: 'rgba(20,15,30,0.85)', border: '1px solid rgba(255,255,255,0.08)' }} data-testid="journal-cycle-chart">
            <h3 className="text-base text-white mb-1" style={POIRET}>Your cycles</h3>
            <p className="text-[#CFC3CC] text-xs mb-4" style={POPPINS}>
              How many days you bled, and how long each cycle ran. The dashed line on each track is your usual for that number.
            </p>
            {!cycleStats || chartCycles.length === 0 ? (
              <p className="text-[#CFC3CC] text-xs leading-relaxed" style={POPPINS} data-testid="journal-cycle-chart-empty">
                Your chart fills in as you log each period. Log the day your period starts and the day it finishes, and both lines begin here.
              </p>
            ) : (
              <div className="space-y-4">
                {chartCycles.map((c, i) => {
                  const completed = periodCompleted(c, i);
                  return (
                    <div key={c.start} data-testid={`journal-cycle-row-${c.start}`}>
                      <p className="text-[#E6E0EE] text-xs mb-1.5" style={POPPINS}>{monthLabel(c.start)}</p>
                      {completed && c.period_length ? (
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-[#CFC3CC] text-[10px] w-12 shrink-0" style={POPPINS}>Bled</span>
                          <div className="relative flex-1 h-3 rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }}>
                            <div className="h-3 rounded-full" style={{ width: `${Math.max(4, (c.period_length / bleedMax) * 100)}%`, background: `linear-gradient(90deg, ${PHASE_PAIRS.menstrual.primary}, ${PHASE_PAIRS.menstrual.secondary})` }} />
                            {cycleStats.avg_period_length ? (
                              <div className="absolute -top-1 -bottom-1 border-l border-dashed border-white/70" style={{ left: `${(cycleStats.avg_period_length / bleedMax) * 100}%` }} />
                            ) : null}
                          </div>
                          <span className="text-[#FDF8FA] text-[11px] w-14 shrink-0" style={POPPINS}>{c.period_length} day{c.period_length !== 1 ? 's' : ''}</span>
                        </div>
                      ) : null}
                      {c.cycle_length ? (
                        <div className="flex items-center gap-2">
                          <span className="text-[#CFC3CC] text-[10px] w-12 shrink-0" style={POPPINS}>Cycle</span>
                          <div className="relative flex-1 h-3 rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }}>
                            <div className="h-3 rounded-full" style={{ width: `${Math.max(4, (c.cycle_length / cycleMax) * 100)}%`, background: `linear-gradient(90deg, ${PHASE_PAIRS.luteal.primary}, ${PHASE_PAIRS.luteal.secondary})` }} />
                            {cycleStats.avg_cycle_length ? (
                              <div className="absolute -top-1 -bottom-1 border-l border-dashed border-white/70" style={{ left: `${(cycleStats.avg_cycle_length / cycleMax) * 100}%` }} />
                            ) : null}
                          </div>
                          <span className="text-[#FDF8FA] text-[11px] w-14 shrink-0" style={POPPINS}>{c.cycle_length} days</span>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
            {cycleStats && cycleRowsForChart.length >= 1 && (
              <p className="text-[#E6E0EE] text-xs leading-relaxed mt-4" style={POPPINS}>
                {cycleStats.cycles_tracked >= 1 ? `Your period usually lasts ${Math.round(cycleStats.avg_period_length)} days. ` : ''}
                {`Your cycles average ${Math.round(cycleStats.avg_cycle_length)} days.`}
              </p>
            )}
          </div>

          <div className="rounded-2xl p-4" style={{ background: 'rgba(20,15,30,0.85)', border: '1px solid rgba(255,255,255,0.08)' }} data-testid="journal-trend-chart">
            <h3 className="text-base text-white mb-1" style={POIRET}>Mood and energy</h3>
            <p className="text-[#CFC3CC] text-xs mb-4" style={POPPINS}>
              Your most recent logged days. Each bar wears the color of that day&apos;s phase.
            </p>
            {trendDays.length === 0 ? (
              <p className="text-[#CFC3CC] text-xs leading-relaxed" style={POPPINS} data-testid="journal-trend-empty">
                Nothing here yet. When you answer the mood and energy questions above, your days begin to gather here.
              </p>
            ) : (
              <>
                {trendRow('Mood', 'mood')}
                {trendRow('Energy', 'energy')}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
