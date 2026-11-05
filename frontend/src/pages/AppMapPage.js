import React from 'react';
import { Link } from 'react-router-dom';
import BackButton from '../components/BackButton';

// App map: every section in one organised list.
export const APP_MAP = [
  { group: 'Main tabs', items: [
    { to: '/', name: 'Home', desc: 'The top of your Home tab, read-only: the big day peach says You are on day N, glowing in your phase color, with your estimated next period, your Daily Read, the daily recipe and vitamins, and your daily affirmation.' },
    { to: '/', name: 'Journal', desc: 'In the middle of your Home tab: where you log your day, with the calendar at the top in phase colours and period, intimacy, fertile and ovulation markers, all your daily questions and your note for any day, past days by month and year, and the history chart.' },
    { to: '/', name: 'Share your cycle', desc: 'At the bottom of your Home tab: invite someone close to follow your cycle. With her, a link that starts her own account and links you both. With him, a link straight to your cycle. You choose what to share, including the Share my daily log and Include my note toggles. Your journal and intimacy log are never shared.' },
    { to: '/profile', name: 'Profile', desc: 'Your second tab: your name, the conditions you live with, your reminder settings, the legal and privacy pages, and your account: sign out, or delete your account and data.' },
  ]},
  { group: 'Partner', items: [
    { to: '/partner-hub', name: 'Partner Hub', desc: 'Where a partner enters an invite code and follows your cycle.' },
  ]},
  { group: 'Help & about', items: [
    { to: '/guide', name: 'Instructional Guide', desc: 'How each part of the app works.' },
    { to: '/founders-note', name: 'Founder\u2019s Note', desc: 'Why HORMOscope was made.' },
    { to: '/contact', name: 'Contact Us', desc: 'Get in touch with the HORMOscope team.' },
    { to: '/suggestions', name: 'Suggestion Box', desc: 'Tell Angelita what you would like to see in HORMOscope, or what feature you would like built next.' },
  ]},
  { group: 'Legal', items: [
    { to: '/privacy', name: 'Privacy Policy', desc: 'What we collect, how it is used and your choices.' },
    { to: '/terms', name: 'Terms of Service', desc: 'The rules for using HORMOscope.' },
  ]},
];

export default function AppMapPage() {
  return (
    <div className="min-h-screen px-5 pt-8 pb-28" style={{ background: '#0B0B1E', fontFamily: 'Poppins, sans-serif' }} data-testid="app-map">
      <BackButton fallback="/profile" className="mb-4" />
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
