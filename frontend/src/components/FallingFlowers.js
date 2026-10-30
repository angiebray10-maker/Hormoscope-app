import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { cycleDayFromDashboard, phaseFromDashboard } from '../utils/cycleDay';
import { phasePair } from '../lib/phases';
import logger from '../utils/logger';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Tiny peaches (Angelita, Oct 28, 2026; cycle day version Oct 30,
// 2026, fix list item 26): the flowers are gone. In their place, a
// few tiny copies of the app peach (the sunglasses peach, the
// identical art, just smaller) sit here and there on the page. They
// NEVER fall or drift: each one stays in place, spins slowly, and
// fades in and out on its own staggered cycle, appearing and
// disappearing at different times, scattered all over the screen,
// faded in the background behind the content. Their sizes are all
// different on purpose, noticeably varied, not near uniform. Once in
// a while one bigger peach shows up with a soft glow, stays a few
// seconds, then is gone for a long stretch.
//
// Item 26: every peach carries her CURRENT cycle day number, the
// same number the dashboard cycle_info reports (if she is on day
// 24, the peaches show 24). The number sits small on the peach, in
// the same faded treatment, and updates on its own when her day
// changes (the dashboard is re-read on mount, on window focus, and
// every 10 minutes). When there is no current cycle day (the no
// periods path, or no cycle data yet), the peaches show NO number
// rather than a wrong or placeholder one.
//
// Pure decoration: pointer-events none, transform and opacity only,
// so the phone's graphics chip handles them for almost free.
//
// Her motion rule from v50 still holds: a tap anywhere freezes the
// peaches, and they move again after about 4 quiet seconds or on
// scroll. The component keeps its FallingFlowers name and mount
// points so App.js and OnboardingPage.js do not change.
const PEACH_SRC = '/images/peach-mini.png';

// All different sizes, noticeably varied (item 26): 16 to 52 px.
const PEACHES = [
  { top: '11%', left: '7%', size: 30, peak: 0.7, spin: 19, spinDelay: -4, fade: 9, fadeDelay: -2, reverse: false },
  { top: '27%', left: '86%', size: 16, peak: 0.6, spin: 23, spinDelay: -11, fade: 11, fadeDelay: -6, reverse: true },
  { top: '55%', left: '13%', size: 44, peak: 0.5, spin: 21, spinDelay: -7, fade: 10, fadeDelay: -4, reverse: false },
  { top: '72%', left: '80%', size: 22, peak: 0.65, spin: 17, spinDelay: -13, fade: 8, fadeDelay: -1, reverse: true },
  { top: '88%', left: '38%', size: 52, peak: 0.45, spin: 25, spinDelay: -2, fade: 12, fadeDelay: -8, reverse: false },
  { top: '38%', left: '30%', size: 18, peak: 0.55, spin: 27, spinDelay: -9, fade: 13, fadeDelay: -5, reverse: false },
];

// The special one: bigger, full strength with a soft pink glow, on
// a long 52 second cycle where it is only visible for a short slice
// in the middle.
const RARE_PEACH = { top: '40%', left: '60%', size: 64, spin: 10, spinDelay: -3, cycle: 52, cycleDelay: -18 };

// The day number rides on the peach itself, low and centered, small
// and faded with it (the wrapper fades, so the number fades too).
// v55: the number takes the current phase pair's primary color, with
// a strong dark shadow so it stays readable over the peach art.
function PeachDayNumber({ day, size, color }) {
  if (day == null) return null;
  return (
    <span
      data-testid="peach-cycle-day"
      style={{
        position: 'absolute',
        left: '50%',
        bottom: '6%',
        transform: 'translateX(-50%)',
        fontFamily: 'Poppins, sans-serif',
        fontWeight: 600,
        fontSize: Math.max(9, Math.round(size * 0.34)),
        lineHeight: 1,
        color: color || '#FFFFFF',
        textShadow: '0 1px 3px rgba(0,0,0,0.85), 0 0 6px rgba(0,0,0,0.55)',
        pointerEvents: 'none',
      }}
    >
      {day}
    </span>
  );
}

// v55: the phase halo. A soft glow in the CURRENT phase's pair sits
// BEHIND each peach (primary at the heart, secondary at the edge).
// The peach art itself is never tinted, recolored, or restyled; the
// color goes around it. No phase, no halo.
function PeachHalo({ pair }) {
  if (!pair) return null;
  return (
    <span
      aria-hidden="true"
      data-testid="peach-phase-halo"
      style={{
        position: 'absolute',
        inset: '-35%',
        borderRadius: '50%',
        background: `radial-gradient(circle, ${pair.primary}59 0%, ${pair.secondary}30 55%, ${pair.secondary}00 72%)`,
        pointerEvents: 'none',
      }}
    />
  );
}

export default function FallingFlowers() {
  const { token, user } = useAuth();
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [cycleDay, setCycleDay] = useState(null);
  const [phase, setPhase] = useState(null);

  useEffect(() => {
    const mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    if (mq) {
      setReducedMotion(mq.matches);
      const onChange = (e) => setReducedMotion(e.matches);
      if (mq.addEventListener) mq.addEventListener('change', onChange);
      return () => { if (mq.removeEventListener) mq.removeEventListener('change', onChange); };
    }
  }, []);

  // Item 26: read the current cycle day from the dashboard, the way
  // the Journal MiniCalendar does, and keep it current. The no
  // periods path never gets a number: her stored flags settle that
  // before the dashboard is even asked.
  useEffect(() => {
    if (!token) { setCycleDay(null); setPhase(null); return undefined; }
    if (user?.no_periods || user?.cycle_status === 'no_periods') { setCycleDay(null); setPhase(null); return undefined; }
    let live = true;
    const fetchDay = async () => {
      try {
        const res = await axios.get(`${API}/dashboard`, { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 });
        if (live) {
          setCycleDay(cycleDayFromDashboard(res.data));
          setPhase(phaseFromDashboard(res.data));
        }
      } catch (err) {
        logger.error('Peach cycle day fetch failed:', err);
        if (live) { setCycleDay(null); setPhase(null); }
      }
    };
    fetchDay();
    const onFocus = () => fetchDay();
    window.addEventListener('focus', onFocus);
    const timer = setInterval(fetchDay, 10 * 60 * 1000);
    return () => { live = false; window.removeEventListener('focus', onFocus); clearInterval(timer); };
  }, [token, user?.no_periods, user?.cycle_status]);

  useEffect(() => {
    let idleTimer = null;
    const freeze = () => {
      setPaused(true);
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => setPaused(false), 4000);
    };
    const resume = () => {
      if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
      setPaused(false);
    };
    window.addEventListener('pointerdown', freeze);
    window.addEventListener('touchstart', freeze, { passive: true });
    window.addEventListener('scroll', resume, { passive: true });
    return () => {
      if (idleTimer) clearTimeout(idleTimer);
      window.removeEventListener('pointerdown', freeze);
      window.removeEventListener('touchstart', freeze);
      window.removeEventListener('scroll', resume);
    };
  }, []);

  const pair = phase ? phasePair(phase) : null;

  return (
    <div
      className={`fixed inset-0 overflow-hidden pointer-events-none${paused ? ' peaches-paused' : ''}`}
      style={{ zIndex: 3 }}
      aria-hidden="true"
      data-testid="falling-flowers"
    >
      {PEACHES.map((p, i) => (
        <div
          key={i}
          className={reducedMotion ? undefined : 'peach-fade'}
          style={{
            position: 'absolute',
            top: p.top,
            left: p.left,
            width: p.size,
            height: p.size,
            opacity: reducedMotion ? p.peak : 0,
            '--peak': p.peak,
            animationDuration: `${p.fade}s`,
            animationDelay: `${p.fadeDelay}s`,
          }}
        >
          <PeachHalo pair={pair} />
          <img
            src={PEACH_SRC}
            alt=""
            className={reducedMotion ? undefined : 'peach-spin'}
            style={{
              width: '100%',
              height: 'auto',
              display: 'block',
              position: 'relative',
              animationDuration: `${p.spin}s`,
              animationDelay: `${p.spinDelay}s`,
              animationDirection: p.reverse ? 'reverse' : undefined,
            }}
          />
          <PeachDayNumber day={cycleDay} size={p.size} color={pair ? pair.primary : undefined} />
        </div>
      ))}
      <div
        className={reducedMotion ? undefined : 'rare-peach'}
        style={{
          position: 'absolute',
          top: RARE_PEACH.top,
          left: RARE_PEACH.left,
          width: RARE_PEACH.size,
          height: RARE_PEACH.size,
          opacity: reducedMotion ? 0.8 : 0,
          animationDuration: `${RARE_PEACH.cycle}s`,
          animationDelay: `${RARE_PEACH.cycleDelay}s`,
        }}
      >
        <PeachHalo pair={pair} />
        <img
          src={PEACH_SRC}
          alt=""
          className={reducedMotion ? undefined : 'peach-spin'}
          style={{
            width: '100%',
            height: 'auto',
            display: 'block',
            position: 'relative',
            // v55: the rare peach's glow wears the phase pair too;
            // the fixed pink below is only the no-phase fallback.
            filter: pair
              ? `drop-shadow(0 0 6px ${pair.primary}) drop-shadow(0 0 16px ${pair.secondary}80)`
              : 'drop-shadow(0 0 6px rgba(255,93,162,0.95)) drop-shadow(0 0 16px rgba(255,20,147,0.5))',
            animationDuration: `${RARE_PEACH.spin}s`,
            animationDelay: `${RARE_PEACH.spinDelay}s`,
          }}
        />
        <PeachDayNumber day={cycleDay} size={RARE_PEACH.size} color={pair ? pair.primary : undefined} />
      </div>
    </div>
  );
}
