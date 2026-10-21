import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePremium } from '../context/PremiumContext';
import { Droplet, X, Check } from 'lucide-react';
import axios from 'axios';
import DailyRead from '../components/DailyRead';
import FloatingCarousel from '../components/FloatingCarousel';
import logger from '../utils/logger';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Local-date helpers for the "This Time Last Cycle" card. Log dates are
// stored as YYYY-MM-DD, so parse and format in local time to match the
// Calendar's day view exactly (no UTC drift).
const parseLocalDate = (s) => {
  const [y, m, d] = String(s || '').slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};
const toISODateLocal = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;

// Educational card that opens when a phase row is tapped (Angelita's phase
// cards, approved Oct 17). Rows carry no hint text; tapping is discovered.
const PHASE_CARDS = {
  menstrual: { src: '/images/phase-menstrual.png', name: 'Menstrual Phase' },
  follicular: { src: '/images/phase-follicular.png', name: 'Follicular Phase' },
  ovulatory: { src: '/images/phase-ovulatory.png', name: 'Ovulatory Phase' },
  luteal: { src: '/images/phase-luteal.png', name: 'Luteal Phase' },
};

const phases = {
  menstrual: { orb: 'orb-menstrual', color: '#ff6b6b', name: 'Menstrual Phase' },
  follicular: { orb: 'orb-follicular', color: '#74b9ff', name: 'Follicular Phase' },
  ovulatory: { orb: 'orb-ovulatory', color: '#55efc4', name: 'Ovulatory Phase' },
  luteal: { orb: 'orb-luteal', color: '#a29bfe', name: 'Luteal Phase' },
  late: { orb: 'orb-menstrual', color: '#ff6b6b', name: 'Period Expected' },
  unknown: { orb: 'orb-follicular', color: '#74b9ff', name: 'Setup Required' }
};

