import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { Calendar as CalendarIcon, Heart, Droplet, ChevronLeft, ChevronRight, Plus, X, Lock, RotateCcw, Baby, Sparkles, HelpCircle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import logger from '../utils/logger';
import ProUpsellBanner from '../components/ProUpsellBanner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

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
  const [showCalendarGuide, setShowCalendarGuide] = useState(false);
  const [longPressDate, setLongPressDate] = useState(null);
  const longPressTimer = useRef(null);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [dashboard, setDashboard] = useState(null);
  const [newCycleLength, setNewCycleLength] = useState(user?.cycle_length || 28);
  const [newPeriodLength, setNewPeriodLength] = useState(user?.period_length || 5);
  const [newPeriodDate, setNewPeriodDate] = useState(new Date().toISOString().split('T')[0]);
  const navigate = useNavigate();

  const fetchLogs = useCallback(async () => {
    try {
      const [cycleRes, intimacyRes] = await Promise.all([
        axios.get(`${API}/cycle-logs`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/intimacy-logs`, { headers: { Authorization: `Bearer ${token}` } })
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
        headers: { Authorization: `Bearer ${token}` }
      });
      setDashboard(res.data);
    } catch (err) {
      logger.error('Dashboard error:', err);
    }
  }, [token]);

  /* eslint-disable */
  useEffect(() => {
    fetchLogs();
    fetchDashboard();
  }, [fetchLogs, fetchDashboard]);
  /* eslint-enable */

  // Show guide once — lazy init state, no effect needed
  useState(() => {
    const seen = localStorage.getItem('calendar-guide-seen');
    if (!seen) {
      localStorage.setItem('calendar-guide-seen', 'true');
      // Defer set to next tick so initial render completes first
      setTimeout(() => setShowCalendarGuide(true), 0);
    }
  });

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return { firstDay, daysInMonth };
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
    const periodLen = user.period_length || 5;

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

  // Check if this date falls within the predicted FUTURE period range
  // Uses user.period_length so the marked range matches their cycle.
  const isExpectedPeriodRange = (dateStr) => {
    if (!dashboard?.cycle_info?.next_period_date) return false;
    const nextPeriodStart = new Date(dashboard.cycle_info.next_period_date + 'T00:00:00');
    const checkDate = new Date(dateStr + 'T00:00:00');

    const periodLen = user?.period_length || 5;
    const nextPeriodEnd = new Date(nextPeriodStart);
    nextPeriodEnd.setDate(nextPeriodEnd.getDate() + (periodLen - 1));

    return checkDate >= nextPeriodStart && checkDate <= nextPeriodEnd;
  };

  const isIntimacyDay = (dateStr) => {
    return intimacyLogs.some(log => log.date === dateStr);
  };

  // Check if this is THE expected next period day
  const isNextPeriodDay = (dateStr) => {
    if (!dashboard?.cycle_info?.next_period_date) return false;
    return dateStr === dashboard.cycle_info.next_period_date;
  };

  // Check if date is in fertile/ovulation window
  const isOvulationDay = (dateStr) => {
    if (!dashboard?.cycle_info?.next_period_date) return false;
    const nextPeriod = new Date(dashboard.cycle_info.next_period_date);
    const checkDate = new Date(dateStr);
    
    const ovulationDate = new Date(nextPeriod);
    ovulationDate.setDate(ovulationDate.getDate() - 14);
    
    const fertileStart = new Date(ovulationDate);
    fertileStart.setDate(fertileStart.getDate() - 4);
    const fertileEnd = new Date(ovulationDate);
    fertileEnd.setDate(fertileEnd.getDate() + 1);
    
    return checkDate >= fertileStart && checkDate <= fertileEnd;
  };

  const isPeakOvulation = (dateStr) => {
    if (!dashboard?.cycle_info?.next_period_date) return false;
    const nextPeriod = new Date(dashboard.cycle_info.next_period_date);
    const checkDate = new Date(dateStr);
    const ovulationDate = new Date(nextPeriod);
    ovulationDate.setDate(ovulationDate.getDate() - 14);
    
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
      await Promise.all([fetchLogs(), fetchDashboard()]);
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
        await Promise.all([fetchLogs(), fetchDashboard()]);
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
      const res = await axios.post(`${API}/period/reset`, {
        new_period_date: newPeriodDate,
        cycle_length: parseInt(newCycleLength) || 28,
        period_length: parseInt(newPeriodLength) || 5
      }, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 15000
      });
      if (res.data) {
        updateUser(res.data);
      }
      setShowResetDialog(false);
      window.location.reload();
    } catch (err) {
      logger.error('Reset error:', err);
      setResetting(false);
      alert('Something went wrong. Please try again.');
    }
  };

  const { firstDay, daysInMonth } = getDaysInMonth(currentDate);
  const today = new Date();
  const todayStr = formatDateString(today.getFullYear(), today.getMonth(), today.getDate());

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
          <p className="text-[#9A8B91] text-xs mt-2" style={{ fontFamily: 'Poppins, sans-serif' }}>Tap any calendar day to log your period, symptoms, or intimacy.</p>
        </div>
        <button
          data-testid="reset-period-btn"
          onClick={() => setShowResetDialog(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/5 border border-white/10 text-[#E85A6B] hover:bg-white/10 transition-all text-xs tracking-wider"
        >
          <RotateCcw className="w-4 h-4" />
          Reset Period
        </button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <span className="flex items-center gap-1.5 text-[#9A8B91] text-xs">
          <Droplet className="w-3 h-3 text-[#E85A6B]" fill="#E85A6B" /> Confirmed
        </span>
        <span className="flex items-center gap-1.5 text-[#9A8B91] text-xs">
          <span className="w-3.5 h-3.5 rounded bg-[#E85A6B]/10 border border-dashed border-[#E85A6B]/40" /> Expected
        </span>
        <span className="flex items-center gap-1.5 text-[#9A8B91] text-xs">
          <span className="w-3 h-3 rounded bg-[#5DBB8A]/30" /> Fertile
        </span>
        <span className="flex items-center gap-1.5 text-[#9A8B91] text-xs">
          <Heart className="w-3 h-3" style={{ color: '#FF1493' }} fill="#FF1493" strokeWidth={2.5} /> Intimacy
        </span>
      </div>

      {/* Pro Upsell — after legend, high-intent moment */}
      <div className="mb-4">
        <ProUpsellBanner context="calendar" compact />
      </div>

      {/* Help Card - Period Late/Early */}
      {dashboard?.cycle_info?.period_is_late && (
        <div className="glass-card p-4 mb-4 border border-[#E85A6B]/30 bg-[#E85A6B]/5">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#E85A6B]/20 flex items-center justify-center flex-shrink-0">
              <HelpCircle className="w-5 h-5 text-[#E85A6B]" />
            </div>
            <div className="flex-1">
              <p className="text-[#E85A6B] text-sm font-medium mb-2">{dashboard.cycle_info.days_late === 0 ? 'Period expected today' : `Period is ${dashboard.cycle_info.days_late} day${dashboard.cycle_info.days_late !== 1 ? 's' : ''} late`}</p>
              <p className="text-[#9A8B91] text-xs leading-relaxed mb-3">
                When your period starts, tap the <strong className="text-[#F4D3DC]">&ldquo;Reset Period&rdquo;</strong> button below to reset your cycle to Day 1.
              </p>
            </div>
          </div>
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
            <div key={day} className="text-center text-[#9A8B91] text-xs tracking-wider py-2">
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
                  ${showExpectedPeriod
                    ? 'bg-[#E85A6B]/10 border border-dashed border-[#E85A6B]/40'
                    : showConfirmedPeriod
                      ? 'bg-[#E85A6B]/20 border border-[#E85A6B]/50'
                      : isOvulation
                        ? isPeak 
                          ? 'bg-[#5DBB8A]/15 border border-[#5DBB8A]/40'
                          : 'bg-[#5DBB8A]/10 border border-[#5DBB8A]/25'
                        : 'bg-white/[0.02] hover:bg-white/[0.06]'
                  }
                  ${isToday ? 'ring-2 ring-[#F4D3DC] ring-offset-1 ring-offset-[#0A0508]' : ''}
                  ${isIntimacy && !isToday ? 'ring-2 ring-[#F4D3DC]' : ''}
                `}
              >
                <span className={`text-lg font-semibold tracking-wide z-10 ${
                  showConfirmedPeriod ? 'text-[#E85A6B]' : 
                  showExpectedPeriod ? 'text-[#E85A6B]/70' :
                  isOvulation ? 'text-[#5DBB8A]' :
                  isToday ? 'text-[#F4D3DC]' : 
                  'text-[#C9B8C1]'
                }`}>
                  {day}
                </span>
                
                {/* Confirmed period - filled droplet */}
                {showConfirmedPeriod && (
                  <Droplet 
                    className="w-2.5 h-2.5 text-[#E85A6B] absolute top-1 right-1" 
                    strokeWidth={2}
                    fill="#E85A6B"
                  />
                )}
                
                {/* Expected period - outline droplet with ? */}
                {showExpectedPeriod && (
                  <Droplet 
                    className="w-2.5 h-2.5 text-[#E85A6B]/60 absolute top-1 right-1" 
                    strokeWidth={1.5}
                    fill="transparent"
                  />
                )}
                
                {/* Intimacy - small bright pink heart */}
                {isIntimacy && (
                  <Heart 
                    className="absolute bottom-1 right-1 w-2.5 h-2.5"
                    style={{ color: '#FF1493' }}
                    strokeWidth={2.5}
                    fill="#FF1493"
                  />
                )}
                
                {/* Peak ovulation indicator */}
                {isPeak && !showConfirmedPeriod && (
                  <Sparkles className="w-2.5 h-2.5 text-[#5DBB8A] absolute top-1 left-1" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {/* Next Period Card */}
        {dashboard?.cycle_info?.next_period_date && (
          <div className="bento-card p-4 hover-lift">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-xl bg-[#E85A6B]/20 flex items-center justify-center">
                <Droplet className="w-4 h-4 text-[#E85A6B]" fill="#E85A6B" />
              </div>
            </div>
            <p className="label-luxe mb-1">Next Period</p>
            <p 
              className="text-[#FDF8FA] text-sm tracking-wide"
              
            >
              {new Date(dashboard.cycle_info.next_period_date + 'T00:00:00').toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric'
              })}
            </p>
            <p className="text-[#E85A6B] text-xs mt-1">
              {dashboard.cycle_info.days_until_period} days
            </p>
          </div>
        )}

        {/* Fertile Window Card */}
        {dashboard?.cycle_info?.next_period_date && (
          <div className="bento-card p-4 hover-lift">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-xl bg-[#5DBB8A]/20 flex items-center justify-center">
                <Baby className="w-4 h-4 text-[#5DBB8A]" />
              </div>
            </div>
            <p className="label-luxe mb-1">Fertile Window</p>
            <p 
              className="text-[#FDF8FA] text-sm tracking-wide"
              
            >
              {(() => {
                const nextPeriod = new Date(dashboard.cycle_info.next_period_date);
                const ovulationDate = new Date(nextPeriod);
                ovulationDate.setDate(ovulationDate.getDate() - 14);
                const fertileStart = new Date(ovulationDate);
                fertileStart.setDate(fertileStart.getDate() - 4);
                return fertileStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' - ' + ovulationDate.toLocaleDateString('en-US', { day: 'numeric' });
              })()}
            </p>
            <p className="text-[#5DBB8A] text-xs mt-1">
              High fertility
            </p>
          </div>
        )}
      </div>

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
            <div className={`flex items-center justify-between p-3 rounded-xl ${
              isPeriodDay(selectedDate) 
                ? 'bg-[#E85A6B]/15 border border-[#E85A6B]/30' 
                : 'bg-white/5 border border-white/10'
            }`}>
              <div className="flex items-center gap-2">
                <Droplet 
                  className={`w-4 h-4 ${isPeriodDay(selectedDate) ? 'text-[#E85A6B]' : 'text-[#9A8B91]'}`} 
                  fill={isPeriodDay(selectedDate) ? '#E85A6B' : 'transparent'} 
                />
                <span className="text-sm">Period Day</span>
              </div>
              {isPeriodDay(selectedDate) ? (
                <button 
                  type="button"
                  onClick={handleRemovePeriod} 
                  className="text-[#E85A6B] hover:text-[#E85A6B]/80 h-8 w-8 flex items-center justify-center rounded-lg hover:bg-white/10" 
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
                  className={`w-4 h-4 ${isIntimacyDay(selectedDate) ? 'text-[#F4D3DC]' : 'text-[#9A8B91]'}`} 
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

            {/* Fertility notice */}
            {isOvulationDay(selectedDate) && (
              <div className="p-2 rounded-lg bg-[#5DBB8A]/10 border border-[#5DBB8A]/30">
                <p className="text-[#5DBB8A] text-xs flex items-center gap-2">
                  <Baby className="w-3 h-3" />
                  Fertile window
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Reset Period Dialog */}
      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent className="glass-card border border-[#E85A6B]/20 text-[#FDF8FA] w-[90vw] max-w-[320px] rounded-2xl p-5">
          <DialogHeader>
            <DialogTitle className="text-lg text-center">
              Start New Cycle
            </DialogTitle>
          </DialogHeader>
          
          <div className="py-2">
            <div className="mb-4">
              <label className="text-[#9A8B91] text-xs mb-2 block">When did your period start?</label>
              <input
                type="date"
                value={newPeriodDate}
                onChange={(e) => setNewPeriodDate(e.target.value)}
                onFocus={(e) => e.target.showPicker && e.target.showPicker()}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white appearance-none"
                max={new Date().toISOString().split('T')[0]}
                style={{ colorScheme: 'dark', WebkitAppearance: 'none', fontSize: '16px' }}
                data-testid="reset-date-input"
              />
            </div>
            
            <div className="mb-4">
              <label className="text-[#9A8B91] text-xs mb-2 block">How long is your cycle? (days)</label>
              <input
                type="number"
                inputMode="numeric"
                min="21"
                max="40"
                value={newCycleLength}
                onChange={(e) => setNewCycleLength(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-center text-lg"
                placeholder="28"
                style={{ fontSize: '16px' }}
                data-testid="reset-cycle-input"
              />
            </div>

            <div className="mb-4">
              <label className="text-[#9A8B91] text-xs mb-2 block">How many days does your period last?</label>
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
              <p className="text-[#9A8B91] text-[10px] mt-1.5">Defaults to 5. We&apos;ll auto-mark these days on your calendar.</p>
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
                className="flex-1 py-3 rounded-full bg-[#E85A6B] text-white text-sm font-medium disabled:opacity-50"
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
            <DialogTitle className="text-lg text-[#FF1493]" style={{ fontFamily: "'Poiret One', cursive" }}>Partner(s)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-xs text-[#9A8B91] block mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
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
              <p className="text-[10px] text-[#9A8B91] mt-1.5" style={{ fontFamily: 'Poppins, sans-serif' }}>Completely private to you.</p>
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
                style={{ fontFamily: 'Poppins, sans-serif', background: '#FF1493' }}
                data-testid="submit-intimacy-btn"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* First-time Calendar Guide */}
      <Dialog open={showCalendarGuide} onOpenChange={setShowCalendarGuide}>
        <DialogContent className="bg-[#1a1a2e] border border-[#FF1493]/30 text-white max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle className="text-xl text-[#FF1493] text-center" style={{ fontFamily: "'Poiret One', cursive" }}>How to Use Your Calendar</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-3" style={{ fontFamily: 'Poppins, sans-serif' }}>
              <div className="flex items-start gap-3">
                <Droplet className="w-4 h-4 text-[#E85A6B] flex-shrink-0 mt-0.5" fill="#E85A6B" />
                <p className="text-xs text-white/80"><strong className="text-white">Tap</strong> any date to log your period start or intimacy.</p>
              </div>
              <div className="flex items-start gap-3">
                <Heart className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#FF1493' }} fill="#FF1493" />
                <p className="text-xs text-white/80">When you log <strong className="text-white">intimacy</strong>, a small pink heart appears on that date.</p>
              </div>
              <div className="flex items-start gap-3">
                <Lock className="w-4 h-4 text-[#D4A853] flex-shrink-0 mt-0.5" />
                <p className="text-xs text-white/80"><strong className="text-white">Tap and hold</strong> any date with a heart to privately log the name(s) of who you were with. Only you will ever see this.</p>
              </div>
            </div>
            <p className="text-[10px] text-[#9A8B91] text-center leading-relaxed" style={{ fontFamily: 'Poppins, sans-serif' }}>
              This is a one-time message. The tap-and-hold feature for logging partner names will not be shown or explained again. Only you will know it exists.
            </p>
            <button
              onClick={() => setShowCalendarGuide(false)}
              className="w-full py-3 rounded-full text-white text-sm font-medium"
              style={{ fontFamily: 'Poppins, sans-serif', background: '#FF1493' }}
              data-testid="guide-got-it-btn"
            >
              Got It
            </button>
          </div>
        </DialogContent>
      </Dialog>


    </div>
  );
}
