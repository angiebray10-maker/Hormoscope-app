import React from 'react';

// Tab footer (Angelita, Oct 26, 2026, v50; size and trademark line
// set by Angelita, Oct 31, 2026; logo widened 260 to 320 the same day
// at her word, still faded): at the very bottom of the scroll, our
// peach logo rests FADED in the backdrop, professional like a
// trademark footer, big enough to read clearly, with the rights line
// under it. v62 (Angelita, Nov 2, 2026): she saw it only on Home and
// ordered it at the very end of EVERY tab (Home, Journal, Attunement,
// Profile), the same size on every tab, with the logo and the rights
// line sitting close together: the gap between them is tight (mt-1).
export default function TabFooter() {
  return (
    <div className="flex flex-col items-center py-10" data-testid="tab-footer">
      <img
        src="/images/logo.png"
        alt=""
        aria-hidden="true"
        style={{ width: 320, height: 'auto', opacity: 0.55 }}
      />
      <p className="mt-1 text-[11px] tracking-wide" style={{ color: '#8E89A3', fontFamily: 'Poppins, sans-serif' }}>
        HORMOscope&trade; &copy; 2026. All rights reserved.
      </p>
    </div>
  );
}