export default function HomePage() {
  const { user, token } = useAuth();
  const { refreshCustomerInfo, companionEntitled } = usePremium();
  const [data, setData] = useState(null);
  const [cycleLogs, setCycleLogs] = useState(null);
  const [openPhaseCard, setOpenPhaseCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paymentBanner, setPaymentBanner] = useState(null); // 'pending' | 'success' | 'failed'
  const [showWelcome, setShowWelcome] = useState(false);
  // Welcome message after onboarding completes
  useEffect(() => {
    if (localStorage.getItem('hormoscope-show-welcome') === 'true') {
      setShowWelcome(true);
      localStorage.removeItem('hormoscope-show-welcome');
    }
  }, []);

  // Stripe redirect — poll for payment status if ?stripe_session_id is present
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sid = params.get('stripe_session_id');
    if (!sid || !token) return;
    setPaymentBanner('pending');
    let attempts = 0;
    const maxAttempts = 8;
    const interval = setInterval(async () => {
      attempts += 1;
      try {
        const res = await axios.get(`${API}/payments/v1/checkout/status/${sid}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.data?.payment_status === 'paid') {
          clearInterval(interval);
          setPaymentBanner('success');
          await refreshCustomerInfo();
          // Clean the URL
          window.history.replaceState({}, '', '/');
        } else if (res.data?.status === 'expired' || attempts >= maxAttempts) {
          clearInterval(interval);
          setPaymentBanner('failed');
        }
      } catch (err) {
        if (attempts >= maxAttempts) {
          clearInterval(interval);
          setPaymentBanner('failed');
        }
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [token, refreshCustomerInfo]);

  const fetchData = useCallback(async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [dashRes, logsRes] = await Promise.all([
        axios.get(`${API}/dashboard`, { headers }),
        axios.get(`${API}/cycle-logs`, { headers }).catch(() => null),
      ]);
      setData(dashRes.data);
      if (logsRes) setCycleLogs(logsRes.data);
    } catch (err) {
      logger.error(err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  /* eslint-disable */
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* eslint-enable */

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="cycle-orb orb-follicular w-16 h-16" />
      </div>
    );
  }

  const phase = data?.cycle_info?.phase || 'unknown';
  const config = phases[phase] || phases.unknown;
  const cycle = data?.cycle_info || {};
  const mood = data?.mood_prediction || {};

  // Address her by her first name wherever the app greets her
  // (Angelita, Oct 17). The dashboard's user_name falls back to
  // "Beautiful" server-side when she has not given a name, so that word
  // is not a name and never becomes a first name.
  const rawName = (user?.name || data?.user_name || '').trim();
  const firstName = rawName && rawName !== 'Beautiful' ? rawName.split(/\s+/)[0] : null;
  const hourNow = new Date().getHours();
  const dayGreeting = hourNow < 12 ? 'Good morning' : hourNow < 18 ? 'Good afternoon' : 'Good evening';
  const periodIsLate = cycle.period_is_late || false;
  const daysLate = cycle.days_late || 0;

  // "This Time Last Cycle": the same cycle day one cycle ago, and what she
  // logged on it, in her own words. The current cycle start is her last
  // period date walked forward in whole cycle lengths (the same projection
  // the Calendar uses), so the match is truly the same cycle day, not just
  // today minus a fixed number of days. Fails quietly: if the dashboard or
  // her logs did not load, or there is no period date yet, no card renders.
  let lastCycle = null;
  if (data && cycleLogs && user?.last_period_date) {
    const cycleLength = cycle.cycle_length || user.cycle_length || 28;
    const firstStart = parseLocalDate(user.last_period_date);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    if (firstStart && firstStart <= todayStart && cycleLength > 0) {
      let cycleStart = firstStart;
      for (;;) {
        const next = new Date(cycleStart);
        next.setDate(next.getDate() + cycleLength);
        if (next <= todayStart) cycleStart = next;
        else break;
      }
      const cycleDay = Math.round((todayStart - cycleStart) / 86400000) + 1;
      const matchDate = new Date(cycleStart);
      matchDate.setDate(matchDate.getDate() - cycleLength + (cycleDay - 1));
      const matchISO = toISODateLocal(matchDate);
      const lines = [];
      cycleLogs.filter((l) => l.date === matchISO).forEach((log) => {
        const text = log.notes || (log.symptoms?.length ? log.symptoms.join(', ') : '');
        if (text) lines.push(text);
        if (log.flow) lines.push(`Flow: ${log.flow}`);
      });
      lastCycle = {
        cycleDay,
        dateLabel: matchDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        lines,
      };
    }
  }

  return (
    <div className="min-h-screen pb-28 lg:pb-8 lg:pl-64 px-5 pt-8">
      
      {/* Header */}
      <div className="text-center mb-8">
        <p className="text-[#6c6c8a] text-xs tracking-widest uppercase mb-2">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
        <h1 className="text-3xl text-white mb-3 font-script">
          {firstName ? `${dayGreeting}, ${firstName}` : `Hello, ${data?.user_name || 'Beautiful'}`}
        </h1>
      </div>

      {/* Welcome message after onboarding */}
      {showWelcome && (
        <div className="card p-6 mb-6 border border-[#D4A853]/40 bg-[#D4A853]/10 text-center relative overflow-hidden" data-testid="welcome-banner">
          {/* Her girls holding signs picture in the welcome banner, and
              the welcome words in bright pink (Angelita, Oct 21, 2026). */}
          <img src="/images/welcome-signs.jpg" alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover" style={{ opacity: 0.35 }} />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(10,10,26,0.45) 0%, rgba(10,10,26,0.72) 100%)' }} />
          <div className="relative">
          <p className="text-xl font-script mb-2" style={{ color: '#FF1493' }}>Welcome to your true HORMOscope.</p>
          <p className="text-[#b8b8d1] text-sm">Your cycle, decoded. Let&apos;s begin.</p>
          <button
            onClick={() => setShowWelcome(false)}
            className="mt-4 px-6 py-2 rounded-full text-sm text-white"
            style={{ background: '#FF1493' }}
          >
            Begin
          </button>
          </div>
        </div>
      )}

      {/* Stripe payment banner */}
      {paymentBanner && (
        <div className={`card p-4 mb-6 border ${paymentBanner === 'success' ? 'border-[#D4A853]/40 bg-[#D4A853]/10' : paymentBanner === 'failed' ? 'border-[#ff6b6b]/30 bg-[#ff6b6b]/5' : 'border-white/20 bg-white/5'}`} data-testid={`payment-banner-${paymentBanner}`}>
          <p className="text-sm text-white">
            {paymentBanner === 'pending' && 'Confirming your payment…'}
            {paymentBanner === 'success' && '✨ Your subscription is active. Welcome in.'}
            {paymentBanner === 'failed' && 'We couldn\'t confirm your payment yet. If you completed checkout, refresh in a minute and your access will activate automatically.'}
          </p>
        </div>
      )}

      {/* Period Late Info - Simple message */}
      {periodIsLate && (
        <div className="card p-4 mb-6 border border-[#ff6b6b]/30 bg-[#ff6b6b]/5">
          <div className="flex items-center gap-3">
            <Droplet className="w-5 h-5 text-[#ff6b6b] flex-shrink-0" fill="#ff6b6b" />
            <p className="text-[#b8b8d1] text-sm">
              {daysLate === 0
                ? <>Period expected today • <span className="text-[#ff6b6b]">Reset in Calendar tab when it starts</span></>
                : <>Period {daysLate} day{daysLate !== 1 ? 's' : ''} late • <span className="text-[#ff6b6b]">Reset in Calendar tab when it starts</span></>
              }
            </p>
          </div>
        </div>
      )}

      {/* Cycle Orb */}
      <div className="flex flex-col items-center mb-10">
        <div className={`cycle-orb ${config.orb}`}>
          <span className="text-white/90 text-sm tracking-widest uppercase font-semibold">
            {periodIsLate ? 'CYCLE DAY' : 'YOU ARE ON DAY'}
          </span>
          <span className="text-7xl font-bold text-white">{cycle.cycle_day || '?'}</span>
        </div>
        <h2 className="mt-6 text-2xl font-script" style={{ color: config.color }}>
          {config.name}
        </h2>
        <p className="text-[#b8b8d1] text-sm mt-1">
          {periodIsLate
            ? `Expected ${cycle.cycle_length}-day cycle`
            : cycle.days_until_period > 0
              ? `${cycle.days_until_period} days until next period`
              : ''
          }
        </p>
      </div>

      {/* Floating quick-log carousel */}
      <FloatingCarousel token={token} />

      {/* Mood Card: highlighted and outlined in pink (fix list, Oct 16) */}
      <div
        className="card card-pink p-5 mb-4"
        style={{ border: '2px solid #FF1493', boxShadow: '0 0 24px rgba(255,20,147,0.35)' }}
      >
        <div className="flex justify-between items-start mb-3">
          <div>
            <p className="text-[#6c6c8a] text-[10px] tracking-widest uppercase mb-1">TODAY&apos;S MOOD</p>
            <h3 className="text-white text-xl font-script">{mood.mood || 'Unknown'}</h3>
          </div>
        </div>
        <p className="text-[#b8b8d1] text-sm leading-relaxed">{mood.emotional_state}</p>
        {mood.relationship_advice && (
          <p className="text-[#ff8fab] text-xs mt-3 pt-3 border-t border-white/10">
            {mood.relationship_advice}
          </p>
        )}
      </div>

      {/* This Time Last Cycle: her own record of this same cycle day, one
          cycle ago. This is where she reads how she felt then. */}
      {lastCycle && (
        <div className="card p-5 mb-4" data-testid="this-time-last-cycle">
          <p className="text-[#6c6c8a] text-[10px] tracking-widest uppercase mb-1">This Time Last Cycle</p>
          <p className="text-[#ff8fab] text-xs mb-3" style={{ fontFamily: 'Poppins, sans-serif' }}>
            {lastCycle.dateLabel} · Cycle day {lastCycle.cycleDay}
          </p>
          {lastCycle.lines.length > 0 ? (
            <div className="space-y-2">
              {lastCycle.lines.map((line, i) => (
                <p key={`last-cycle-${i}`} className="text-[#b8b8d1] text-sm leading-relaxed">{line}</p>
              ))}
            </div>
          ) : (
            <p className="text-[#b8b8d1] text-sm leading-relaxed">
              Nothing logged on this day last cycle yet. What you log today is what you will find waiting here next cycle.
            </p>
          )}
          <p className="text-[#6c6c8a] text-xs mt-3 pt-3 border-t border-white/10">
            Every day you log lives on the Calendar. Tap any day to see it.
          </p>
        </div>
      )}

      {/* Your Daily Read is FREE for everyone (Angelita's model, Oct 18,
          2026; the backend serves it without any gate). No Pro check here. */}
      <div className="mb-4">
        <DailyRead />
      </div>

      {/* Cycle Phases */}
      <div className="card p-5 mb-4">
        <p className="text-[#6c6c8a] text-[10px] tracking-widest uppercase mb-4">YOUR CYCLE PHASES</p>
        <div className="space-y-3">
          <button type="button" onClick={() => setOpenPhaseCard('menstrual')} className={`w-full text-left cursor-pointer active:opacity-80 transition-opacity flex items-center gap-3 p-3 rounded-xl ${phase === 'menstrual' ? 'bg-[#ff6b6b]/20 border border-[#ff6b6b]/40' : 'bg-white/5'}`}>
            <div className="w-3 h-3 rounded-full bg-[#ff6b6b]" />
            <div className="flex-1">
              <p className={`text-sm font-medium ${phase === 'menstrual' ? 'text-[#ff6b6b]' : 'text-white/70'}`}>Menstrual Phase</p>
              <p className="text-[#6c6c8a] text-xs">Days 1-5 • Rest & renewal</p>
            </div>
            {phase === 'menstrual' && <span className="text-[#ff6b6b] text-xs font-medium">NOW</span>}
          </button>
          <button type="button" onClick={() => setOpenPhaseCard('follicular')} className={`w-full text-left cursor-pointer active:opacity-80 transition-opacity flex items-center gap-3 p-3 rounded-xl ${phase === 'follicular' ? 'bg-[#74b9ff]/20 border border-[#74b9ff]/40' : 'bg-white/5'}`}>
            <div className="w-3 h-3 rounded-full bg-[#74b9ff]" />
            <div className="flex-1">
              <p className={`text-sm font-medium ${phase === 'follicular' ? 'text-[#74b9ff]' : 'text-white/70'}`}>Follicular Phase</p>
              <p className="text-[#6c6c8a] text-xs">Days 6-12 • Rising energy</p>
            </div>
            {phase === 'follicular' && <span className="text-[#74b9ff] text-xs font-medium">NOW</span>}
          </button>
          <button type="button" onClick={() => setOpenPhaseCard('ovulatory')} className={`w-full text-left cursor-pointer active:opacity-80 transition-opacity flex items-center gap-3 p-3 rounded-xl ${phase === 'ovulatory' ? 'bg-[#55efc4]/20 border border-[#55efc4]/40' : 'bg-white/5'}`}>
            <div className="w-3 h-3 rounded-full bg-[#55efc4]" />
            <div className="flex-1">
              <p className={`text-sm font-medium ${phase === 'ovulatory' ? 'text-[#55efc4]' : 'text-white/70'}`}>Ovulatory Phase</p>
              <p className="text-[#6c6c8a] text-xs">Days 13-19 • Peak confidence</p>
            </div>
            {phase === 'ovulatory' && <span className="text-[#55efc4] text-xs font-medium">NOW</span>}
          </button>
          <button type="button" onClick={() => setOpenPhaseCard('luteal')} className={`w-full text-left cursor-pointer active:opacity-80 transition-opacity flex items-center gap-3 p-3 rounded-xl ${phase === 'luteal' ? 'bg-[#a29bfe]/20 border border-[#a29bfe]/40' : 'bg-white/5'}`}>
            <div className="w-3 h-3 rounded-full bg-[#a29bfe]" />
            <div className="flex-1">
              <p className={`text-sm font-medium ${phase === 'luteal' ? 'text-[#a29bfe]' : 'text-white/70'}`}>Luteal Phase</p>
              <p className="text-[#6c6c8a] text-xs">Days 20+ • Slow down</p>
            </div>
            {phase === 'luteal' && <span className="text-[#a29bfe] text-xs font-medium">NOW</span>}
          </button>
          {/* Period Expected - shows when late */}
          {periodIsLate && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-[#ff6b6b]/20 border border-[#ff6b6b]/40 animate-pulse">
              <div className="w-3 h-3 rounded-full bg-[#ff6b6b]" />
              <div className="flex-1">
                <p className="text-sm font-medium text-[#ff6b6b]">Period Expected</p>
                <p className="text-[#6c6c8a] text-xs">Waiting for your period to start</p>
              </div>
              <span className="text-[#ff6b6b] text-xs font-medium">WAITING</span>
            </div>
          )}
        </div>
      </div>

      {/* Affirmation */}
      <div className="card p-5 mb-4">
        <p className="text-[#6c6c8a] text-[10px] tracking-widest uppercase mb-3">TODAY&apos;S AFFIRMATION</p>
        <p className="text-white text-base italic leading-relaxed">&ldquo;{data?.affirmation}&rdquo;</p>
      </div>

      {/* Do / Avoid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="card p-4">
          <p className="text-[#55efc4] text-[10px] tracking-widest uppercase mb-3">DO TODAY</p>
          <div className="space-y-2">
            {(mood.best_activities || []).slice(0, 3).map((act) => (
              <p key={`do-${act}`} className="text-[#b8b8d1] text-xs">• {act}</p>
            ))}
          </div>
        </div>
        <div className="card p-4">
          <p className="text-[#ff6b6b] text-[10px] tracking-widest uppercase mb-3">AVOID</p>
          <div className="space-y-2">
            {(mood.avoid_activities || []).slice(0, 3).map((act) => (
              <p key={`avoid-${act}`} className="text-[#b8b8d1] text-xs">• {act}</p>
            ))}
          </div>
        </div>
      </div>

      {/* Nutrition - Eat & Avoid */}
      <div className="card p-5 mb-4">
        <p className="text-[#6c6c8a] text-[10px] tracking-widest uppercase mb-3">NUTRITION</p>
        <p className="text-[#b8b8d1] text-sm mb-4">{data?.nutrition_tip}</p>
        
        {/* Eat Section */}
        <div className="mb-4">
          <p className="text-[#55efc4] text-[10px] tracking-widest uppercase mb-2">🥗 EAT</p>
          <div className="flex flex-wrap gap-2">
            {(data?.foods_to_eat || []).map((food) => (
              <span key={`eat-${food}`} className="tag tag-green">{food}</span>
            ))}
          </div>
        </div>
        
        {/* Avoid Section */}
        <div>
          <p className="text-[#ff6b6b] text-[10px] tracking-widest uppercase mb-2">🚫 AVOID</p>
          <div className="flex flex-wrap gap-2">
            {(data?.foods_to_avoid || []).map((food) => (
              <span key={`avoid-food-${food}`} className="tag tag-red">{food}</span>
            ))}
          </div>
        </div>

        {/* Easy recipe for today, built from today's foods (Angelita, Oct 20) */}
        {data?.recipe && (
          <div className="mt-5" style={{ borderTop: '1px solid rgba(244,167,185,0.12)', paddingTop: '16px' }} data-testid="daily-recipe">
            <p className="text-[#6c6c8a] text-[10px] tracking-widest uppercase mb-2">EASY RECIPE FOR TODAY</p>
            <p className="text-white text-sm font-medium mb-1">{data.recipe.title}</p>
            <p className="text-[#6c6c8a] text-[11px] mb-3">About {data.recipe.minutes} minutes</p>
            <div className="space-y-1.5 mb-3">
              {(data.recipe.ingredients || []).map((ing) => (
                <p key={`ing-${ing}`} className="text-[#b8b8d1] text-xs">• {ing}</p>
              ))}
            </div>
            <div className="space-y-1.5">
              {(data.recipe.steps || []).map((step, i) => (
                <p key={`step-${i}`} className="text-[#b8b8d1] text-xs leading-relaxed">{i + 1}. {step}</p>
              ))}
            </div>
          </div>
        )}

        {/* Vitamins for today and this phase (Angelita, Oct 20) */}
        {Array.isArray(data?.vitamins) && data.vitamins.length > 0 && (
          <div className="mt-5" style={{ borderTop: '1px solid rgba(244,167,185,0.12)', paddingTop: '16px' }} data-testid="daily-vitamins">
            <p className="text-[#6c6c8a] text-[10px] tracking-widest uppercase mb-2">VITAMINS FOR TODAY</p>
            <div className="space-y-2">
              {data.vitamins.map((v) => (
                <p key={`vit-${v.name}`} className="text-[#b8b8d1] text-xs leading-relaxed"><span className="text-white font-medium">{v.name}:</span> {v.why}</p>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Wellness Tip */}
      <div className="card p-5">
        <p className="text-[#6c6c8a] text-[10px] tracking-widest uppercase mb-3">WELLNESS TIP</p>
        <p className="text-[#b8b8d1] text-sm leading-relaxed">{data?.wellness_tip}</p>
      </div>


      {/* Phase card overlay — opens from a phase row, covers the whole
          screen including the bottom nav, scrolls vertically. data-no-swipe
          keeps the tab-swipe handler out while it is open. */}
      {openPhaseCard && PHASE_CARDS[openPhaseCard] && (
        <div
          className="fixed inset-0 z-[80] flex flex-col"
          style={{ background: '#0a0a1a' }}
          data-no-swipe="true"
          data-testid="phase-card-overlay"
        >
          <div className="flex items-center justify-between px-5 py-4 flex-shrink-0">
            <h2 className="text-white text-xl font-script">{PHASE_CARDS[openPhaseCard].name}</h2>
            <button
              type="button"
              onClick={() => setOpenPhaseCard(null)}
              aria-label="Close"
              className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 text-white active:opacity-70"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 pb-10">
            <img
              src={PHASE_CARDS[openPhaseCard].src}
              alt={`${PHASE_CARDS[openPhaseCard].name} card`}
              className="w-full max-w-md mx-auto rounded-2xl"
            />
          </div>
        </div>
      )}

    </div>
  );
}
