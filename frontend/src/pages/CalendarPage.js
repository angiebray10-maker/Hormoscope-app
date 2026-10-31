import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { Calendar as CalendarIcon, Heart, Droplet, ChevronLeft, ChevronRight, Plus, X, RotateCcw, Baby, CircleDot, HelpCircle } from 'lucide-react';
import { Button } from '../components/ui/button';
import DateSelect from '../components/DateSelect';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import logger from '../utils/logger';
import TabFooter from '../components/TabFooter';
import { PHASE_PAIRS, phaseTint, phaseForDate } from '../lib/phases';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// v55: Calendar colors come from the phase pair system
// (lib/phases.js PHASE_PAIRS), never hard coded hexes that can drift.
// Period days wear the menstrual pair's red; fertile days the
// ovulatory pair's green, with the pair's pink marking the peak so
// peak days stay clearly distinguishable inside the window.
const MENSTRUAL_COLOR = PHASE_PAIRS.menstrual.primary;
const MENSTRUAL_COLOR_2 = PHASE_PAIRS.menstrual.secondary;
const FERTILE_COLOR = PHASE_PAIRS.ovulatory.secondary;
const PEAK_COLOR = PHASE_PAIRS.ovulatory.primary;

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function CalendarPage() {
  const { user, token, updateUser } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [cycleLogs, setCycleLogs] = useState([]);
  const [intimacyLogs, setIntimacyLogs] = useState([]);
  const [saving, setSaving] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [showDialog, setShowDialog] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [showPartnerInput, setShowPartnerInput] = useState(false);
  const [partnerNames, setPartnerNames] = useState('');
  const [longPressDate, setLongPressDate] = useState(null);
  const longPressTimer = useRef(null);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [dashboard, setDashboard] = useState(null);
  const [cycleStats, setCycleStats] = useState(null);
  const [learnMessage, setLearnMessage] = useState('');
  const [newPeriodLength, setNewPeriodLength] = useState(user?.period_length || 5);
  const [newPeriodDate, setNewPeriodDate] = useState(new Date().toISOString().split('T')[0]);
  const navigate = useNavigate();

  const fetchLogs = useCallback(async () => {
    try {
      const [cycleRes, intimacyRes] = await Promise.all([
        axios.get(`${API}/cycle-logs`, { headers: { Authorization: `Bearer ${token}` }, params: { _t: Date.now() }, timeout: 15000 }),
        axios.get(`${API}/intimacy-logs`, { headers: { Authorization: `Bearer ${token}` }, params: { _t: Date.now() }, timeout: 15000 })
      ]);
      setCycleLogs(cycleRes.data);
      setIntimacyLogs(intimacyRes.data || []);
    } catch (err) {
      logger.error('Fetch logs error:', err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
        // v56: never a stale cached dashboard after a period log.
        params: { _t: Date.now() },
        timeout: 15000
      });
      setDashboard(res.data);
    } catch (err) {
      logger.error('Dashboard error:', err);
    }
  }, [token]);

  // Fetch cycle stats to get the real average period length calculated
  // from consecutive logged period days (not just the static user setting).
  // v56: after a period start is logged or removed, the backend
  // learning may have updated her user record (cycle length,
  // estimate flag). Pull the fresh record so this page, and Home
  // through the shared auth state, reflect the recalculation at
  // once instead of the copy from before the log.
  const refreshUser = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { _t: Date.now() },
        timeout: 15000
      });
      if (res.data) updateUser(res.data);
    } catch (err) {
      logger.error('Refresh user error:', err);
    }
  }, [token, updateUser]);

  const fetchCycleStats = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/cycle-stats`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { _t: Date.now() },
        timeout: 15000
      });
      setCycleStats(res.data);
    } catch (err) {
      logger.error('Cycle stats error:', err);
    }
  }, [token]);

  // Period length for predictions: prefer the backend's dynamically calculated
  // average from actual logged period days, falling back to the user setting.
  const getPeriodLength = () => {
    return cycleStats?.avg_period_length || user?.period_length || 5;
  };

  /* eslint-disable */
  useEffect(() => {
    fetchLogs();
    fetchDashboard();
    fetchCycleStats();
  }, [fetchLogs, fetchDashboard, fetchCycleStats]);
  /* eslint-enable */

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return { firstDay, daysInMonth };
  };

  // Next period date with a local fallback: prefer the backend dashboard value,
  // but project forward from last_period_date when the backend is unreachable
  // so ovulation/fertile displays keep working offline.
  const getNextPeriodDate = () => {
    if (dashboard?.cycle_info?.next_period_date) return dashboard.cycle_info.next_period_date;
    if (!user?.last_period_date) return null;
    const cycleLen = user.cycle_length || 28;
    const lastStart = new Date(user.last_period_date + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const next = new Date(lastStart);
    while (next <= today) {
      next.setDate(next.getDate() + cycleLen);
    }
    const y = next.getFullYear();
    const m = String(next.getMonth() + 1).padStart(2, '0');
    const d = String(next.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const formatDateString = (year, month, day) => {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const isPeriodDay = (dateStr) => {
    return cycleLogs.some(log => log.date === dateStr && log.is_period);
  };

  // Check if this date falls within ANY past period — either the current
  // last_period_date window OR projected backward by cycle_length increments.
  // This keeps historical months populated even before the user joined the app.
  const isEstimatedPeriodDay = (dateStr) => {
    if (!user?.last_period_date) return false;
    const lastPeriodStart = new Date(user.last_period_date + 'T00:00:00');
    const checkDate = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const cycleLen = user.cycle_length || 28;
    const periodLen = Math.round(getPeriodLength());

    // Only project for dates strictly in the past
    if (checkDate >= today) return false;

    // Walk backwards from last_period_date in cycle_length increments up to 24 months.
    // For each projected start, check if checkDate falls within periodLen days.
    const MAX_CYCLES_BACK = 24;
    for (let k = 0; k < MAX_CYCLES_BACK; k++) {
      const projectedStart = new Date(lastPeriodStart);
      projectedStart.setDate(projectedStart.getDate() - (k * cycleLen));
      const projectedEnd = new Date(projectedStart);
      projectedEnd.setDate(projectedEnd.getDate() + (periodLen - 1));
      if (checkDate >= projectedStart && checkDate <= projectedEnd) {
        return true;
      }
      // Early break — once projectedStart is far past checkDate, stop walking
      if (projectedStart < checkDate && (checkDate - projectedStart) > (cycleLen * 24 * 60 * 60 * 1000)) {
        break;
      }
    }
    return false;
  };

  // Check if this date falls within the predicted FUTURE period range.
  // Uses the actual average period length from logged days so the marked
  // range matches her real cycle, falling back to the user setting.
  const isExpectedPeriodRange = (dateStr) => {
    const npd = getNextPeriodDate();
    if (!npd) return false;
    const nextPeriodStart = new Date(npd + 'T00:00:00');
    const checkDate = new Date(dateStr + 'T00:00:00');

    const periodLen = Math.round(getPeriodLength());
    const nextPeriodEnd = new Date(nextPeriodStart);
    nextPeriodEnd.setDate(nextPeriodEnd.getDate() + (periodLen - 1));

    return checkDate >= nextPeriodStart && checkDate <= nextPeriodEnd;
  };

  const isIntimacyDay = (dateStr) => {
    return intimacyLogs.some(log => log.date === dateStr);
  };

  // Check if this is THE expected next period day
  const isNextPeriodDay = (dateStr) => {
    const npd = getNextPeriodDate();
    if (!npd) return false;
    return dateStr === npd;
  };

  // Check if date is in fertile/ovulation window
  // Off for birth control / pregnancy / postpartum / menopause.
  const fertilityOn = user?.fertility_predictions_enabled !== false;

  // v56 OVULATION ANCHOR: ovulation day = the period start of the
  // cycle a date belongs to + 14 days (replacing next period minus
  // 14 everywhere). Projected period starts are her last logged
  // start walked by whole cycle lengths, so any grid date's cycle
  // start can be found the same way the expected-period projection
  // already walks. The fertile window keeps its relative shape
  // around the anchor: 5 days before through 1 day after, peak the
  // day before and the day of.
  const getCycleStartFor = (dateStr) => {
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
  };

  const getOvulationFor = (dateStr) => {
    const cycleStart = getCycleStartFor(dateStr);
    if (!cycleStart) return null;
    const ov = new Date(cycleStart);
    ov.setDate(ov.getDate() + 14);
    return ov;
  };

  const isOvulationDay = (dateStr) => {
    if (!fertilityOn) return false;
    const ovulationDate = getOvulationFor(dateStr);
    if (!ovulationDate) return false;
    const checkDate = new Date(dateStr + 'T00:00:00');

    const fertileStart = new Date(ovulationDate);
    fertileStart.setDate(fertileStart.getDate() - 5);
    const fertileEnd = new Date(ovulationDate);
    fertileEnd.setDate(fertileEnd.getDate() + 1);

    return checkDate >= fertileStart && checkDate <= fertileEnd;
  };

  const isPeakOvulation = (dateStr) => {
    if (!fertilityOn) return false;
    const ovulationDate = getOvulationFor(dateStr);
    if (!ovulationDate) return false;
    const checkDate = new Date(dateStr + 'T00:00:00');

    const diffDays = Math.floor((checkDate - ovulationDate) / (1000 * 60 * 60 * 24));
    return diffDays >= -1 && diffDays <= 0;
  };

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleDayClick = (day) => {
    const dateStr = formatDateString(currentDate.getFullYear(), currentDate.getMonth(), day);
    setSelectedDate(dateStr);
    setShowDialog(true);
  };

  const handleLogPeriod = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await axios.post(`${API}/cycle-logs`, {
        date: selectedDate,
        is_period: true,
        flow: 'medium'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      await Promise.all([fetchLogs(), fetchDashboard(), fetchCycleStats(), refreshUser()]);
      setShowDialog(false);
    } catch (err) {
      logger.error('Log period error:', err);
      alert('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogIntimacy = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await axios.post(`${API}/intimacy-logs`, {
        date: selectedDate
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      await fetchLogs();
      setShowDialog(false);
    } catch (err) {
      logger.error('Log intimacy error:', err);
      alert('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitIntimacy = async () => {
    if (saving || !longPressDate) return;
    setSaving(true);
    try {
      const log = intimacyLogs.find(l => l.date === longPressDate);
      if (log) {
        await axios.post(`${API}/intimacy-logs/update-partners`, {
          date: longPressDate,
          partners: partnerNames.trim()
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      await fetchLogs();
      setShowPartnerInput(false);
    } catch (err) {
      logger.error('Update partners error:', err);
    } finally {
      setSaving(false);
    }
  };

  const longPressTriggered = useRef(false);

  const handleLongPressStart = (day) => {
    longPressTriggered.current = false;
    const dateStr = formatDateString(currentDate.getFullYear(), currentDate.getMonth(), day);
    if (!isIntimacyDay(dateStr)) return;
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      const log = intimacyLogs.find(l => l.date === dateStr);
      setLongPressDate(dateStr);
      setPartnerNames(log?.partners || '');
      setShowPartnerInput(true);
    }, 500);
  };

  const handleLongPressEnd = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  const handleDayClickWrapped = (day) => {
    if (longPressTriggered.current) {
      longPressTriggered.current = false;
      return;
    }
    handleDayClick(day);
  };

  const handleRemovePeriod = async () => {
    const log = cycleLogs.find(l => l.date === selectedDate && l.is_period);
    if (log) {
      try {
        await axios.delete(`${API}/cycle-logs/${log.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        await Promise.all([fetchLogs(), fetchDashboard(), fetchCycleStats(), refreshUser()]);
        setShowDialog(false);
      } catch (err) {
        logger.error('Remove period error:', err);
      }
    }
  };

  const handleRemoveIntimacy = async () => {
    const log = intimacyLogs.find(l => l.date === selectedDate);
    if (log) {
      try {
        await axios.delete(`${API}/intimacy-logs/${log.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        fetchLogs();
        setShowDialog(false);
      } catch (err) {
        logger.error('Remove intimacy error:', err);
      }
    }
  };

  const handleResetPeriod = async () => {
    if (!newPeriodDate) {
      alert('Please select a date');
      return;
    }
    setResetting(true);
    try {
      // v55: no cycle_length is sent anymore. The dialog stopped
      // asking, and the server ignores one anyway: her logged starts
      // teach the app her real length (the old payload re-asserted
      // parseInt(newCycleLength) || 28 on every reset).
      const res = await axios.post(`${API}/period/reset`, {
        new_period_date: newPeriodDate,
        period_length: parseInt(newPeriodLength) || 5
      }, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 15000
      });
      if (res.data) {
        const { learning, ...userData } = res.data;
        updateUser(userData);
        // Tell her what the app learned, in her pattern, with the
        // parts that exist: "You bled 5 days. Your cycle was 30
        // days. Your usual is now 5 days of bleeding and a 30 day
        // cycle." Nothing about her numbers changes silently.
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
      setResetting(false);
      await Promise.all([fetchLogs(), fetchDashboard(), fetchCycleStats()]);
    } catch (err) {
      logger.error('Reset error:', err);
      setResetting(false);
      alert('Something went wrong. Please try again.');
    }
  };

  const { firstDay, daysInMonth } = getDaysInMonth(currentDate);
  const today = new Date();
  const todayStr = formatDateString(today.getFullYear(), today.getMonth(), today.getDate());

  // Progression chart (v55): BOTH lengths, month to month, from the
  // cycle-stats this page already fetches. recent_cycles arrives
  // oldest first; the chart reads newest first. A period counts as
  // completed when a later one has started, or when its own days
  // have all passed. Bleeding bars wear the menstrual pair, cycle
  // bars the luteal pair, both from lib/phases.js.
  const chartCycles = (cycleStats?.recent_cycles || []).slice().reverse();
  const periodCompleted = (c, i) => {
    if (i > 0) return true;
    const end = new Date(c.start + 'T00:00:00');
    end.setDate(end.getDate() + (c.period_length || 1) - 1);
    const t = new Date(); t.setHours(0, 0, 0, 0);
    return end < t;
  };
  const cycleRows = chartCycles.filter((c) => c.cycle_length);
  const bleedMax = Math.max(10, ...chartCycles.map((c) => c.period_length || 0));
  const cycleMax = Math.max(40, ...cycleRows.map((c) => c.cycle_length || 0));
  const monthLabel = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  // The estimate explanation (fix list item E) stays until her first
  // full cycle is truly logged: the placeholder estimate flag clears
  // when learning lands, and two tracked cycles mean the same thing
  // for accounts from before the flag existed.
  const showEstimateExplainer = !user?.no_periods && user?.cycle_status !== 'no_periods'
    && (user?.cycle_length_is_estimate || (cycleStats && cycleStats.cycles_tracked < 2));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="cycle-orb orb-follicular w-16 h-16" />
      </div>
    );
  }

  return (
    <div className="pb-32 lg:pb-8 lg:pl-72 p-6 min-h-screen">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="label-luxe mb-2">Your Cycle</p>
          <h1 className="text-4xl text-[#F4D3DC] font-script">
            Calendar
          </h1>
          <p className="text-[#CFC3CC] text-xs mt-2" style={{ fontFamily: 'Poppins, sans-serif' }}>Tap any day, past or present, to add or remove a period day, log symptoms (including PMDD), or intimacy. Irregular cycle? Just log each period as it comes and predictions follow.</p>
        </div>
        <button
          data-testid="reset-period-btn"
          onClick={() => setShowResetDialog(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-xs tracking-wider" style={{ color: MENSTRUAL_COLOR }}
        >
          <RotateCcw className="w-4 h-4" />
          Reset Period
        </button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <span className="flex items-center gap-1.5 text-[#CFC3CC] text-xs">
          <Droplet className="w-3 h-3" style={{ color: MENSTRUAL_COLOR }} fill={MENSTRUAL_COLOR} /> Confirmed
        </span>
        <span className="flex items-center gap-1.5 text-[#CFC3CC] text-xs">
          <span className="w-3.5 h-3.5 rounded" style={{ background: `${MENSTRUAL_COLOR}1A`, border: `1px dashed ${MENSTRUAL_COLOR}66` }} /> Expected
        </span>
        <span className="flex items-center gap-1.5 text-[#CFC3CC] text-xs">
          <span className="w-3 h-3 rounded" style={{ background: `linear-gradient(135deg, ${PEAK_COLOR}, ${FERTILE_COLOR})` }} /> Fertile (estimated)
        </span>
        <span className="flex items-center gap-1.5 text-[#CFC3CC] text-xs">
          <Heart className="w-3 h-3" style={{ color: '#FF4F9A' }} fill="#FF4F9A" strokeWidth={2.5} /> Intimacy
        </span>
      </div>

      {/* Help Card - Period Late/Early */}
      {dashboard?.cycle_info?.period_is_late && (
        <div className="glass-card p-4 mb-4" style={{ border: `1px solid ${MENSTRUAL_COLOR}4D`, background: `${MENSTRUAL_COLOR}0D` }}>
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${MENSTRUAL_COLOR}33` }}>
              <HelpCircle className="w-5 h-5" style={{ color: MENSTRUAL_COLOR }} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium mb-2" style={{ color: MENSTRUAL_COLOR }}>{dashboard.cycle_info.days_late === 0 ? 'Period expected today' : `Period is ${dashboard.cycle_info.days_late} day${dashboard.cycle_info.days_late !== 1 ? 's' : ''} late`}</p>
              <p className="text-[#CFC3CC] text-xs leading-relaxed mb-3">
                When your period starts, tap the <strong className="text-[#F4D3DC]">&ldquo;Reset Period&rdquo;</strong> button below to reset your cycle to Day 1.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Learned confirmation (v55): after a Reset that taught the
          app something, she sees exactly what it learned. */}
      {learnMessage && (
        <div className="glass-card p-4 mb-4" style={{ border: `1px solid ${MENSTRUAL_COLOR}4D` }} data-testid="learn-message">
          <p className="text-[#FDF8FA] text-sm leading-relaxed" style={{ fontFamily: 'Poppins, sans-serif' }}>{learnMessage}</p>
        </div>
      )}

      {/* Month Navigation */}
      <div className="glass-card p-5 mb-6">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={handlePrevMonth}
            className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-[#C9B8C1] hover:bg-white/10 transition-all"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 
            className="text-xl tracking-wider"
            
          >
            {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h2>
          <button
            onClick={handleNextMonth}
            className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-[#C9B8C1] hover:bg-white/10 transition-all"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Day Headers */}
        <div className="grid grid-cols-7 gap-1 mb-3">
          {DAYS.map(day => (
            <div key={day} className="text-center text-[#CFC3CC] text-xs tracking-wider py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} className="aspect-square" />
          ))}
          
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dateStr = formatDateString(currentDate.getFullYear(), currentDate.getMonth(), day);
            const isPeriod = isPeriodDay(dateStr);
            const isEstimatedPeriod = isEstimatedPeriodDay(dateStr);
            const isExpectedPeriod = isExpectedPeriodRange(dateStr);
            const isIntimacy = isIntimacyDay(dateStr);
            const isToday = dateStr === todayStr;
            const isNextPeriod = isNextPeriodDay(dateStr);
            const isOvulation = isOvulationDay(dateStr);
            const isPeak = isPeakOvulation(dateStr);
            // v57 (Angelita, Oct 31, 2026): the day NUMBER wears that
            // day's phase color, the same tint her peach wears for
            // the phase (PHASE_TINTS via phases.js). One rule on
            // every calendar in the app. Outlines stay plain white.
            const dayPhaseColor = phaseTint(phaseForDate(dateStr, user?.last_period_date, user?.cycle_length || 28));

            // Show CONFIRMED period indicator (logged or past estimated)
            const showConfirmedPeriod = isPeriod || isEstimatedPeriod;
            // Show EXPECTED period (future prediction, not confirmed)
            const showExpectedPeriod = isExpectedPeriod && !showConfirmedPeriod;

            return (
              <button
                key={day}
                data-testid={`calendar-day-${day}`}
                onClick={() => handleDayClickWrapped(day)}
                onTouchStart={() => handleLongPressStart(day)}
                onTouchEnd={handleLongPressEnd}
                onMouseDown={() => handleLongPressStart(day)}
                onMouseUp={handleLongPressEnd}
                onMouseLeave={handleLongPressEnd}
                className={`
                  aspect-square rounded-xl flex flex-col items-center justify-center relative transition-all duration-300
                  ${isToday ? 'ring-2 ring-[#F4D3DC] ring-offset-1 ring-offset-[#0A0508]' : ''}
                  ${isIntimacy && !isToday ? 'ring-2 ring-[#F4D3DC]' : ''}
                `}
                style={{
                  // v55: day colors from the phase pairs. Period wears
                  // menstrual red, fertile wears ovulatory green.
                  // v57: the outlines are plain white now (the peak
                  // day keeps a white inset ring), and the day number
                  // itself wears that day's phase tint.
                  background: showExpectedPeriod
                    ? `${MENSTRUAL_COLOR}1A`
                    : showConfirmedPeriod
                      ? `${MENSTRUAL_COLOR}33`
                      : isOvulation
                        ? (isPeak ? `${FERTILE_COLOR}26` : `${FERTILE_COLOR}1A`)
                        : 'rgba(255,255,255,0.02)',
                  border: showExpectedPeriod
                    ? '1px dashed rgba(255,255,255,0.30)'
                    : '1px solid rgba(255,255,255,0.08)',
                  boxShadow: isPeak && !showConfirmedPeriod ? 'inset 0 0 0 2px rgba(255,255,255,0.35)' : undefined,
                }}
              >
                <span className="text-lg font-semibold tracking-wide z-10" style={{
                  color: showExpectedPeriod ? `${dayPhaseColor}B3` : dayPhaseColor
                }}>
                  {day}
                </span>

                {/* Confirmed period - filled droplet */}
                {showConfirmedPeriod && (
                  <Droplet
                    className="w-2.5 h-2.5 absolute top-1 right-1"
                    style={{ color: MENSTRUAL_COLOR }}
                    strokeWidth={2}
                    fill={MENSTRUAL_COLOR}
                  />
                )}

                {/* Expected period - outline droplet with ? */}
                {showExpectedPeriod && (
                  <Droplet
                    className="w-2.5 h-2.5 absolute top-1 right-1"
                    style={{ color: `${MENSTRUAL_COLOR}99` }}
                    strokeWidth={1.5}
                    fill="transparent"
                  />
                )}
                
                {/* Intimacy - small bright pink heart */}
                {isIntimacy && (
                  <Heart 
                    className="absolute bottom-1 right-1 w-2.5 h-2.5"
                    style={{ color: '#FF4F9A' }}
                    strokeWidth={2.5}
                    fill="#FF4F9A"
                  />
                )}
                
                {/* Peak ovulation indicator: the ovulatory pair's
                    pink, so the peak reads differently from the
                    green window around it */}
                {isPeak && !showConfirmedPeriod && (
                  <CircleDot className="w-2.5 h-2.5 absolute top-1 left-1" style={{ color: PEAK_COLOR }} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {/* Next Period Card */}
        {getNextPeriodDate() && (
          <div className="bento-card p-4 hover-lift">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${MENSTRUAL_COLOR}33` }}>
                <Droplet className="w-4 h-4" style={{ color: MENSTRUAL_COLOR }} fill={MENSTRUAL_COLOR} />
              </div>
            </div>
            <p className="label-luxe mb-1">Next Period</p>
            <p
              className="text-[#FDF8FA] text-sm tracking-wide"

            >
              {new Date(getNextPeriodDate() + 'T00:00:00').toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric'
              })}
            </p>
            <p className="text-xs mt-1" style={{ color: MENSTRUAL_COLOR }}>
              {(() => {
                if (dashboard?.cycle_info?.next_period_date) return `${dashboard.cycle_info.days_until_period} days`;
                const diff = Math.round((new Date(getNextPeriodDate() + 'T00:00:00') - new Date(new Date().setHours(0, 0, 0, 0))) / 86400000);
                if (diff <= 0) return 'today';
                if (diff === 1) return 'tomorrow';
                return `${diff} days`;
              })()}
            </p>
          </div>
        )}

        {/* Fertile Window Card */}
        {getNextPeriodDate() && fertilityOn && (
          <div className="bento-card p-4 hover-lift">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${FERTILE_COLOR}33` }}>
                <Baby className="w-4 h-4" style={{ color: FERTILE_COLOR }} />
              </div>
            </div>
            <p className="label-luxe mb-1">Fertile Window</p>
            <p
              className="text-[#FDF8FA] text-sm tracking-wide"

            >
              {(() => {
                // v56: anchored to this cycle's period start + 14.
                const ovulationDate = getOvulationFor(todayStr) || getOvulationFor(getNextPeriodDate());
                if (!ovulationDate) return '';
                const fertileStart = new Date(ovulationDate);
                fertileStart.setDate(fertileStart.getDate() - 5);
                return fertileStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' - ' + ovulationDate.toLocaleDateString('en-US', { day: 'numeric' });
              })()}
            </p>
            <p className="text-xs mt-1" style={{ color: FERTILE_COLOR }}>
              Estimated from your logged cycle, not a measurement
            </p>
          </div>
        )}
      </div>

      {/* Estimate explainer (fix list item E): the same words
          onboarding uses, kept here until her first full cycle is
          logged, so she knows why early dates may move. It leaves on
          its own when the learning lands; there is no close button
          to hunt for. */}
      {showEstimateExplainer && (
        <div className="glass-card p-4 mb-6" data-testid="estimate-explainer">
          <p className="text-[#CFC3CC] text-xs leading-relaxed" style={{ fontFamily: 'Poppins, sans-serif' }}>
            At first, everything is an estimate. Log the day your period starts and the day it finishes, and HORMOscope learns your real bleeding days and your real cycle length from you, month by month. The more you log, the more accurate your predictions get.
          </p>
        </div>
      )}

      {/* Progression chart (v55): both lengths, month to month */}
      {cycleStats && !user?.no_periods && user?.cycle_status !== 'no_periods' && (
        <div className="glass-card p-5 mb-6" data-testid="cycle-chart">
          <p className="label-luxe mb-1">Your Cycles</p>
          <p className="text-[#FDF8FA] text-sm mb-1" style={{ fontFamily: 'Poppins, sans-serif' }}>Month to month</p>
          <p className="text-[#CFC3CC] text-xs mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
            How many days you bled, and how long each cycle ran. The dashed line on each track is your usual for that number.
          </p>
          {chartCycles.length === 0 ? (
            <p className="text-[#CFC3CC] text-xs leading-relaxed" style={{ fontFamily: 'Poppins, sans-serif' }} data-testid="cycle-chart-empty">
              Your chart fills in as you log each period. Log the day your period starts and the day it finishes, and both lines begin here.
            </p>
          ) : (
            <div className="space-y-4">
              {chartCycles.map((c, i) => {
                const completed = periodCompleted(c, i);
                return (
                  <div key={c.start} data-testid={`cycle-chart-row-${c.start}`}>
                    <p className="text-[#E6E0EE] text-xs mb-1.5" style={{ fontFamily: 'Poppins, sans-serif' }}>{monthLabel(c.start)}</p>
                    {completed && c.period_length ? (
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[#CFC3CC] text-[10px] w-12 shrink-0" style={{ fontFamily: 'Poppins, sans-serif' }}>Bled</span>
                        <div className="relative flex-1 h-3 rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }}>
                          <div className="h-3 rounded-full" style={{ width: `${Math.max(4, (c.period_length / bleedMax) * 100)}%`, background: `linear-gradient(90deg, ${MENSTRUAL_COLOR}, ${MENSTRUAL_COLOR_2})` }} />
                          {cycleStats.avg_period_length ? (
                            <div className="absolute -top-1 -bottom-1 border-l border-dashed border-white/70" style={{ left: `${(cycleStats.avg_period_length / bleedMax) * 100}%` }} />
                          ) : null}
                        </div>
                        <span className="text-[#FDF8FA] text-[11px] w-14 shrink-0" style={{ fontFamily: 'Poppins, sans-serif' }}>{c.period_length} day{c.period_length !== 1 ? 's' : ''}</span>
                      </div>
                    ) : null}
                    {c.cycle_length ? (
                      <div className="flex items-center gap-2">
                        <span className="text-[#CFC3CC] text-[10px] w-12 shrink-0" style={{ fontFamily: 'Poppins, sans-serif' }}>Cycle</span>
                        <div className="relative flex-1 h-3 rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }}>
                          <div className="h-3 rounded-full" style={{ width: `${Math.max(4, (c.cycle_length / cycleMax) * 100)}%`, background: `linear-gradient(90deg, ${PHASE_PAIRS.luteal.primary}, ${PHASE_PAIRS.luteal.secondary})` }} />
                          {cycleStats.avg_cycle_length ? (
                            <div className="absolute -top-1 -bottom-1 border-l border-dashed border-white/70" style={{ left: `${(cycleStats.avg_cycle_length / cycleMax) * 100}%` }} />
                          ) : null}
                        </div>
                        <span className="text-[#FDF8FA] text-[11px] w-14 shrink-0" style={{ fontFamily: 'Poppins, sans-serif' }}>{c.cycle_length} days</span>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
          {cycleRows.length === 0 && (
            <p className="text-[#CFC3CC] text-xs leading-relaxed mt-4" style={{ fontFamily: 'Poppins, sans-serif' }} data-testid="cycle-length-estimate-note">
              Your cycle length is an estimate for now. We will know it for sure once you log your next period start.
            </p>
          )}
          {(cycleStats.cycles_tracked >= 1 || cycleRows.length >= 1) && (
            <p className="text-[#E6E0EE] text-xs leading-relaxed mt-4" style={{ fontFamily: 'Poppins, sans-serif' }} data-testid="cycle-chart-summary">
              {cycleStats.cycles_tracked >= 1 ? `Your period usually lasts ${Math.round(cycleStats.avg_period_length)} days. ` : ''}
              {cycleRows.length >= 1 ? `Your cycles average ${Math.round(cycleStats.avg_cycle_length)} days. ` : ''}
              {cycleRows.length >= 2 ? `Your next period is estimated within about ${cycleStats.prediction_window} days either way.` : ''}
            </p>
          )}
        </div>
      )}

      {/* Day Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="glass-card border border-white/10 text-[#FDF8FA] w-[90vw] max-w-[320px] rounded-2xl p-5">
          <DialogHeader>
            <DialogTitle className="text-lg tracking-wide text-center">
              {selectedDate && new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric'
              })}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-3 py-2">
            {/* Period Toggle */}
            <div className="flex items-center justify-between p-3 rounded-xl" style={isPeriodDay(selectedDate) ? { background: `${MENSTRUAL_COLOR}26`, border: `1px solid ${MENSTRUAL_COLOR}4D` } : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div className="flex items-center gap-2">
                <Droplet 
                  className="w-4 h-4" style={{ color: isPeriodDay(selectedDate) ? MENSTRUAL_COLOR : '#CFC3CC' }}
                  fill={isPeriodDay(selectedDate) ? MENSTRUAL_COLOR : 'transparent'} 
                />
                <span className="text-sm">Period Day</span>
              </div>
              {isPeriodDay(selectedDate) ? (
                <button 
                  type="button"
                  onClick={handleRemovePeriod} 
                  className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-white/10" style={{ color: MENSTRUAL_COLOR }} 
                  disabled={saving}
                >
                  <X className="w-5 h-5" />
                </button>
              ) : (
                <button 
                  type="button"
                  onClick={handleLogPeriod} 
                  className="text-[#F4D3DC] hover:text-white h-8 w-8 flex items-center justify-center rounded-lg hover:bg-white/10" 
                  disabled={saving} 
                  data-testid="add-period-btn"
                >
                  <Plus className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Intimacy Toggle - Free for all */}
            <div className={`flex items-center justify-between p-3 rounded-xl ${
              isIntimacyDay(selectedDate)
                ? 'bg-[#F4D3DC]/15 border border-[#F4D3DC]/30' 
                : 'bg-white/5 border border-white/10'
            }`}>
              <div className="flex items-center gap-2">
                <Heart 
                  className={`w-4 h-4 ${isIntimacyDay(selectedDate) ? 'text-[#F4D3DC]' : 'text-[#CFC3CC]'}`} 
                  strokeWidth={2}
                />
                <span className="text-sm">Intimacy</span>
              </div>
              {isIntimacyDay(selectedDate) ? (
                <button 
                  type="button"
                  onClick={handleRemoveIntimacy} 
                  className="text-[#F4D3DC] hover:text-[#F4D3DC]/80 h-8 w-8 flex items-center justify-center rounded-lg hover:bg-white/10" 
                  disabled={saving}
                >
                  <X className="w-5 h-5" />
                </button>
              ) : (
                <button 
                  type="button"
                  onClick={handleLogIntimacy} 
                  className="text-[#F4D3DC] hover:text-white h-8 w-8 flex items-center justify-center rounded-lg hover:bg-white/10" 
                  disabled={saving} 
                  data-testid="add-intimacy-btn"
                >
                  <Plus className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* The secret heart (Angelita, Oct 30, 2026): the long-press
                names function has always been here, but nothing ever
                told her it existed. One quiet line, right where she
                logs intimacy. */}
            <p className="text-[#CFC3CC] text-xs leading-relaxed px-1" style={{ fontFamily: 'Poppins, sans-serif' }} data-testid="secret-heart-hint">
              Psst. The heart is a secret button. Press and hold it to add the name, or names, for that day. Only you see them, unless you choose to share your intimacy log.
            </p>

            {/* Her logged days live in her Vault now, not on the Calendar
                (Angelita, Oct 26, 2026). Days are no longer "saved on the
                Calendar": this dialog shows her cycle only (period day,
                intimacy mark, fertile window). Quick logs still save to
                the day exactly as before; she reads them back in her
                Vault, inside her Journal. */}
            <div className="p-3 rounded-xl bg-white/5 border border-white/10" data-testid="day-logs-note">
              <p className="text-[#CFC3CC] text-xs leading-relaxed" style={{ fontFamily: 'Poppins, sans-serif' }}>
                What you log on a day is kept in your Vault, in your Journal, with the rest of your days.
              </p>
            </div>

            {/* Fertility notice */}
            {isOvulationDay(selectedDate) && (
              <div className="p-2 rounded-lg" style={{ background: `${FERTILE_COLOR}1A`, border: `1px solid ${FERTILE_COLOR}4D` }}>
                <p className="text-xs flex items-center gap-2" style={{ color: FERTILE_COLOR }}>
                  <Baby className="w-3 h-3" />
                  Fertile window (estimated)
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Reset Period Dialog */}
      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent className="glass-card text-[#FDF8FA] w-[90vw] max-w-[320px] rounded-2xl p-5" style={{ border: `1px solid ${MENSTRUAL_COLOR}33` }}>
          <DialogHeader>
            <DialogTitle className="text-lg text-center">
              Start New Cycle
            </DialogTitle>
          </DialogHeader>
          
          <div className="py-2">
            <div className="mb-4">
              <label className="text-[#CFC3CC] text-xs mb-2 block">When did your period start?</label>
              <DateSelect
                testId="reset-date-input"
                value={newPeriodDate}
                onChange={setNewPeriodDate}
                minYear={new Date().getFullYear() - 2}
                maxYear={new Date().getFullYear()}
              />
            </div>
            
            {/* v55: no cycle length field here anymore. The app
                learns her real cycle length from the starts she
                logs; asking her to type it again only overwrote
                what it had learned. */}
            <div className="mb-4">
              <label className="text-[#CFC3CC] text-xs mb-2 block">How many days does your period last?</label>
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
              <p className="text-[#CFC3CC] text-[10px] mt-1.5">Defaults to 5. We&apos;ll auto-mark these days on your calendar.</p>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => setShowResetDialog(false)}
                className="flex-1 py-3 rounded-full bg-white/5 border border-white/10 text-[#C9B8C1] text-sm"
              >
                Cancel
              </button>
              <button
                data-testid="confirm-reset-btn"
                onClick={handleResetPeriod}
                disabled={resetting || !newPeriodDate}
                className="flex-1 py-3 rounded-full text-white text-sm font-medium disabled:opacity-50" style={{ background: `linear-gradient(135deg, ${MENSTRUAL_COLOR_2}, ${MENSTRUAL_COLOR})` }}
              >
                {resetting ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Partner Name Popup — Long Press */}
      <Dialog open={showPartnerInput} onOpenChange={setShowPartnerInput}>
        <DialogContent className="bg-[#1a1a2e] border border-white/10 text-white max-w-sm mx-auto fixed top-20 left-1/2 -translate-x-1/2" style={{ margin: 0 }}>
          <DialogHeader>
            <DialogTitle className="text-lg text-[#FF4F9A]" style={{ fontFamily: "'Poiret One', sans-serif" }}>Partner(s)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-xs text-[#CFC3CC] block mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
                Add partner name(s), separate with commas
              </label>
              <input
                type="text"
                value={partnerNames}
                onChange={(e) => setPartnerNames(e.target.value)}
                placeholder="e.g. James, Michael"
                className="w-full rounded-xl px-4 py-3 text-sm text-white focus:outline-none"
                style={{ background: 'rgba(123,79,166,0.08)', border: '1px solid rgba(123,79,166,0.2)', fontFamily: 'Poppins, sans-serif' }}
                data-testid="partner-name-input"
                autoFocus
              />
              <p className="text-[10px] text-[#CFC3CC] mt-1.5" style={{ fontFamily: 'Poppins, sans-serif' }}>Completely private to you.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowPartnerInput(false)}
                className="flex-1 py-3 rounded-full bg-white/5 border border-white/10 text-[#C9B8C1] text-sm"
                style={{ fontFamily: 'Poppins, sans-serif' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitIntimacy}
                disabled={saving}
                className="flex-1 py-3 rounded-full text-white text-sm font-medium disabled:opacity-50"
                style={{ fontFamily: 'Poppins, sans-serif', background: '#FF4F9A' }}
                data-testid="submit-intimacy-btn"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* v50: our logo rests at the very bottom of the Calendar. */}
      <TabFooter />
    </div>
  );
}
