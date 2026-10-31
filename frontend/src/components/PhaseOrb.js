import React from 'react';
import { useAuth } from '../context/AuthContext';
import { phaseTint, phaseOther, phaseFromUser } from '../lib/phases';

// Signature HORMOscope orb: a calm, slow "breathing" glow in the colours of
// her current phase. Purely decorative: pointer-events none, aria-hidden,
// sits behind content. Stops for prefers-reduced-motion or when she turns
// the orb off in Profile (html.hs-orb-off).
// v55: the glow carries the phase PAIR, the same pair system as
// everywhere else (lib/phases.js PHASE_PAIRS). Color fix (Oct 31,
// 2026): the heart is the phase TINT, the color the legend names;
// the pair partner (pink for three phases) only fades at the edge.
export default function AmbientOrb() {
  const { user } = useAuth();
  if (!user?.onboarding_complete) return null;
  const phase = phaseFromUser(user);
  const tint = phaseTint(phase);
  const other = phaseOther(phase);
  return (
    <div aria-hidden="true" className="hs-ambient-orb hs-orb-pulse" data-testid="ambient-orb"
      style={{ background: `radial-gradient(circle at 50% 50%, ${tint}55 0%, ${other}26 45%, ${other}00 72%)` }} />
  );
}
