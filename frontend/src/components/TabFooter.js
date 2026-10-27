import React from 'react';

// Tab footer (Angelita, Oct 26, 2026, v50): at the very bottom of the
// scroll on Home, Calendar, and Profile only, our peach logo rests
// faded in the backdrop, big enough to read clearly, the exact same
// size on each tab. Logo only down there: no flowers, nothing else.
// NOT on Journal (the Journal has its own life stages backdrop) and
// NOT on Attunement.
export default function TabFooter() {
  return (
    <div className="flex justify-center py-10" data-testid="tab-footer" aria-hidden="true">
      <img
        src="/images/logo.png"
        alt=""
        style={{ width: 140, height: 'auto', opacity: 0.55 }}
      />
    </div>
  );
}
