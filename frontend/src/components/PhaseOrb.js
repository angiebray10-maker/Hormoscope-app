import React from 'react';
import { useAuth } from '../context/AuthContext';
import { phasePair, phaseFromUser } from '../lib/phases';

// Signature HORMOscope orb: a calm, slow "breathing" glow in the colours of
// her current phase. Purely decorative: pointer-events none, aria-hidden,
// sits behind content. Stops for prefers-reduced-motion or when she turns
// the orb off in Profile (html.hs-orb-off).
// v55: the glow carries the phase PAIR (primary heart, secondary edge),
// the same pair system as everywhere else (lib/phases.js PHASE_PAIRS).
export default function AmbientOrb() {
  const { user } = useAuth();
  if (!user?.onboarding_complete) return null;
  const pair = phasePair(phaseFromUser(user));
  return (
    <div aria-hidden="true" className="hs-ambient-orb hs-orb-pulse" data-testid="ambient-orb"
      style={{ background: `radial-gradient(circle at 50% 50%, ${pair.primary}55 0%, ${pair.secondary}26 45%, ${pair.secondary}00 72%)` }} />
  );
}
