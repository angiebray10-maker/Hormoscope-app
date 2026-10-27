import React, { useState, useEffect } from 'react';

// Falling flowers (Angelita, Oct 26, 2026, v50): the same little ✿
// flowers that decorate the Journal page, sprinkled across every tab,
// a few only, soft and powdery, drifting down slowly like cherry
// blossoms in the wind. Pure decoration: pointer-events none, painted
// above the page backgrounds, and they never touch any data.
//
// Her motion rule: the flowers fall while she is browsing or sitting
// inactive on a tab, and they FREEZE the moment she taps or clicks
// anything. Scrolling counts as browsing (they keep falling); a tap
// pauses them, and they drift again after about 4 quiet seconds.
const FLOWERS = [
  { left: '6%', size: 18, color: '#f4a7b9', duration: 17, delay: -3, opacity: 0.5 },
  { left: '22%', size: 14, color: '#c9b8f0', duration: 21, delay: -11, opacity: 0.42 },
  { left: '41%', size: 22, color: '#f4a7b9', duration: 19, delay: -7, opacity: 0.38 },
  { left: '58%', size: 15, color: '#74b9ff', duration: 23, delay: -15, opacity: 0.4 },
  { left: '76%', size: 19, color: '#c9b8f0', duration: 18, delay: -5, opacity: 0.46 },
  { left: '90%', size: 14, color: '#f4a7b9', duration: 22, delay: -13, opacity: 0.42 },
];

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
      className={`fixed inset-0 overflow-hidden pointer-events-none${paused ? ' flowers-paused' : ''}`}
      style={{ zIndex: 3 }}
      aria-hidden="true"
      data-testid="falling-flowers"
    >
      {FLOWERS.map((f, i) => (
        <span
          key={i}
          className={reducedMotion ? undefined : 'falling-flower'}
          style={{
            position: 'absolute',
            top: reducedMotion ? `${8 + i * 14}%` : '-40px',
            left: f.left,
            fontSize: f.size,
            color: f.color,
            opacity: f.opacity,
            animationDuration: `${f.duration}s`,
            animationDelay: `${f.delay}s`,
          }}
        >
          ✿
        </span>
      ))}
    </div>
  );
}
