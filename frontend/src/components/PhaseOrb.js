import React from 'react';
import { useAuth } from '../context/AuthContext';
import { phaseFromUser } from '../lib/phases';

// Faded blue cobalt wallpaper (Angelita, Nov 1, 2026): the orbs are
// OUT. In their place, her blue blueprint cycle diagrams sit FADED
// behind the whole app as a fixed background wallpaper, low opacity,
// with a dark wash over them so the app's navy background stays
// dominant and every word stays readable. Purely decorative:
// pointer-events none, aria-hidden, sits behind content (z-index 0;
// the app content wrapper is z-index 1).
// Where her current cycle phase is known, the wallpaper is that
// phase's own blue diagram (the same blue cobalt set now used for
// the Home phase diagrams). Before sign-in, or when no phase is
// known, it is her phase-neutral Uterus & Ovaries blueprint
// (FIG. 01). The Home day peach itself is untouched.
const PHASE_WALLPAPERS = {
  menstrual: '/images/phase-menstrual.png',
  follicular: '/images/phase-follicular.png',
  ovulatory: '/images/phase-ovulatory.png',
  luteal: '/images/phase-luteal.png',
  late: '/images/phase-menstrual.png',
};
const NEUTRAL_WALLPAPER = '/images/blueprint-wallpaper.png';

export default function FadedBackdrop() {
  const { user } = useAuth();
  const phase = user?.onboarding_complete ? phaseFromUser(user) : 'unknown';
  const src = PHASE_WALLPAPERS[phase] || NEUTRAL_WALLPAPER;
  return (
    <div aria-hidden="true" className="hs-faded-wallpaper" data-testid="faded-wallpaper"
      style={{ backgroundImage: `linear-gradient(rgba(11,11,30,0.30), rgba(11,11,30,0.50)), url(${src})` }} />
  );
}
