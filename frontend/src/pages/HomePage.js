import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePremium } from '../context/PremiumContext';
import { Droplet, X, Check } from 'lucide-react';
import axios from 'axios';
import DailyRead from '../components/DailyRead';
import FloatingCarousel from '../components/FloatingCarousel';
import TabFooter from '../components/TabFooter';
import RemindersCard from '../components/RemindersCard';
import logger from '../utils/logger';
import { PHASE_PAIRS } from '../lib/phases';

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

// v55: phase PAIRS are the system now (lib/phases.js PHASE_PAIRS).
// color is the pair's primary, color2 its partner: the orb glows in
// both, the phase rows dot in both.
const phases = {
  menstrual: { orb: 'orb-menstrual', color: PHASE_PAIRS.menstrual.primary, color2: PHASE_PAIRS.menstrual.secondary, tint: PHASE_PAIRS.menstrual.primary, name: 'Menstrual Phase' },
  follicular: { orb: 'orb-follicular', color: PHASE_PAIRS.follicular.primary, color2: PHASE_PAIRS.follicular.secondary, tint: PHASE_PAIRS.follicular.secondary, name: 'Follicular Phase' },
  ovulatory: { orb: 'orb-ovulatory', color: PHASE_PAIRS.ovulatory.primary, color2: PHASE_PAIRS.ovulatory.secondary, tint: PHASE_PAIRS.ovulatory.secondary, name: 'Ovulatory Phase' },
  luteal: { orb: 'orb-luteal', color: PHASE_PAIRS.luteal.primary, color2: PHASE_PAIRS.luteal.secondary, tint: PHASE_PAIRS.luteal.secondary, name: 'Luteal Phase' },
  late: { orb: 'orb-menstrual', color: PHASE_PAIRS.late.primary, color2: PHASE_PAIRS.late.secondary, tint: PHASE_PAIRS.late.primary, name: 'Period Expected' },
  unknown: { orb: 'orb-unknown', color: PHASE_PAIRS.unknown.primary, color2: PHASE_PAIRS.unknown.secondary, tint: PHASE_PAIRS.unknown.primary, name: 'Log your period to begin' }
};
// tint (Oct 31, 2026, supersedes the v56 aura): the Home day peach
// ITSELF wears the phase color. The tint is the pair color that
// names the phase on its own: menstrual red, follicular blue,
// ovulatory green, luteal purple (her example: "if I'm on my
// luteal phase, that peach needs to be purple").

const PHASE_ROWS = [
  { id: 'menstrual', name: 'Menstrual Phase', days: 'Days 1-5 • Rest & renewal' },
  { id: 'follicular', name: 'Follicular Phase', days: 'Days 6-12 • Rising energy' },
  { id: 'ovulatory', name: 'Ovulatory Phase', days: 'Around ovulation • Peak confidence' },
  { id: 'luteal', name: 'Luteal Phase', days: 'Before your period • Slow down' },
];

// Feature B (v46): for a woman who no longer has periods, Home is a
// log-based day, not a cycle day. These lines are deliberately NOT
// phase-bound: one gentle thought per day of the year, rotating.
const DAILY_WISDOM = [
  'Your body has carried you through every season so far. It deserves your kindness today.',
  'Rest is not falling behind. Rest is how strength comes back.',
  'You do not have to earn a slow day. Take it gently.',
  'Small comforts count: warm tea, soft light, an early night.',
  'How you feel today is worth writing down. Future you will be glad you did.',
  'There is no schedule your body has to keep anymore. There is only how today feels.',
  'Tend to yourself the way you would tend to someone you love.',
  'A short walk, a deep breath, a kind word to yourself. That is enough for today.',
  'Your worth was never measured by a calendar.',
  'Notice one good thing about today and hold onto it a moment longer.',
  'Gentle is not weak. Gentle is wise.',
  'You are allowed to change the plan when your body asks you to.',
  'Warmth, water, rest, light. The simple things still work.',
  'Every day you log is a day you understand yourself a little better.',
];

const MOOD_WORDS = { 1: 'Low', 2: 'Meh', 3: 'Okay', 4: 'Good', 5: 'Great' };

