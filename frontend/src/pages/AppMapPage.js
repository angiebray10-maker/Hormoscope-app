import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

// App map: every section in one organised list.
export const APP_MAP = [
  { group: 'Main tabs', items: [
    { to: '/', name: 'Home', desc: 'Your cycle day, phase, quick log and today\u2019s daily read.' },
    { to: '/journal', name: 'Journal', desc: 'Your private daily journal: one day per page, saved to your day and never shared.' },
    { to: '/attunement', name: 'Attunement', desc: 'Attuned Partner Mode: invite your partner or sync cycles with your girlfriend.' },
    { to: '/calendar', name: 'Calendar', desc: 'Periods, fertile window, symptoms and intimacy, past and future.' },
    { to: '/profile', name: 'Profile', desc: 'Your details, what your partner can see, settings and account.' },
  ]},
  { group: 'Partner', items: [
    { to: '/partner-hub', name: 'Partner Hub', desc: 'Where a partner enters an invite code, follows your cycle, and you each log how you feel today.' },
  ]},
  { group: 'Help & about', items: [
    { to: '/guide', name: 'Instructional Guide', desc: 'How each part of the app works.' },
    { to: '/founders-note', name: 'Founder\u2019s Note', desc: 'Why HORMOscope was made.' },
    { to: '/contact', name: 'Contact Us', desc: 'Get in touch with the HORMOscope team.' },
  ]},
  { group: 'Legal', items: [
    { to: '/privacy', name: 'Privacy Policy', desc: 'What we collect, how it is used and your choices.' },
    { to: '/terms', name: 'Terms of Service', desc: 'The rules for using HORMOscope.' },
  ]},
];

export default function AppMapPage() {
  return (
    <div className="min-h-screen px-5 pt-8 pb-28" style={{ background: '#0B0B1E', fontFamily: 'Poppins, sans-serif' }} data-testid="app-map">
      <Link to="/profile" className="inline-flex items-center gap-1 text-[#E6E0EE] mb-4"><ChevronLeft className="w-5 h-5" /> Back</Link>
      <h1 className="text-3xl text-white mb-6" style={{ fontFamily: "'Poiret One', sans-serif" }}>App map</h1>
      {APP_MAP.map((g) => (
        <section key={g.group} className="mb-6">
          <h2 className="text-xs tracking-widest uppercase text-[#C9B8F0] mb-2">{g.group}</h2>
          <div className="rounded-2xl border border-white/10 divide-y divide-white/10" style={{ background: '#15152B' }}>
            {g.items.map((it) => (
              <Link key={it.to} to={it.to} className="block px-4 py-3">
                <p className="text-white text-[15px]">{it.name}</p>
                <p className="text-[#E6E0EE] text-xs mt-0.5">{it.desc}</p>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
