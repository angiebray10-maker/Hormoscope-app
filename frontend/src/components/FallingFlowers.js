import React, { useState, useEffect } from 'react';

// Tiny peaches (Angelita, Oct 28, 2026): the flowers are gone. In
// their place, a few tiny copies of the app peach (the sunglasses
// peach, the identical art, just smaller) sit here and there on the
// page, each one spinning slowly in place and fading in and out on
// its own staggered cycle, appearing and disappearing. Once in a
// while one slightly bigger peach shows up with a soft glow, stays
// a few seconds, then is gone for a long stretch.
// Pure decoration: pointer-events none, transform and opacity only,
// so the phone's graphics chip handles them for almost free.
//
// Her motion rule from v50 still holds: a tap anywhere freezes the
// peaches, and they move again after about 4 quiet seconds or on
// scroll. The component keeps its FallingFlowers name and mount
// points so App.js and OnboardingPage.js do not change.
const PEACH_SRC = '/images/peach-mini.png';

const PEACHES = [
  { top: '11%', left: '7%', size: 26, peak: 0.7, spin: 19, spinDelay: -4, fade: 9, fadeDelay: -2, reverse: false },
  { top: '27%', left: '86%', size: 22, peak: 0.6, spin: 23, spinDelay: -11, fade: 11, fadeDelay: -6, reverse: true },
  { top: '55%', left: '13%', size: 30, peak: 0.55, spin: 21, spinDelay: -7, fade: 10, fadeDelay: -4, reverse: false },
  { top: '72%', left: '80%', size: 24, peak: 0.65, spin: 17, spinDelay: -13, fade: 8, fadeDelay: -1, reverse: true },
  { top: '88%', left: '38%', size: 22, peak: 0.6, spin: 25, spinDelay: -2, fade: 12, fadeDelay: -8, reverse: false },
];

// The special one: a bit bigger, full strength with a soft pink
// glow, on a long 52 second cycle where it is only visible for a
// short slice in the middle.
const RARE_PEACH = { top: '40%', left: '60%', size: 44, spin: 10, spinDelay: -3, cycle: 52, cycleDelay: -18 };

export default function FallingFlowers() {
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    if (mq) {
      setReducedMotion(mq.matches);
      const onChange = (e) => setReducedMotion(e.matches);
      if (mq.addEventListener) mq.addEventListener('change', onChange);
      return () => { if (mq.removeEventListener) mq.removeEventListener('change', onChange); };
    }
  }, []);

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

  return (
    <div
      className={`fixed inset-0 overflow-hidden pointer-events-none${paused ? ' peaches-paused' : ''}`}
      style={{ zIndex: 3 }}
      aria-hidden="true"
      data-testid="falling-flowers"
    >
      {PEACHES.map((p, i) => (
        <img
          key={i}
          src={PEACH_SRC}
          alt=""
          className={reducedMotion ? undefined : 'tiny-peach'}
          style={{
            position: 'absolute',
            top: p.top,
            left: p.left,
            width: p.size,
            height: 'auto',
            opacity: reducedMotion ? p.peak : 0,
            '--peak': p.peak,
            animationDuration: `${p.spin}s, ${p.fade}s`,
            animationDelay: `${p.spinDelay}s, ${p.fadeDelay}s`,
            animationDirection: p.reverse ? 'reverse, normal' : undefined,
          }}
        />
      ))}
      <img
        src={PEACH_SRC}
        alt=""
        className={reducedMotion ? undefined : 'rare-peach'}
        style={{
          position: 'absolute',
          top: RARE_PEACH.top,
          left: RARE_PEACH.left,
          width: RARE_PEACH.size,
          height: 'auto',
          filter: 'drop-shadow(0 0 6px rgba(255,93,162,0.95)) drop-shadow(0 0 16px rgba(255,20,147,0.5))',
          opacity: reducedMotion ? 0.8 : 0,
          animationDuration: `${RARE_PEACH.spin}s, ${RARE_PEACH.cycle}s`,
          animationDelay: `${RARE_PEACH.spinDelay}s, ${RARE_PEACH.cycleDelay}s`,
        }}
      />
    </div>
  );
}
