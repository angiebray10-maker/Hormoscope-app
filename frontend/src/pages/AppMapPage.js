import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

// App map: every section in one organised list.
export const APP_MAP = [
  { group: 'Main tabs', items: [
    { to: '/', name: 'Home', desc: 'Read-only: the big day peach says You are on day N, glowing in your phase color, with your estimated next period, your Daily Read, the daily recipe and vitamins, your daily affirmation, and the logo resting at the bottom.' },
    { to: '/journal', name: 'Journal', desc: 'Where you log your day: the calendar at the top with phase colours and period, intimacy, fertile and ovulation markers, all your daily questions and your note for any day, past days by month and year, and the history chart.' },
    { to: '/attunement', name: 'Attunement', desc: 'Attuned Partner Mode: invite your partner or sync cycles with your girlfriend, and choose what to share, including the Share my daily log and Include my note toggles. The Gift Catalog, your wishlist and your boutique live here too.' },
    { to: '/profile', name: 'Profile', desc: 'Your name and photo, the conditions you live with, your notification settings, and your account.' },
  ]},
  { group: 'Partner', items: [
    { to: '/partner-hub', name: 'Partner Hub', desc: 'Where a partner enters an invite code and follows your cycle.' },
    { to: '/attunement', name: 'Gift Catalog', desc: 'In Attunement: the catalog runs in sections, Flowers first and Jewelry and extra special things last, with like sitting with like inside each one. Heart items onto your wishlist and into your boutique, tap a product name to open it on Amazon, and comment or leave a suggestion on the Community wall at the bottom.' },
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
