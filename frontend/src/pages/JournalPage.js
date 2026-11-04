import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { ChevronLeft, ChevronRight, Heart, Droplet, Lock, RotateCcw, CircleDot, Baby, HelpCircle } from 'lucide-react';
import axios from 'axios';
import logger from '../utils/logger';
import { PHASE_PAIRS, PHASE_NAMES, phaseTint, phaseOther, phaseForDate, cycleDayForDate } from '../lib/phases';
import FloatingCarousel from '../components/FloatingCarousel';
import DateSelect from '../components/DateSelect';
import TabFooter from '../components/TabFooter';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const GOLD = '#C9B8F0';
const MENSTRUAL_TINT = PHASE_PAIRS.menstrual.primary;
const MENSTRUAL_TINT_2 = PHASE_PAIRS.menstrual.secondary;
const OVULATION_TINT = PHASE_PAIRS.ovulatory.secondary;
// Color fix (Oct 31, 2026): peak days wear the ovulatory GREEN too.
// This used to read pair.primary, the shared pink, so the peak
// marker showed pink on a green phase.
const PEAK_TINT = OVULATION_TINT;
// The pretty blue for logged days (Angelita, Oct 30, 2026): any day she
// logged anything lights up in this blue on the Journal calendars.
const LOGGED_BLUE = '#74B9FF';
// Journal ENTRY text only (Angelita, Oct 29): her own handwriting feel,
// Architects Daughter, self-hosted. Headings stay Poiret One and all
// other journal UI text stays Poppins; the .journal-handwriting class
// in index.css carries the journal ink and the slight tilt. v59: the
// ink lightens from the hot pink #F74093 to #FF9CC6 (her word,
// Oct 31, 2026), here and in index.css; no other pink changes.
const WRITING_PINK = '#FF9CC6';
const SERIF = "'Architects Daughter', 'Poppins', cursive";
const POPPINS = { fontFamily: 'Poppins, sans-serif' };
const POIRET = { fontFamily: "'Poiret One', sans-serif" };
const FLOW_OPTIONS = ['light', 'medium', 'heavy'];

// Local "today", matching the calendar grid's day strings and
// HomePage. The old UTC formula (toISOString) rolled to tomorrow
// at 5 PM San Diego time, so the Journal opened on tomorrow's day
// page in the evening and evening saves filed to that wrong day
// (see FloatingCarousel's todayISO note).
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const fmtDayLong = (dateStr) => new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
const fmtTime = (iso) => (iso ? new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '');

// The month calendar, now THE calendar of the app (v59: the
// Calendar tab is gone and its calendar lives here, at the top of
// the Journal). Calendar-level richness, carried over from the old
// CalendarPage: every day wears a wash of its phase tint; period
// days (logged, estimated past, and expected future) wear the
// menstrual wash with a droplet marker; fertile days wear the
// ovulatory green wash and peak days a white inset ring plus a pink
// dot; intimate days carry a small pink heart. Days she logged
// anything keep the blue outline and the phase accent line. Every
// day is tappable and opens that day below.
function BrowseCalendar({ loggedDays, selectedDate, onSelectDay, phaseColorFor, focusMonth, dayInfoFor }) {
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
          const info = dayInfoFor ? dayInfoFor(ds) : {};
          const showConfirmedPeriod = !!(info.isPeriod || info.isEstimatedPeriod);
          const showExpectedPeriod = !!info.isExpectedPeriod && !showConfirmedPeriod;
          const showFertile = !!info.isFertile && !showConfirmedPeriod && !showExpectedPeriod;
          return (
            <button
              key={day}
              onClick={() => onSelectDay(ds)}
              className="relative h-11 flex flex-col items-center justify-center rounded-lg text-sm"
              style={{
                background: sel ? LOGGED_BLUE
                  : showConfirmedPeriod ? `${MENSTRUAL_TINT}33`
                  : showExpectedPeriod ? `${MENSTRUAL_TINT}1A`
                  : showFertile ? (info.isPeak ? `${OVULATION_TINT}26` : `${OVULATION_TINT}1A`)
                  : `${tint}14`,
                border: sel ? `2px solid ${LOGGED_BLUE}`
                  : isLoggedDay ? `2px solid ${LOGGED_BLUE}`
                  : showExpectedPeriod ? '1px dashed rgba(255,255,255,0.30)'
                  : '1px solid rgba(255,255,255,0.06)',
                boxShadow: td ? '0 0 0 2px #F4D3DC, 0 0 0 3px #0A0508'
                  : info.isPeak && showFertile ? 'inset 0 0 0 2px rgba(255,255,255,0.35)' : undefined,
                color: sel ? '#0B0B1E' : tint,
                opacity: 1,
                fontFamily: 'Poppins, sans-serif',
                fontWeight: sel ? 600 : 400,
              }}
              data-testid={`journal-cal-day-${ds}`}
            >
              {day}
              {isLoggedDay && <span aria-hidden="true" style={{ width: 14, height: 3, borderRadius: 3, background: sel ? '#0B0B1E' : tint, marginTop: 2 }} />}
              {showConfirmedPeriod && (
                <Droplet className="w-2.5 h-2.5 absolute top-1 right-1" style={{ color: MENSTRUAL_TINT }} strokeWidth={2} fill={MENSTRUAL_TINT} />
              )}
              {showExpectedPeriod && (
                <Droplet className="w-2.5 h-2.5 absolute top-1 right-1" style={{ color: `${MENSTRUAL_TINT}99` }} strokeWidth={1.5} fill="transparent" />
              )}
              {info.isIntimacy && (
                <Heart className="absolute bottom-1 right-1 w-2.5 h-2.5" style={{ color: '#FF4F9A' }} strokeWidth={2.5} fill="#FF4F9A" />
              )}
              {info.isPeak && showFertile && (
                <CircleDot className="w-2.5 h-2.5 absolute top-1 left-1" style={{ color: PEAK_TINT }} />
              )}
            </button>
          );
        })}
      </div>
      <p className="text-[11px] mt-3 text-center" style={{ ...POPPINS, color: '#9CC8F5' }}>
        Days outlined in blue are days you logged something. The little line under a day wears that day&apos;s phase color. Tap any day to open it below.
      </p>
    </div>
  );
}

