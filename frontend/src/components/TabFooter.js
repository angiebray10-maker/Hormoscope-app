import React from 'react';

// Tab footer (Angelita, Oct 26, 2026, v50; size and trademark line
// set by Angelita, Oct 31, 2026): at the very bottom of the scroll on
// Home, Calendar, and Profile only, our peach logo rests FADED in the
// backdrop, professional like a trademark footer, big enough to read
// clearly, the exact same on each tab, with the trademark line under
// it. NOT on Journal (the Journal has its own life stages backdrop)
// and NOT on Attunement.
export default function TabFooter() {
  return (
    <div className="flex flex-col items-center py-10" data-testid="tab-footer">
      <img
        src="/images/logo.png"
        alt=""
        aria-hidden="true"
        style={{ width: 260, height: 'auto', opacity: 0.55 }}
      />
      <p className="mt-3 text-[11px] tracking-wide" style={{ color: '#8E89A3', fontFamily: 'Poppins, sans-serif' }}>
        HORMOscope&trade; &copy; 2026. All rights reserved.
      </p>
    </div>
  );
}
