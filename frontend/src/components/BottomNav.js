import React, { useEffect, useRef } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Home, MessageCircle, Calendar, User, BookOpen, BookHeart, Heart } from 'lucide-react';

const navItems = [
  { path: '/', icon: Home, label: 'Home' },
  { path: '/devotional', icon: BookHeart, label: 'Devotional' },
  { path: '/journal', icon: BookOpen, label: 'Journal' },
  { path: '/attunement', icon: Heart, label: 'Attunement' },
  { path: '/calendar', icon: Calendar, label: 'Calendar' },
  { path: '/profile', icon: User, label: 'Profile' },
];

const hiddenPaths = ['/auth', '/onboarding', '/privacy', '/terms'];

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const touchRef = useRef(null);

  // Swipe left / right moves between the main tabs (Angelita's fix list,
  // Oct 16). Deliberate swipes only: long, mostly horizontal, quick.
  // Ignored inside text fields and the quick-log dialog so logging and
  // typing never trigger a tab change.
  useEffect(() => {
    const onStart = (e) => {
      if (e.touches.length !== 1) { touchRef.current = null; return; }
      const t = e.touches[0];
      touchRef.current = { x: t.clientX, y: t.clientY, t: Date.now(), target: e.target };
    };
    const onEnd = (e) => {
      const start = touchRef.current;
      touchRef.current = null;
      if (!start) return;
      if (hiddenPaths.some((p) => location.pathname.startsWith(p))) return;
      if (start.target && start.target.closest && start.target.closest('input, textarea, select, [data-testid^="quicklog-"], [data-no-swipe]')) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      if (Math.abs(dx) < 80) return;
      if (Math.abs(dx) < Math.abs(dy) * 1.8) return;
      if (Date.now() - start.t > 600) return;
      const paths = navItems.map((i) => i.path);
      const idx = paths.indexOf(location.pathname);
      if (idx === -1) return;
      const next = dx < 0 ? idx + 1 : idx - 1;
      if (next < 0 || next >= paths.length) return;
      navigate(paths[next]);
    };
    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchend', onEnd);
    };
  }, [location.pathname, navigate]);

  if (hiddenPaths.some(p => location.pathname.startsWith(p))) {
    return null;
  }

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex sidebar fixed left-0 top-0 bottom-0 w-64 flex-col z-50 bg-[#1a1a2e] border-r border-white/5">
        <div className="p-6 border-b border-white/5 flex items-center gap-3">
          <img src="/images/logo.png" alt="HORMOscope" className="w-10 h-10 rounded-full object-cover" />
          <span className="text-2xl text-[#c9b8f0]" style={{ fontFamily: "'Poiret One', cursive", fontWeight: 400 }}>HORMOscope</span>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          {navItems.map(({ path, icon: Icon, label }) => {
            const isActive = location.pathname === path;
            return (
              <NavLink
                key={path}
                to={path}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  isActive
                    ? 'bg-[#ff8fab] text-[#1a1a2e]'
                    : 'text-[#6c6c8a] hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-sm font-medium">{label}</span>
              </NavLink>
            );
          })}
        </nav>
      </aside>

      {/* Mobile Bottom Nav: smaller, transparent, outline only
          (Angelita's fix list, Oct 16: no solid fill slicing into cards) */}
      <nav className="lg:hidden fixed bottom-3 left-4 right-4 z-40">
        <div className="rounded-full px-1.5 py-0.5 flex justify-around max-w-sm mx-auto" style={{ background: 'transparent', border: '1.5px solid #FF1493' }}>
          {navItems.map(({ path, icon: Icon, label }) => {
            const isActive = location.pathname === path;
            return (
              <NavLink
                key={path}
                to={path}
                aria-label={label}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                  isActive
                    ? 'bg-[#FF1493] text-white'
                    : 'text-[#6c6c8a]'
                }`}
              >
                <Icon className="w-4 h-4" />
              </NavLink>
            );
          })}
        </div>
      </nav>
    </>
  );
}

export { BottomNav };