// The year view: all twelve months small at once. Logged days carry
// the same blue marking and phase tinted numbers, period days the
// menstrual wash; tapping a marked day opens that day, and tapping
// a month name jumps the month view to that month.
function YearCalendar({ year, onYearChange, loggedDays, selectedDate, phaseColorFor, onSelectDay, onPickMonth, periodDays }) {
  const logged = loggedDays || new Set();
  const periods = periodDays || new Set();
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
                        background: sel ? LOGGED_BLUE : periods.has(ds) ? `${MENSTRUAL_TINT}38` : isLoggedDay ? 'rgba(116,185,255,0.20)' : 'transparent',
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

export default function JournalPage({ embedded = false } = {}) {
  const { token, user, updateUser } = useAuth();
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [dashboard, setDashboard] = useState(null);
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
  // Reset Period (carried over from the old Calendar tab in v59):
  // the same dialog behavior, POST /period/reset, learned message.
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [learnMessage, setLearnMessage] = useState('');
  const [newPeriodLength, setNewPeriodLength] = useState(user?.period_length || 5);
  const [newPeriodDate, setNewPeriodDate] = useState(todayISO());
  const daySectionRef = React.useRef(null);

  const firstName = (user?.name || '').trim().split(/\s+/).filter(Boolean)[0] || null;
  const auth = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` }, timeout: 15000 }), [token]);
  const phaseColorFor = useCallback(
    (ds) => phaseTint(phaseForDate(ds, user?.last_period_date, user?.cycle_length || 28)),
    [user?.last_period_date, user?.cycle_length]
  );
  const selectedPhase = phaseForDate(selectedDate, user?.last_period_date, user?.cycle_length || 28);
  // The Day headline number: the same anchor math as the phase, so
  // the number and the phase name always agree. Null when she has
  // no cycle start on file, and then no headline shows.
  const selectedCycleDay = cycleDayForDate(selectedDate, user?.last_period_date, user?.cycle_length || 28);
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

  // The dashboard, the same source the old Calendar tab used for
  // its next period date and its period-late card (v59 migration).
  const fetchDashboard = useCallback(async () => {
    if (!token) return;
    try {
      const res = await axios.get(`${API}/dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { _t: Date.now() },
        timeout: 15000
      });
      setDashboard(res.data);
    } catch (err) { logger.error('Dashboard failed:', err); }
  }, [token]);

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
    await Promise.all([fetchDay(selectedDate), fetchLoggedDays(), fetchAllLogs(), fetchCycleStats(), fetchDashboard()]);
  }, [fetchDay, fetchLoggedDays, fetchAllLogs, fetchCycleStats, fetchDashboard, selectedDate]);

  useEffect(() => { refreshUser(); }, [refreshUser]);
  useEffect(() => { fetchLoggedDays(); fetchAllLogs(); fetchCycleStats(); fetchDashboard(); }, [fetchLoggedDays, fetchAllLogs, fetchCycleStats, fetchDashboard]);
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

  // --- Calendar predictions, carried over from the old Calendar
  // tab (v59). Same sources CalendarPage used: the dashboard for
  // the next period date, her last_period_date walked by whole
  // cycle lengths for estimated and expected period days, and the
  // v56 ovulation anchor (the cycle start a date belongs to, plus
  // 14 days; fertile is 5 days before through 1 day after, peak is
  // the day before and the day of). Period length prefers the
  // learned average from /cycle-stats, like the Calendar did.
  const getPeriodLength = useCallback(() => cycleStats?.avg_period_length || user?.period_length || 5, [cycleStats, user?.period_length]);
  const getNextPeriodDate = useCallback(() => {
    if (dashboard?.cycle_info?.next_period_date) return dashboard.cycle_info.next_period_date;
    if (!user?.last_period_date) return null;
    const cycleLen = user.cycle_length || 28;
    const next = new Date(user.last_period_date + 'T00:00:00');
    const todayD = new Date();
    todayD.setHours(0, 0, 0, 0);
    while (next <= todayD) next.setDate(next.getDate() + cycleLen);
    return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
  }, [dashboard, user?.last_period_date, user?.cycle_length]);
  const fertilityOn = user?.fertility_predictions_enabled !== false;
  const getCycleStartFor = useCallback((dateStr) => {
    if (!user?.last_period_date) return null;
    const cycleLen = user.cycle_length || 28;
    const start = new Date(user.last_period_date + 'T00:00:00');
    const check = new Date(dateStr + 'T00:00:00');
    if (isNaN(start) || isNaN(check) || cycleLen <= 0) return null;
    const diffDays = Math.floor((check - start) / 86400000);
    const k = Math.floor(diffDays / cycleLen);
    const cycleStart = new Date(start);
    cycleStart.setDate(cycleStart.getDate() + k * cycleLen);
    return cycleStart;
  }, [user?.last_period_date, user?.cycle_length]);
  const getOvulationFor = useCallback((dateStr) => {
    const cycleStart = getCycleStartFor(dateStr);
    if (!cycleStart) return null;
    const ov = new Date(cycleStart);
    ov.setDate(ov.getDate() + 14);
    return ov;
  }, [getCycleStartFor]);

  const periodDaysSet = useMemo(
    () => new Set(allLogs.filter((l) => l.is_period && l.date).map((l) => l.date)),
    [allLogs]
  );
  const intimacyDaysSet = useMemo(
    () => new Set(intimacyLogs.filter((l) => l.date).map((l) => l.date)),
    [intimacyLogs]
  );

  const dayInfoFor = useCallback((dateStr) => {
    const info = { isPeriod: false, isEstimatedPeriod: false, isExpectedPeriod: false, isIntimacy: false, isFertile: false, isPeak: false };
    info.isPeriod = periodDaysSet.has(dateStr);
    info.isIntimacy = intimacyDaysSet.has(dateStr);
    if (user?.last_period_date) {
      const checkDate = new Date(dateStr + 'T00:00:00');
      const todayD = new Date();
      todayD.setHours(0, 0, 0, 0);
      const periodLen = Math.round(getPeriodLength());
      // Estimated past period days: projected backward from
      // last_period_date by whole cycle lengths (Calendar rule).
      if (checkDate < todayD) {
        const lastStart = new Date(user.last_period_date + 'T00:00:00');
        const cycleLen = user.cycle_length || 28;
        for (let k = 0; k < 24; k++) {
          const projectedStart = new Date(lastStart);
          projectedStart.setDate(projectedStart.getDate() - (k * cycleLen));
          const projectedEnd = new Date(projectedStart);
          projectedEnd.setDate(projectedEnd.getDate() + (periodLen - 1));
          if (checkDate >= projectedStart && checkDate <= projectedEnd) { info.isEstimatedPeriod = true; break; }
          if (projectedStart < checkDate && (checkDate - projectedStart) > (cycleLen * 24 * 60 * 60 * 1000)) break;
        }
      }
      // Expected future period range, from the next period date.
      const npd = getNextPeriodDate();
      if (npd) {
        const nextStart = new Date(npd + 'T00:00:00');
        const nextEnd = new Date(nextStart);
        nextEnd.setDate(nextEnd.getDate() + (periodLen - 1));
        if (checkDate >= nextStart && checkDate <= nextEnd) info.isExpectedPeriod = true;
      }
    }
    if (fertilityOn) {
      const ov = getOvulationFor(dateStr);
      if (ov) {
        const checkDate = new Date(dateStr + 'T00:00:00');
        const fertileStart = new Date(ov);
        fertileStart.setDate(fertileStart.getDate() - 5);
        const fertileEnd = new Date(ov);
        fertileEnd.setDate(fertileEnd.getDate() + 1);
        info.isFertile = checkDate >= fertileStart && checkDate <= fertileEnd;
        const diffDays = Math.floor((checkDate - ov) / 86400000);
        info.isPeak = diffDays >= -1 && diffDays <= 0;
      }
    }
    return info;
  }, [periodDaysSet, intimacyDaysSet, user?.last_period_date, user?.cycle_length, getPeriodLength, getNextPeriodDate, fertilityOn, getOvulationFor]);

  const selectedDayInfo = useMemo(() => dayInfoFor(selectedDate), [dayInfoFor, selectedDate]);
  const nextPeriodDate = getNextPeriodDate();
  // The estimate explanation stays until her first full cycle is
  // truly logged (the same test the old Calendar tab used).
  const showEstimateExplainer = !user?.no_periods && user?.cycle_status !== 'no_periods'
    && (user?.cycle_length_is_estimate || (cycleStats && cycleStats.cycles_tracked < 2));

  // "Saved this day" dedupe (v59, the staircase fix, frontend
  // side): legacy days can hold several log rows for the SAME
  // category, one per tap, which read as a staircase of near
  // duplicate lines. Period rows always show; every other row is
  // grouped by its quick log category (the same tag prefixes
  // FloatingCarousel writes) and only the latest row per category
  // renders. The backend dedupes too; this keeps old days reading
  // as one current line per category either way.
  const logCategory = (log) => {
    const S = Array.isArray(log.symptoms) ? log.symptoms : [];
    const notes = typeof log.notes === 'string' ? log.notes : '';
    const has = (p) => S.some((s) => typeof s === 'string' && s.startsWith(p));
    if (has('mood:') || has('emotion:') || notes.startsWith('No mood or feelings')) return 'mood';
    if (has('energy:')) return 'energy';
    if (has('craving:') || notes.startsWith('No cravings')) return 'cravings';
    if (has('collection:') || notes.startsWith('No collection')) return 'collection';
    if (has('sleep:') || has('sleep_quality:')) return 'sleep';
    if (has('supplements:')) return 'supplements';
    return 'symptoms';
  };
  const dedupedLogs = useMemo(() => {
    const period = dayData.logs.filter((l) => l.is_period);
    const byCat = new Map();
    dayData.logs.filter((l) => !l.is_period).forEach((l) => {
      const cat = logCategory(l);
      const prev = byCat.get(cat);
      if (!prev || (l.created_at || '') >= (prev.created_at || '')) byCat.set(cat, l);
    });
    const kept = [...byCat.values()].sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
    return [...period, ...kept];
  }, [dayData.logs]);

  const handleSelectDay = (dateStr) => {
    setSelectedDate(dateStr);
    setNote(''); setNoteTitle(''); setNoteIntimate(false); setNoteError(false); setNoteSaved(false);
    // The calendar sits at the top now and the day view is right
    // under it: bring the day view into view, not the page top.
    requestAnimationFrame(() => {
      if (daySectionRef.current) daySectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  // Reset Period, the old Calendar tab's dialog behavior (v59):
  // POST /period/reset with the start date and period length, the
  // learned confirmation in her pattern, then refresh everything.
  const handleResetPeriod = async () => {
    if (!newPeriodDate) { alert('Please select a date'); return; }
    setResetting(true);
    try {
      const res = await axios.post(`${API}/period/reset`, {
        new_period_date: newPeriodDate,
        period_length: parseInt(newPeriodLength) || 5
      }, { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 });
      if (res.data) {
        const { learning, ...userData } = res.data;
        updateUser(userData);
        if (learning) {
          const parts = [];
          if (learning.last_period_length) parts.push(`You bled ${learning.last_period_length} day${learning.last_period_length !== 1 ? 's' : ''}.`);
          if (learning.gap_days) parts.push(`Your cycle was ${learning.gap_days} days.`);
          if (learning.learned_period_length || learning.learned_cycle_length) {
            const usualBleed = learning.learned_period_length || userData.period_length;
            const usualCycle = learning.learned_cycle_length || userData.cycle_length;
            parts.push(`Your usual is now ${usualBleed} days of bleeding and a ${usualCycle} day cycle.`);
          }
          if (parts.length) setLearnMessage(parts.join(' '));
        }
      }
      setShowResetDialog(false);
      await Promise.all([refreshAll(), refreshUser()]);
    } catch (err) {
      logger.error('Reset error:', err);
      alert('Something went wrong. Please try again.');
    } finally { setResetting(false); }
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
    <div className={embedded ? 'relative pb-10' : 'relative min-h-screen pb-80 lg:ml-64'} style={{ background: 'linear-gradient(180deg, #15152B 0%, #0f0a1a 30%, #0B0B1E 100%)' }} data-testid="journal-page">
      <div className="absolute top-0 left-0 w-full h-64 pointer-events-none overflow-hidden opacity-20">
        <div className="absolute top-4 left-4 text-2xl" style={{ color: '#f4a7b9' }}>✿</div>
        <div className="absolute top-12 right-8 text-xl" style={{ color: '#c9b8f0' }}>✿</div>
        <div className="absolute top-24 left-1/3 text-lg" style={{ color: '#74b9ff' }}>✿</div>
        <div className="absolute top-8 right-1/3 text-sm" style={{ color: '#f4a7b9' }}>✿</div>
        <div className="absolute top-32 right-16 text-2xl" style={{ color: '#c9b8f0' }}>✿</div>
      </div>

      <div className="max-w-2xl mx-auto px-5 pt-6 relative">
        {/* Header Row */}
        <div className="mb-4">
          <p className="text-[10px] tracking-widest uppercase" style={{ ...POPPINS, color: '#f4a7b9' }}>Your pages</p>
          <h1 className="text-3xl text-white" style={POIRET}>{firstName ? `${firstName}'s Journal` : 'Journal'}</h1>
        </div>

        {/* THE calendar (v59): the old Calendar tab's calendar,
            moved here to the top of the Journal. Month view, or
            the whole year; every day tappable. */}
        <div data-testid="journal-browse">
          <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
            <div className="flex gap-2" role="tablist" aria-label="Calendar view">
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
            <button
              data-testid="reset-period-btn"
              onClick={() => setShowResetDialog(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-xs tracking-wider"
              style={{ ...POPPINS, color: MENSTRUAL_TINT }}
            >
              <RotateCcw className="w-4 h-4" />
              Reset period
            </button>
          </div>
          {browseView === 'month' ? (
            <BrowseCalendar
              loggedDays={loggedDays}
              selectedDate={selectedDate}
              onSelectDay={handleSelectDay}
              phaseColorFor={phaseColorFor}
              focusMonth={browseFocus}
              dayInfoFor={dayInfoFor}
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
              periodDays={periodDaysSet}
            />
          )}

          {/* Legend, from the old Calendar tab */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <span className="flex items-center gap-1.5 text-[#CFC3CC] text-xs" style={POPPINS}>
              <Droplet className="w-3 h-3" style={{ color: MENSTRUAL_TINT }} fill={MENSTRUAL_TINT} /> Confirmed
            </span>
            <span className="flex items-center gap-1.5 text-[#CFC3CC] text-xs" style={POPPINS}>
              <span className="w-3.5 h-3.5 rounded" style={{ background: `${MENSTRUAL_TINT}1A`, border: `1px dashed ${MENSTRUAL_TINT}66` }} /> Expected
            </span>
            <span className="flex items-center gap-1.5 text-[#CFC3CC] text-xs" style={POPPINS}>
              <span className="w-3 h-3 rounded" style={{ background: `linear-gradient(135deg, ${PEAK_TINT}, ${OVULATION_TINT})` }} /> Fertile (estimated)
            </span>
            <span className="flex items-center gap-1.5 text-[#CFC3CC] text-xs" style={POPPINS}>
              <Heart className="w-3 h-3" style={{ color: '#FF4F9A' }} fill="#FF4F9A" strokeWidth={2.5} /> Intimacy
            </span>
          </div>

          {/* Learned confirmation (v55, from the Calendar tab):
              after a Reset that taught the app something, she sees
              exactly what it learned. */}
          {learnMessage && (
            <div className="rounded-2xl p-4 mb-4" style={{ background: 'rgba(20,15,30,0.85)', border: `1px solid ${MENSTRUAL_TINT}4D` }} data-testid="learn-message">
              <p className="text-[#FDF8FA] text-sm leading-relaxed" style={POPPINS}>{learnMessage}</p>
            </div>
          )}

          {/* Period late card, from the old Calendar tab */}
          {dashboard?.cycle_info?.period_is_late && (
            <div className="rounded-2xl p-4 mb-4" style={{ background: `${MENSTRUAL_TINT}0D`, border: `1px solid ${MENSTRUAL_TINT}4D` }}>
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${MENSTRUAL_TINT}33` }}>
                  <HelpCircle className="w-5 h-5" style={{ color: MENSTRUAL_TINT }} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium mb-2" style={{ ...POPPINS, color: MENSTRUAL_TINT }}>{dashboard.cycle_info.days_late === 0 ? 'Period expected today' : `Period is ${dashboard.cycle_info.days_late} day${dashboard.cycle_info.days_late !== 1 ? 's' : ''} late`}</p>
                  <p className="text-[#CFC3CC] text-xs leading-relaxed" style={POPPINS}>
                    When your period starts, tap the <strong className="text-[#F4D3DC]">&ldquo;Reset period&rdquo;</strong> button above to reset your cycle to Day 1.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Next period and fertile window, from the old Calendar tab */}
          {nextPeriodDate && (
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="rounded-2xl p-4" style={{ background: 'rgba(20,15,30,0.85)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-3" style={{ background: `${MENSTRUAL_TINT}33` }}>
                  <Droplet className="w-4 h-4" style={{ color: MENSTRUAL_TINT }} fill={MENSTRUAL_TINT} />
                </div>
                <p className="text-[10px] tracking-widest uppercase mb-1" style={{ ...POPPINS, color: '#B4B0C8' }}>Next Period</p>
                <p className="text-[#FDF8FA] text-sm tracking-wide" style={POPPINS}>
                  {new Date(nextPeriodDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </p>
                <p className="text-xs mt-1" style={{ ...POPPINS, color: MENSTRUAL_TINT }}>
                  {(() => {
                    if (dashboard?.cycle_info?.next_period_date) return `${dashboard.cycle_info.days_until_period} days`;
                    const diff = Math.round((new Date(nextPeriodDate + 'T00:00:00') - new Date(new Date().setHours(0, 0, 0, 0))) / 86400000);
                    if (diff <= 0) return 'today';
                    if (diff === 1) return 'tomorrow';
                    return `${diff} days`;
                  })()}
                </p>
              </div>
              {fertilityOn && (
                <div className="rounded-2xl p-4" style={{ background: 'rgba(20,15,30,0.85)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-3" style={{ background: `${OVULATION_TINT}33` }}>
                    <Baby className="w-4 h-4" style={{ color: OVULATION_TINT }} />
                  </div>
                  <p className="text-[10px] tracking-widest uppercase mb-1" style={{ ...POPPINS, color: '#B4B0C8' }}>Fertile Window</p>
                  <p className="text-[#FDF8FA] text-sm tracking-wide" style={POPPINS}>
                    {(() => {
                      const ovulationDate = getOvulationFor(todayISO()) || getOvulationFor(nextPeriodDate);
                      if (!ovulationDate) return '';
                      const fertileStart = new Date(ovulationDate);
                      fertileStart.setDate(fertileStart.getDate() - 5);
                      return fertileStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' - ' + ovulationDate.toLocaleDateString('en-US', { day: 'numeric' });
                    })()}
                  </p>
                  <p className="text-xs mt-1" style={{ ...POPPINS, color: OVULATION_TINT }}>
                    Estimated from your logged cycle, not a measurement
                  </p>
                </div>
              )}
            </div>
          )}

          {/* The estimate explanation, from the old Calendar tab:
              it stays until her first full cycle is truly logged. */}
          {showEstimateExplainer && (
            <div className="rounded-2xl p-4 mb-4" style={{ background: 'rgba(20,15,30,0.85)', border: '1px solid rgba(255,255,255,0.08)' }} data-testid="estimate-explainer">
              <p className="text-[#CFC3CC] text-xs leading-relaxed" style={POPPINS}>
                At first, everything is an estimate. Log the day your period starts and the day it finishes, and HORMOscope learns your real bleeding days and your real cycle length from you, month by month. The more you log, the more accurate your predictions get.
              </p>
            </div>
          )}
        </div>

        {/* The selected day: its date, and its phase name in its
            phase color. Everything below belongs to this day. */}
        <div ref={daySectionRef} className="flex items-center justify-between mt-3 mb-1" style={{ scrollMarginTop: '16px' }} data-testid="journal-day-header">
          <button onClick={() => shiftDay(-1)} className="p-1.5 text-white/70" aria-label="Previous day" data-testid="journal-prev-day">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="text-center">
            <p className="text-xs" style={{ ...POPPINS, color: '#CFC3CC' }} data-testid="journal-day-date">{fmtDayLong(selectedDate)}</p>
            {selectedCycleDay != null && (
              <h2 className="text-3xl mt-1" style={{ ...POIRET, color: '#FFFFFF' }} data-testid="journal-day-headline">Day {selectedCycleDay}</h2>
            )}
            <p className="text-xs mt-0.5" style={{ ...POPPINS, color: selectedPhaseColor }} data-testid="journal-day-phase">
              {selectedPhase === 'unknown' ? PHASE_NAMES.unknown : `${PHASE_NAMES[selectedPhase] || PHASE_NAMES.unknown} phase`}
            </p>
            {selectedDayInfo.isFertile && (
              <p className="text-[11px] mt-0.5 flex items-center justify-center gap-1" style={{ ...POPPINS, color: OVULATION_TINT }} data-testid="journal-day-fertile">
                <Baby className="w-3 h-3" /> Fertile window (estimated)
              </p>
            )}
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
                <button onClick={handleMarkIntimacy} disabled={intimacyBusy} className="px-3 py-1.5 rounded-full text-xs text-white disabled:opacity-40" style={{ ...POPPINS, background: 'transparent', border: '1.5px solid #FF4F9A' }} data-testid="intimacy-add-btn">
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
        <div className="relative rounded-2xl mb-10 overflow-hidden" style={{ border: '1px solid rgba(244,167,185,0.2)', background: 'linear-gradient(180deg, rgba(253,243,246,0.05) 0%, rgba(255,79,154,0.02) 100%)', boxShadow: '0 18px 40px rgba(0,0,0,0.35)', scrollMarginBottom: '7.5rem' }} data-testid="journal-note">
          {/* Her life-stages progression artwork lives ONLY in the
              note (Angelita, Oct 31, 2026: not in the saved panel),
              sitting LOW in the card, in the lower stretch behind
              the writing, clear of the heading, date and title line
              at the top. Faint, so the words stay fully readable. */}
          <img src="/images/life-stages-silhouettes.webp" alt="" aria-hidden="true" className="absolute left-1/2 -translate-x-1/2 w-[72%] object-contain pointer-events-none" style={{ opacity: 0.15, top: '36%', bottom: 0, height: '64%' }} />
          <div className="relative z-10 p-4">
            <h2 className="text-lg text-white mb-1" style={POIRET}>Your note for this day</h2>
            <p className="text-[11px] mb-3" style={{ ...POPPINS, color: '#CFC3CC' }} data-testid="journal-note-date">{fmtDayLong(selectedDate)}</p>
            <input
              type="text" value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)}
              placeholder="Title (optional)"
              className="w-full bg-transparent border-none text-white text-sm mb-3 placeholder-white/20 outline-none"
              style={{ ...POIRET, fontSize: '16px', borderBottom: '1px solid rgba(244,167,185,0.14)', paddingBottom: '8px' }}
              data-testid="journal-note-title"
            />
            {/* The writing window has a fixed height of its own
                (Angelita, Oct 31, 2026: the Save button sat on top
                of her writing). A long note scrolls INSIDE this
                window; the box can never grow down over the Save
                row below it, and the Save row can never sit on
                the text. */}
            <textarea
              value={note} onChange={(e) => { setNote(e.target.value); if (noteError) setNoteError(false); if (noteSaved) setNoteSaved(false); }}
              placeholder="Write whatever is on your mind..."
              rows={7}
              className="journal-handwriting w-full bg-transparent border-none resize-none outline-none placeholder-white/15 block"
              style={{ fontFamily: SERIF, fontSize: '16px', lineHeight: '28px', color: WRITING_PINK, height: '196px', overflowY: 'auto' }}
              data-testid="journal-note-input"
            />
          </div>
          {noteError && (
            <p className="relative z-10 px-4 pb-2 text-xs" style={{ ...POPPINS, color: '#ff8fa3' }} data-testid="journal-note-error">
              That didn&apos;t save. Your words are still here. Give it a moment and tap Save again.
            </p>
          )}
          {noteSaved && (
            <p className="relative z-10 px-4 pb-2 text-xs" style={{ ...POPPINS, color: '#7FD9A8' }} role="status" data-testid="journal-note-saved">Saved to this day.</p>
          )}
          {/* The Save row is its own band: normal flow below the
              writing window, an opaque background of its own, and
              a divider above it, so the button never overlaps the
              note text and the text never runs under the button. */}
          <div className="relative z-10 flex gap-2 px-3 pt-3 pb-6 border-t border-white/10 items-center" style={{ background: 'rgba(16,10,24,0.92)' }}>
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
              style={{ ...POPPINS, background: 'transparent', border: '1.5px solid #FF4F9A' }}
              data-testid="journal-note-save">
              {savingNote ? 'Saving...' : 'Save note'}
            </button>
          </div>
        </div>

        {/* Everything saved to this day: her entries, her answers,
            her period and intimacy. Oct 31, 2026 (Angelita, reversing
            the labeled buttons added hours earlier): "Take all that
            shit off." NO delete buttons anywhere in this panel. The
            delete handlers stay in code, unreachable from here,
            until she asks for a way back in. */}
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
              <button onClick={() => fetchDay(selectedDate)} className="px-6 py-2.5 rounded-full text-white text-sm" style={{ ...POPPINS, background: 'transparent', border: '1.5px solid #FF4F9A' }}>Try again</button>
            </div>
          ) : dayData.entries.length === 0 && dedupedLogs.length === 0 && dayIntimacy.length === 0 ? (
            <p className="text-white/50 text-sm leading-relaxed py-4" style={POPPINS} data-testid="journal-day-empty">
              Nothing saved for this day yet. Answer the questions above, mark your period or an intimate moment, or write a note, and it will all be kept right here.
            </p>
          ) : (
            <div className="relative rounded-2xl overflow-hidden pb-10" style={{ border: '1px solid rgba(244,167,185,0.16)', borderLeft: `3px solid ${selectedPhaseColor}`, background: 'linear-gradient(180deg, rgba(253,243,246,0.05) 0%, rgba(255,79,154,0.02) 100%)', boxShadow: '0 18px 40px rgba(0,0,0,0.35), inset 8px 0 16px rgba(0,0,0,0.22)' }}>
              {dayData.entries.map((entry, i) => (
                <div key={entry.id} className="relative z-10 p-4" style={i > 0 ? { borderTop: '1px solid rgba(201,184,240,0.08)' } : {}} data-testid={`journal-entry-${entry.id}`}>
                  <div className="flex items-start justify-between mb-1">
                    <div>
                      <h3 className="text-white text-sm" style={POIRET}>{entry.title}</h3>
                      <p className="text-white/30 text-[10px] mt-0.5" style={POPPINS}>{fmtTime(entry.created_at)}</p>
                    </div>
                  </div>
                  {entry.is_intimate && (
                    <p className="text-[10px] tracking-widest uppercase mb-1" style={{ ...POPPINS, color: GOLD }}>Intimate</p>
                  )}
                  <p className="journal-handwriting whitespace-pre-wrap mt-2" style={{ fontFamily: SERIF, fontSize: '16px', lineHeight: '28px', color: WRITING_PINK }}>{entry.content}</p>
                </div>
              ))}
              {dedupedLogs.length > 0 && (
                <div className="relative z-10 p-4" style={dayData.entries.length > 0 ? { borderTop: '1px solid rgba(201,184,240,0.08)' } : {}}>
                  <p className="text-[#CFC3CC] text-[10px] tracking-widest uppercase mb-2" style={POPPINS}>Logged this day</p>
                  <div className="space-y-2">
                    {dedupedLogs.map((log) => (
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
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {dayIntimacy.length > 0 && (
                <div className="relative z-10 p-4" style={(dayData.entries.length > 0 || dedupedLogs.length > 0) ? { borderTop: '1px solid rgba(201,184,240,0.08)' } : {}}>
                  <p className="text-[#CFC3CC] text-[10px] tracking-widest uppercase mb-2" style={POPPINS}>Intimacy</p>
                  {dayIntimacy.map((log) => (
                    <div key={log.id} className="flex items-start justify-between gap-2" data-testid={`journal-intimacy-${log.id}`}>
                      <p className="text-[#FDF8FA] text-xs leading-relaxed" style={POPPINS}>
                        <Heart className="w-3 h-3 inline mr-1" style={{ color: '#FF4F9A' }} fill="#FF4F9A" />
                        Intimate day{log.partners ? ` · with ${log.partners}` : ''}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              <img src="/images/peach-mini.png" alt="" aria-hidden="true" className="absolute bottom-2 right-2 w-6 h-6 object-contain pointer-events-none" style={{ opacity: 0.9 }} />
            </div>
          )}
        </div>

        {/* Your history: the charts. Cycle progression mirrors
            the old Calendar page's chart, and the mood and energy
            trend reads the mood:N and energy:N tags back from her
            logged days. */}
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
                            <div className="h-3 rounded-full" style={{ width: `${Math.max(4, (c.cycle_length / cycleMax) * 100)}%`, background: `linear-gradient(90deg, ${phaseTint('luteal')}, ${phaseOther('luteal')})` }} />
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
            {cycleStats && chartCycles.length > 0 && cycleRowsForChart.length === 0 && (
              <p className="text-[#CFC3CC] text-xs leading-relaxed mt-4" style={POPPINS} data-testid="journal-cycle-length-estimate-note">
                Your cycle length is an estimate for now. We will know it for sure once you log your next period start.
              </p>
            )}
            {cycleStats && (cycleStats.cycles_tracked >= 1 || cycleRowsForChart.length >= 1) && (
              <p className="text-[#E6E0EE] text-xs leading-relaxed mt-4" style={POPPINS} data-testid="journal-cycle-chart-summary">
                {cycleStats.cycles_tracked >= 1 ? `Your period usually lasts ${Math.round(cycleStats.avg_period_length)} days. ` : ''}
                {cycleRowsForChart.length >= 1 ? `Your cycles average ${Math.round(cycleStats.avg_cycle_length)} days. ` : ''}
                {cycleRowsForChart.length >= 2 ? `Your next period is estimated within about ${cycleStats.prediction_window} days either way.` : ''}
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

      {/* Reset Period Dialog (v59, carried over from the old
          Calendar tab): start date + period length, POST
          /period/reset. No cycle length field: the app learns her
          real cycle length from the starts she logs. */}
      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent className="glass-card text-[#FDF8FA] w-[90vw] max-w-[320px] rounded-2xl p-5" style={{ border: `1px solid ${MENSTRUAL_TINT}33` }}>
          <DialogHeader>
            <DialogTitle className="text-lg text-center">
              Start New Cycle
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <div className="mb-4">
              <label className="text-[#CFC3CC] text-xs mb-2 block" style={POPPINS}>When did your period start?</label>
              <DateSelect
                testId="reset-date-input"
                value={newPeriodDate}
                onChange={setNewPeriodDate}
                minYear={new Date().getFullYear() - 2}
                maxYear={new Date().getFullYear()}
              />
            </div>
            <div className="mb-4">
              <label className="text-[#CFC3CC] text-xs mb-2 block" style={POPPINS}>How many days does your period last?</label>
              <input
                type="number"
                inputMode="numeric"
                min="2"
                max="10"
                value={newPeriodLength}
                onChange={(e) => setNewPeriodLength(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-center text-lg"
                placeholder="5"
                style={{ fontSize: '16px' }}
                data-testid="reset-period-length-input"
              />
              <p className="text-[#CFC3CC] text-[10px] mt-1.5" style={POPPINS}>Defaults to 5. We&apos;ll auto-mark these days on your calendar.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowResetDialog(false)}
                className="flex-1 py-3 rounded-full bg-white/5 border border-white/10 text-[#C9B8C1] text-sm"
                style={POPPINS}
              >
                Cancel
              </button>
              <button
                data-testid="confirm-reset-btn"
                onClick={handleResetPeriod}
                disabled={resetting || !newPeriodDate}
                className="flex-1 py-3 rounded-full text-white text-sm font-medium disabled:opacity-50"
                style={{ ...POPPINS, background: `linear-gradient(135deg, ${MENSTRUAL_TINT_2}, ${MENSTRUAL_TINT})` }}
              >
                {resetting ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* v62 (Angelita, Nov 2, 2026): the logo and rights line sit at
          the very end of EVERY tab. Journal was missing it. */}
      {!embedded && <TabFooter />}
    </div>
  );
}
