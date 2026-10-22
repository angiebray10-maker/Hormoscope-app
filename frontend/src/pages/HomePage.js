import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePremium } from '../context/PremiumContext';
import { Droplet, X, Check } from 'lucide-react';
import axios from 'axios';
import DailyRead from '../components/DailyRead';
import FloatingCarousel from '../components/FloatingCarousel';
import logger from '../utils/logger';
import { PHASE_COLORS } from '../lib/phases';

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
  menstrual: { orb: 'orb-menstrual', color: PHASE_COLORS.menstrual, name: 'Menstrual Phase' },
  follicular: { orb: 'orb-follicular', color: PHASE_COLORS.follicular, name: 'Follicular Phase' },
  ovulatory: { orb: 'orb-ovulatory', color: PHASE_COLORS.ovulatory, name: 'Ovulatory Phase' },
  luteal: { orb: 'orb-luteal', color: PHASE_COLORS.luteal, name: 'Luteal Phase' },
  late: { orb: 'orb-menstrual', color: PHASE_COLORS.menstrual, name: 'Period Expected' },
  unknown: { orb: 'orb-unknown', color: PHASE_COLORS.unknown, name: 'Log your period to begin' }
};

const PHASE_ROWS = [
  { id: 'menstrual', name: 'Menstrual Phase', days: 'Days 1-5 • Rest & renewal' },
  { id: 'follicular', name: 'Follicular Phase', days: 'Days 6-12 • Rising energy' },
  { id: 'ovulatory', name: 'Ovulatory Phase', days: 'Around ovulation • Peak confidence' },
  { id: 'luteal', name: 'Luteal Phase', days: 'Before your period • Slow down' },
];