// What she logged on one date, in readable lines (her own view, so her
// notes show here; partner summaries never include notes).
const summarizeOwnLogs = (logs) => {
  const feelings = [];
  const symptoms = [];
  let mood = null;
  let flow = null;
  let isPeriod = false;
  const notes = [];
  (logs || []).forEach((l) => {
    if (l.flow) flow = l.flow;
    if (l.is_period) isPeriod = true;
    if (l.notes) notes.push(l.notes);
    (l.symptoms || []).forEach((s) => {
      if (typeof s !== 'string') return;
      if (s.startsWith('emotion:')) {
        const n = s.slice('emotion:'.length).replace(/_/g, ' ').trim();
        if (n) feelings.push(n.charAt(0).toUpperCase() + n.slice(1));
      } else if (s.startsWith('mood:')) {
        mood = MOOD_WORDS[Number(s.slice('mood:'.length))] || mood;
      } else if (!s.includes(':')) {
        symptoms.push(s);
      }
    });
  });
  return { feelings, symptoms, mood, flow, isPeriod, notes };
};

export default function HomePage() {
  const { user, token, updateUser } = useAuth();
  const { refreshCustomerInfo, companionEntitled } = usePremium();
  const [data, setData] = useState(null);
  const [cycleLogs, setCycleLogs] = useState(null);
  const [cycleStats, setCycleStats] = useState(null);
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
      // v56: cache-busting timestamp on every read, so after she
      // logs a period start in Calendar, Home shows the recalculated
      // dates, phase, and cycle day on the next view instead of a
      // stale cached dashboard. Home also refetches on window focus
      // (below), which is how returning to the tab is seen.
      const bust = { _t: Date.now() };
      const [dashRes, logsRes, statsRes] = await Promise.all([
        axios.get(`${API}/dashboard`, { headers, params: bust }),
        axios.get(`${API}/cycle-logs`, { headers, params: bust }).catch(() => null),
        axios.get(`${API}/cycle-stats`, { headers, params: bust }).catch(() => null),
      ]);
      setData(dashRes.data);
      if (logsRes) setCycleLogs(logsRes.data);
      if (statsRes) setCycleStats(statsRes.data);
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

  // v56: refetch when she comes back to the app or the tab, so a
  // period logged moments ago in Calendar is already reflected.
  useEffect(() => {
    const onFocus = () => fetchData();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
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
  // v56: while her cycle length is still an estimate (the estimate
  // flag, or fewer than 2 logged period starts for older accounts,
  // the same test the Calendar explainer uses), Home labels the
  // next period date as an estimate and explains why. Once learning
  // lands, both come off on their own.
  const isEstimateState = !user?.no_periods && user?.cycle_status !== 'no_periods'
    && (!!user?.cycle_length_is_estimate || (cycleStats ? cycleStats.cycles_tracked < 2 : false));

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

  // Feature B (v46): her Home when she no longer has periods. No orb,
  // no countdown, no phase rows, and no Daily Read: the phase-based
  // read would invent a phase she is not in. Instead her day is built
  // from what she logs (the plain log-focused card choice), plus a
  // rotating daily wisdom line that is not tied to any phase.
  const noPeriods = !!(user?.no_periods || user?.cycle_status === 'no_periods');
  if (noPeriods) {
    const todayISO = toISODateLocal(new Date());
    const logsArr = Array.isArray(cycleLogs) ? cycleLogs : [];
    const todaySummary = summarizeOwnLogs(logsArr.filter((l) => l.date === todayISO));
    const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
    const wisdom = DAILY_WISDOM[dayOfYear % DAILY_WISDOM.length];
    const recentDays = [];
    for (let i = 1; i <= 7; i += 1) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = toISODateLocal(d);
      const dayLogs = logsArr.filter((l) => l.date === iso);
      if (dayLogs.length) {
        recentDays.push({ iso, label: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }), summary: summarizeOwnLogs(dayLogs) });
      }
    }
    const dayLines = (s) => {
      const lines = [];
      if (s.feelings.length) lines.push(`Feeling ${s.feelings.join(', ')}`);
      if (s.mood) lines.push(`Mood: ${s.mood}`);
      if (s.symptoms.length) lines.push(s.symptoms.join(', '));
      if (s.flow) lines.push(`Flow: ${s.flow}`);
      if (s.isPeriod) lines.push('Period day');
      s.notes.forEach((n) => lines.push(n));
      return lines;
    };
    const todayLines = dayLines(todaySummary);
    return (
      <div className="min-h-screen pb-28 lg:pb-8 lg:pl-64 px-5 pt-8" data-testid="home-noperiods">
        <div className="text-center mb-8">
          <p className="text-[#B4B0C8] text-xs tracking-widest uppercase mb-2">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
          <h1 className="text-3xl text-white mb-3 font-script">
            {firstName ? `${dayGreeting}, ${firstName}` : `Hello, ${data?.user_name || 'Beautiful'}`}
          </h1>
        </div>

        {showWelcome && (
          <div className="rounded-2xl p-5 mb-10 border border-[#FF4F9A]/40 text-center" style={{ background: 'rgba(255,79,154,0.08)' }} data-testid="welcome-banner">
            <p className="text-xl font-script mb-1 text-white">Welcome to your HORMOscope.</p>
            <p className="text-[#E6E0EE] text-sm">Your days, in your own words. Log how you feel and watch your story build.</p>
            <button onClick={() => setShowWelcome(false)} className="mt-4 px-6 py-2 rounded-full text-sm text-white" style={{ background: '#FF4F9A' }}>
              Begin
            </button>
          </div>
        )}

        {paymentBanner && (
          <div className={`card p-4 mb-6 border ${paymentBanner === 'success' ? 'border-[#C9B8F0]/40 bg-[#C9B8F0]/10' : paymentBanner === 'failed' ? 'border-[#ff6b6b]/30 bg-[#ff6b6b]/5' : 'border-white/20 bg-white/5'}`} data-testid={`payment-banner-${paymentBanner}`}>
            <p className="text-sm text-white">
              {paymentBanner === 'pending' && 'Confirming your payment…'}
              {paymentBanner === 'success' && 'Your subscription is active. Welcome in.'}
              {paymentBanner === 'failed' && 'We couldn\'t confirm your payment yet. If you completed checkout, refresh in a minute and your access will activate automatically.'}
            </p>
          </div>
        )}

        {/* Today, from her own logs */}
        <div className="card p-5 mb-4" data-testid="noperiods-today">
          <p className="text-[#B4B0C8] text-[10px] tracking-widest uppercase mb-3">Today</p>
          {todayLines.length > 0 ? (
            <div className="space-y-2">
              {todayLines.map((line, i) => (
                <p key={`np-today-${i}`} className="text-[#E6E0EE] text-sm leading-relaxed">{line}</p>
              ))}
            </div>
          ) : (
            <p className="text-[#b8b8d1] text-sm leading-relaxed">
              Nothing logged yet today. Use the quick log below whenever something is worth remembering, and it will be right here.
            </p>
          )}
        </div>

        {/* Quick log: the same five buttons, saving to today */}
        <FloatingCarousel token={token} onLogged={fetchData} />

        {/* A gentle daily thought, never phase-bound */}
        <div className="card p-5 mb-4 mt-4" data-testid="noperiods-wisdom">
          <p className="text-[#B4B0C8] text-[10px] tracking-widest uppercase mb-3">For today</p>
          <p className="text-white text-base italic leading-relaxed">&ldquo;{wisdom}&rdquo;</p>
        </div>

        {/* v50: one gentle invitation to set reminders (dismissible,
            never nags) for anyone who has not set them yet. */}
        <RemindersCard user={user} token={token} updateUser={updateUser} />

        {/* Her recent days, from what she logged */}
        {recentDays.length > 0 && (
          <div className="card p-5" data-testid="noperiods-recent">
            <p className="text-[#B4B0C8] text-[10px] tracking-widest uppercase mb-3">Your recent days</p>
            <div className="space-y-4">
              {recentDays.map((d) => (
                <div key={d.iso}>
                  <p className="text-[#ff8fab] text-xs mb-1" style={{ fontFamily: 'Poppins, sans-serif' }}>{d.label}</p>
                  {dayLines(d.summary).map((line, i) => (
                    <p key={`np-${d.iso}-${i}`} className="text-[#b8b8d1] text-sm leading-relaxed">{line}</p>
                  ))}
                </div>
              ))}
            </div>
            <p className="text-[#B4B0C8] text-xs mt-3 pt-3 border-t border-white/10">
              Every day you log lives on the Calendar. Tap any day to see it.
            </p>
          </div>
        )}

        {/* v50: our logo rests at the very bottom of Home. */}
        <TabFooter />
      </div>
    );
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

      {/* Cycle Day Peach (v56; Oct 31, 2026 corrections at her
          word after her v56 phone check): the circle that sat
          behind the peach is GONE completely (no aura disc, no
          glow shadow) and the peach ITSELF wears the current
          phase color as a tint clipped to the peach shape (luteal
          = purple; see the tint field on the phase config). The
          day number is much smaller than v56 and sits low inside
          the peach, clear of the sunglasses and face. No current
          phase: no number and no tint, as before. */}
      <div className="flex flex-col items-center mb-8">
        <span className="text-[#E6E0EE] text-xs tracking-widest uppercase font-semibold mb-3">
          {phase === 'unknown' ? 'CYCLE DAY' : 'YOU ARE ON DAY'}
        </span>
        <div className="hs-orb-pulse rounded-full">
        <div className="day-peach" data-testid="day-circle">
          <img src="/images/peach-mini.png" alt="" className="day-peach-img" />
          {phase !== 'unknown' && (
            <span
              className="day-peach-tint"
              data-testid="day-peach-tint"
              style={{
                backgroundColor: config.tint,
                WebkitMaskImage: 'url(/images/peach-mini.png)',
                maskImage: 'url(/images/peach-mini.png)',
              }}
            />
          )}
          {phase !== 'unknown' && (
            <span className="day-peach-day" style={{ fontSize: 28 }}>{cycle.cycle_day || '?'}</span>
          )}
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
                ? `${cycle.days_until_period} days until next period${isEstimateState ? ' (estimate)' : ''}`
                : ''}
        </p>
      </div>

      {/* v56: the estimate explanation, in the fix file's own
          words. It shows only while her cycle length is still an
          estimate, and leaves on its own once learning lands. */}
      {phase !== 'unknown' && isEstimateState && cycle.next_period_date && (
        <div className="card p-4 mb-6" data-testid="home-estimate-note">
          <p className="text-[#E6E0EE] text-sm leading-relaxed" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Estimated next period: {new Date(`${cycle.next_period_date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}. This is an estimate based on a 28 day cycle because we do not know your exact cycle length yet. Log in the Calendar tab when your period starts and when it finishes. Once you log your period and how long it lasts, HORMOscope will start learning your own cycle. We will know your cycle length for sure after you log your next period start.
          </p>
        </div>
      )}

      {/* One line for today */}
      {mood.mood && phase !== 'unknown' && (
        <p className="text-center text-white text-base mb-6 px-2" data-testid="today-one-line">
          <span style={{ color: config.color }}>Today: {mood.mood}.</span>{' '}
          <span className="text-[#E6E0EE]">{(mood.emotional_state || '').split('. ')[0].replace(/\.$/, '')}.</span>
        </p>
      )}

      {/* v50: one gentle invitation to set reminders (dismissible,
          never nags) for anyone who has not set them yet. */}
      <RemindersCard user={user} token={token} updateUser={updateUser} />

      {/* Quick log: static row of five buttons */}
      <FloatingCarousel token={token} />

      {/* Card to the full Daily Read */}
      <div className="mb-4">
        <DailyRead />
      </div>

      {/* Partner Daily Note preview: the exact line her partner sees
          today. The server only sends it while she shares her phase,
          so nothing renders here while sharing is off. */}
      {data?.partner_daily_note && (
        <div className="card p-5 mb-4" data-testid="partner-note-preview">
          <p className="text-[#B4B0C8] text-[10px] tracking-widest uppercase mb-1">For your partner</p>
          <h3 className="text-lg mb-2" style={{ fontFamily: "'Poiret One', sans-serif", color: '#f4a7b9' }}>What your partner sees today</h3>
          <p className="text-white text-sm leading-relaxed mb-2">{data.partner_daily_note.text}</p>
          <p className="text-[#E6E0EE] text-sm leading-relaxed">{data.partner_daily_note.prompt}</p>
        </div>
      )}

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
            const pair = PHASE_PAIRS[row.id];
            const c = pair.primary;
            const now = phase === row.id;
            return (
              <button key={row.id} type="button" onClick={() => setOpenPhaseCard(row.id)} className="w-full text-left flex items-center gap-3 p-3 rounded-xl" style={now ? { background: `${c}22`, border: `1px solid ${c}88` } : { background: 'rgba(255,255,255,0.05)' }} data-testid={`phase-row-${row.id}`}>
                <div className="w-3 h-3 rounded-full" style={{ background: `linear-gradient(135deg, ${pair.primary}, ${pair.secondary})` }} />
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

      {/* v50: our logo rests at the very bottom of Home. */}
      <TabFooter />
    </div>
  );
}
