import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { cycleDayFromDashboard, phaseFromDashboard } from '../utils/cycleDay';
import { phasePair } from '../lib/phases';
import logger from '../utils/logger';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Tiny peaches (Angelita, Oct 28, 2026; cycle day version Oct 30,
// 2026, fix list item 26; v56 corrections Oct 30, 2026): a few tiny
// copies of the app peach (the sunglasses peach, the identical art,
// just smaller) sit here and there on the Home page and the
// Calendar tab ONLY (v56: removed from Journal, Devotional,
// Attunement, Profile, Auth, and Onboarding). They NEVER fall or
// drift: each one stays in place, spins slowly, and fades in and
// out on its own staggered cycle, scattered all over the screen,
// faded in the background behind the content.
//
// v56 FADED ALWAYS: at her word after the v55 phone check, every
// peach's peak opacity is capped at PEACH_CAP (0.3). Even at its
// brightest moment a peach stays background decoration, clearly
// below the content. The staggered fade in and out, the slow spin
// in place, the varied sizes, tap to freeze, and reduced motion
// behavior are all unchanged.
//
// v56 PHASE AURA: every peach shines with a bright soft aura in
// the CURRENT phase color pair (PHASE_PAIRS), made clearly visible
// as a glow around the peach while the peach itself stays faded.
// The peach art is never tinted; the color is aura only. No
// current phase (no periods path / placeholder): no aura and no
// number, as before.
//
// Oct 31, 2026 (her v56 phone verdict, supersedes the v56 levels):
// the twirly peaches were still too bright and looked messy. The
// peak cap drops from 0.3 to 0.12 (way more faded) and the aura
// shrinks to a slight soft glow only: smaller halo, much lower
// alphas. The Home day peach separately lost its back circle and
// now wears the phase color itself (see HomePage).
//
// v56 NUMBER SPINS WITH THE PEACH: the rotating element now
// CONTAINS both the peach image and its cycle day number, so the
// number turns along with the peach instead of sitting still
// under it. The number is the dashboard's current cycle day; when
// there is no current cycle day the peaches show NO number.
//
// Pure decoration: pointer-events none, transform and opacity only.
// Her motion rule from v50 still holds: a tap anywhere freezes the
// peaches, and they move again after about 4 quiet seconds or on
// scroll. The component keeps its FallingFlowers name.
const PEACH_SRC = '/images/peach-mini.png';

// Peak opacity cap for EVERY peach, rare one included. v56 set
// 0.3; Oct 31, 2026 she found that still too bright, so the cap
// is 0.12 now: way more faded, barely-there background dressing.
const PEACH_CAP = 0.12;

// All different sizes, noticeably varied: 16 to 52 px. Peaks all
// sit at or below PEACH_CAP.
const PEACHES = [
  { top: '11%', left: '7%', size: 30, peak: 0.12, spin: 19, spinDelay: -4, fade: 9, fadeDelay: -2, reverse: false },
  { top: '27%', left: '86%', size: 16, peak: 0.10, spin: 23, spinDelay: -11, fade: 11, fadeDelay: -6, reverse: true },
  { top: '55%', left: '13%', size: 44, peak: 0.11, spin: 21, spinDelay: -7, fade: 10, fadeDelay: -4, reverse: false },
  { top: '72%', left: '80%', size: 22, peak: 0.08, spin: 17, spinDelay: -13, fade: 8, fadeDelay: -1, reverse: true },
  { top: '88%', left: '38%', size: 52, peak: 0.12, spin: 25, spinDelay: -2, fade: 12, fadeDelay: -8, reverse: false },
  { top: '38%', left: '30%', size: 18, peak: 0.10, spin: 27, spinDelay: -9, fade: 13, fadeDelay: -5, reverse: false },
];

// The special one: bigger, with a soft glow, on a long 52 second
// cycle where it is only visible for a short slice in the middle.
// v56: its peak is capped at PEACH_CAP like every other peach.
const RARE_PEACH = { top: '40%', left: '60%', size: 64, spin: 10, spinDelay: -3, cycle: 52, cycleDelay: -18 };

// The day number rides INSIDE the spinning element (v56), low and
// centered on the peach, so it spins along with the peach. It takes
// the current phase pair's primary color, with a strong dark shadow
// so it stays readable over the peach art.
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

// The phase glow behind each twirly peach. v56 made it brighter
// and wider so it read as shining; Oct 31, 2026 she asked for the
// opposite: only a SLIGHT soft glow. The halo is smaller (inset
// -30% instead of -60%) and its alphas are cut by more than half.
// The peach art itself is never tinted, recolored, or restyled;
// the color goes around it. No phase, no glow.
function PeachHalo({ pair }) {
  if (!pair) return null;
  return (
    <span
      aria-hidden="true"
      data-testid="peach-phase-halo"
      style={{
        position: 'absolute',
        inset: '-30%',
        borderRadius: '50%',
        background: `radial-gradient(circle, ${pair.primary}38 0%, ${pair.primary}24 40%, ${pair.secondary}17 62%, ${pair.secondary}00 80%)`,
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

  // Read the current cycle day from the dashboard, and keep it
  // current (re-read on mount, on window focus, and every 10
  // minutes). The no periods path never gets a number: her stored
  // flags settle that before the dashboard is even asked.
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
          {/* v56: the spinning element contains the peach AND its
              number, so the number spins with the peach. */}
          <span
            className={reducedMotion ? undefined : 'peach-spin'}
            style={{
              display: 'block',
              position: 'relative',
              width: '100%',
              height: '100%',
              animationDuration: `${p.spin}s`,
              animationDelay: `${p.spinDelay}s`,
              animationDirection: p.reverse ? 'reverse' : undefined,
            }}
          >
            <img
              src={PEACH_SRC}
              alt=""
              style={{
                width: '100%',
                height: 'auto',
                display: 'block',
                position: 'relative',
              }}
            />
            <PeachDayNumber day={cycleDay} size={p.size} color={pair ? pair.primary : undefined} />
          </span>
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
          opacity: reducedMotion ? PEACH_CAP : 0,
          animationDuration: `${RARE_PEACH.cycle}s`,
          animationDelay: `${RARE_PEACH.cycleDelay}s`,
        }}
      >
        <PeachHalo pair={pair} />
        <span
          className={reducedMotion ? undefined : 'peach-spin'}
          style={{
            display: 'block',
            position: 'relative',
            width: '100%',
            height: '100%',
            animationDuration: `${RARE_PEACH.spin}s`,
            animationDelay: `${RARE_PEACH.spinDelay}s`,
          }}
        >
          <img
            src={PEACH_SRC}
            alt=""
            style={{
              width: '100%',
              height: 'auto',
              display: 'block',
              position: 'relative',
              // The rare peach's glow wears the phase pair too,
              // softened Oct 31, 2026 to a slight glow like the
              // others; the fixed pink below is only the no-phase
              // fallback, softened the same way.
              filter: pair
                ? `drop-shadow(0 0 5px ${pair.primary}66) drop-shadow(0 0 10px ${pair.secondary}33)`
                : 'drop-shadow(0 0 5px rgba(255,93,162,0.4)) drop-shadow(0 0 10px rgba(255,20,147,0.2))',
            }}
          />
          <PeachDayNumber day={cycleDay} size={RARE_PEACH.size} color={pair ? pair.primary : undefined} />
        </span>
      </div>
    </div>
  );
}