export default function HomePage() {
  const { user, token } = useAuth();
  const { refreshCustomerInfo, companionEntitled } = usePremium();
  const [data, setData] = useState(null);
  const [cycleLogs, setCycleLogs] = useState(null);
  const [openPhaseCard, setOpenPhaseCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paymentBanner, setPaymentBanner] = useState(null); // 'pending' | 'success' | 'failed'
  const [showWelcome, setShowWelcome] = useState(false);
  const [showMore, setShowMore] = useState(false);
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
        <p className="text-[#B4B0C8] text-xs tracking-widest uppercase mb-2">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
        <h1 className="text-3xl text-white mb-3 font-script">
          {firstName ? `${dayGreeting}, ${firstName}` : `Hello, ${data?.user_name || 'Beautiful'}`}
        </h1>
      </div>

      {/* Welcome message after onboarding */}
      {showWelcome && (
        <div className="rounded-2xl p-5 mb-10 border border-[#FF4F9A]/40 text-center" style={{ background: 'rgba(255,79,154,0.08)' }} data-testid="welcome-banner">
          <p className="text-xl font-script mb-1 text-white">Welcome to your HORMOscope.</p>
          <p className="text-[#E6E0EE] text-sm">Your cycle, decoded. Log how you feel each day and it gets more personal.</p>
          <button
            onClick={() => setShowWelcome(false)}
            className="mt-4 px-6 py-2 rounded-full text-sm text-white"
            style={{ background: '#FF4F9A' }}
          >
            Begin
          </button>
        </div>
      )}

      {/* Stripe payment banner */}
      {paymentBanner && (
        <div className={`card p-4 mb-6 border ${paymentBanner === 'success' ? 'border-[#C9B8F0]/40 bg-[#C9B8F0]/10' : paymentBanner === 'failed' ? 'border-[#ff6b6b]/30 bg-[#ff6b6b]/5' : 'border-white/20 bg-white/5'}`} data-testid={`payment-banner-${paymentBanner}`}>
          <p className="text-sm text-white">
            {paymentBanner === 'pending' && 'Confirming your payment…'}
            {paymentBanner === 'success' && 'Your subscription is active. Welcome in.'}
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
      <div className="flex flex-col items-center mb-8">
        <div className="hs-orb-pulse rounded-full" style={{ boxShadow: `0 0 48px ${config.color}77, 0 0 96px ${config.color}33` }}>
        <div className={`cycle-orb ${config.orb}`} data-testid="day-circle">
          <span className="text-[#1B1030] text-xs tracking-widest uppercase font-semibold">
            {phase === 'unknown' ? 'CYCLE DAY' : periodIsLate ? 'CYCLE DAY' : 'YOU ARE ON DAY'}
          </span>
          <span className="text-7xl font-bold text-[#1B1030]">{phase === 'unknown' ? '–' : (cycle.cycle_day || '?')}</span>
        </div>
        </div>
        <h2 className="mt-5 text-2xl font-script" style={{ color: config.color }}>
          {config.name}
        </h2>
        <p className="text-[#E6E0EE] text-sm mt-1">
          {phase === 'unknown'
            ? 'Tap Calendar and log the day your period starts.'
            : periodIsLate
              ? `Expected ${cycle.cycle_length}-day cycle`
              : cycle.days_until_period > 0
                ? `${cycle.days_until_period} days until next period`
                : ''}
        </p>
      </div>

      {/* One line for today */}
      {mood.mood && phase !== 'unknown' && (
        <p className="text-center text-white text-base mb-6 px-2" data-testid="today-one-line">
          <span style={{ color: config.color }}>Today: {mood.mood}.</span>{' '}
          <span className="text-[#E6E0EE]">{(mood.emotional_state || '').split('. ')[0].replace(/\.$/, '')}.</span>
        </p>
      )}

      {/* Quick log: static row of five buttons */}
      <FloatingCarousel token={token} />

      {/* Card to the full Daily Read */}
      <div className="mb-4">
        <DailyRead />
      </div>

      <button
        type="button"
        onClick={() => setShowMore(!showMore)}
        className="w-full py-3 mb-4 rounded-full border border-white/15 text-white text-sm"
        data-testid="home-see-more"
        aria-expanded={showMore}
      >
        {showMore ? 'Show less' : 'See more: phases, food, tips'}
      </button>

      {showMore && (
      <>
      {/* This Time Last Cycle: her own record of this same cycle day, one
          cycle ago. This is where she reads how she felt then. */}
      {lastCycle && (
        <div className="card p-5 mb-4" data-testid="this-time-last-cycle">
          <p className="text-[#B4B0C8] text-[10px] tracking-widest uppercase mb-1">This Time Last Cycle</p>
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
          <p className="text-[#B4B0C8] text-xs mt-3 pt-3 border-t border-white/10">
            Every day you log lives on the Calendar. Tap any day to see it.
          </p>
        </div>
      )}

      {/* Cycle Phases */}
      <div className="card p-5 mb-4">
        <p className="text-[#E6E0EE] text-xs tracking-widest uppercase mb-4">Your cycle phases · tap to learn</p>
        <div className="space-y-3">
          {PHASE_ROWS.map((row) => {
            const c = PHASE_COLORS[row.id];
            const now = phase === row.id;
            return (
              <button key={row.id} type="button" onClick={() => setOpenPhaseCard(row.id)} className="w-full text-left flex items-center gap-3 p-3 rounded-xl" style={now ? { background: `${c}22`, border: `1px solid ${c}88` } : { background: 'rgba(255,255,255,0.05)' }} data-testid={`phase-row-${row.id}`}>
                <div className="w-3 h-3 rounded-full" style={{ background: c }} />
                <div className="flex-1">
                  <p className="text-sm font-medium" style={{ color: now ? c : '#F7F4FA' }}>{row.name}</p>
                  <p className="text-[#CFC8DC] text-xs">{row.days}</p>
                </div>
                {now && <span className="text-xs font-medium" style={{ color: c }}>NOW</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Affirmation */}
      <div className="card p-5 mb-4">
        <p className="text-[#B4B0C8] text-[10px] tracking-widest uppercase mb-3">TODAY&apos;S AFFIRMATION</p>
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
        <p className="text-[#B4B0C8] text-[10px] tracking-widest uppercase mb-3">NUTRITION</p>
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
            <p className="text-[#B4B0C8] text-[10px] tracking-widest uppercase mb-2">EASY RECIPE FOR TODAY</p>
            <p className="text-white text-sm font-medium mb-1">{data.recipe.title}</p>
            <p className="text-[#B4B0C8] text-[11px] mb-3">About {data.recipe.minutes} minutes</p>
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
            <p className="text-[#B4B0C8] text-[10px] tracking-widest uppercase mb-2">VITAMINS FOR TODAY</p>
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
        <p className="text-[#B4B0C8] text-[10px] tracking-widest uppercase mb-3">WELLNESS TIP</p>
        <p className="text-[#b8b8d1] text-sm leading-relaxed">{data?.wellness_tip}</p>
      </div>
      </>
      )}

      {/* Phase card overlay — opens from a phase row, covers the whole
          screen including the bottom nav, scrolls vertically. data-no-swipe
          keeps the tab-swipe handler out while it is open. */}
      {openPhaseCard && PHASE_CARDS[openPhaseCard] && (
        <div
          className="fixed inset-0 z-[80] flex flex-col"
          style={{ background: '#0B0B1E' }}
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
