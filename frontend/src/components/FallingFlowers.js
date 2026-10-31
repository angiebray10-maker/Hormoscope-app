import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { phaseFromDashboard } from '../utils/cycleDay';
import { phasePair } from '../lib/phases';
import logger from '../utils/logger';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Phase breathing light (v57, Angelita, Oct 31, 2026): the spinning,
// fading in and out decorative PEACHES ARE GONE, her decision after
// asking for an honest opinion. In their place, on Home and the
// Calendar tab only (the routes in App.js are unchanged), a soft
// light in the CURRENT phase pair colors (PHASE_PAIRS) breathes
// slowly behind the content: two wide, blurred pools of light,
// primary and secondary, fading in and out on a calm 9 second
// breath. No peach shapes, no spinning, no numbers, nothing to
// freeze on tap. No known phase (no periods path, or the dashboard
// has not answered): the unknown pair, dimmer, so the light is
// still calm and never wrong colored. Reduced motion: the light
// rests at one soft opacity, no animation (CSS handles that).
// The component keeps its FallingFlowers name; only what it
// renders changed.
export default function FallingFlowers() {
  const { token, user } = useAuth();
  const [phase, setPhase] = useState(null);

  // Read the current phase from the dashboard, and keep it current
  // (re-read on mount, on window focus, and every 10 minutes).
  useEffect(() => {
    if (!token) { setPhase(null); return undefined; }
    if (user?.no_periods || user?.cycle_status === 'no_periods') { setPhase(null); return undefined; }
    let live = true;
    const fetchPhase = async () => {
      try {
        const res = await axios.get(`${API}/dashboard`, { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 });
        if (live) setPhase(phaseFromDashboard(res.data));
      } catch (err) {
        logger.error('Phase light fetch failed:', err);
        if (live) setPhase(null);
      }
    };
    fetchPhase();
    const onFocus = () => fetchPhase();
    window.addEventListener('focus', onFocus);
    const timer = setInterval(fetchPhase, 10 * 60 * 1000);
    return () => { live = false; window.removeEventListener('focus', onFocus); clearInterval(timer); };
  }, [token, user?.no_periods, user?.cycle_status]);

  const pair = phasePair(phase || 'unknown');

  return (
    <div
      className="fixed inset-0 overflow-hidden pointer-events-none"
      style={{ zIndex: 3 }}
      aria-hidden="true"
      data-testid="falling-flowers"
    >
      <div
        className="phase-breath-light"
        data-testid="phase-breath-light"
        style={{
          top: '6%',
          left: '-12%',
          width: '62vw',
          height: '62vw',
          maxWidth: 430,
          maxHeight: 430,
          background: `radial-gradient(circle, ${pair.primary} 0%, transparent 65%)`,
        }}
      />
      <div
        className="phase-breath-light"
        data-testid="phase-breath-light-2"
        style={{
          bottom: '4%',
          right: '-14%',
          width: '68vw',
          height: '68vw',
          maxWidth: 470,
          maxHeight: 470,
          background: `radial-gradient(circle, ${pair.secondary} 0%, transparent 65%)`,
          animationDelay: '-4.5s',
        }}
      />
    </div>
  );
}
