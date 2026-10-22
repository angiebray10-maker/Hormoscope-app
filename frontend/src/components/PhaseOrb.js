import React from 'react';
import { useAuth } from '../context/AuthContext';
import { phaseColor, phaseFromUser } from '../lib/phases';

// Signature HORMOscope orb: a calm, slow "breathing" glow in the colour of
// her current phase. Purely decorative: pointer-events none, aria-hidden,
// sits behind content. Stops for prefers-reduced-motion or when she turns
// the orb off in Profile (html.hs-orb-off).
export default function AmbientOrb() {
  const { user } = useAuth();
  if (!user?.onboarding_complete) return null;
  const c = phaseColor(phaseFromUser(user));
  return (
    <div aria-hidden="true" className="hs-ambient-orb hs-orb-pulse" data-testid="ambient-orb"
      style={{ background: `radial-gradient(circle at 50% 50%, ${c}55 0%, ${c}22 40%, ${c}00 70%)` }} />
  );
}
