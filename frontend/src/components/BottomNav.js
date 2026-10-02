import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, MessageCircle, Calendar, User, BookOpen, Crown } from 'lucide-react';

const navItems = [
  { path: '/', icon: Home, label: 'Home' },
  { path: '/journal', icon: BookOpen, label: 'Journal' },
  { path: '/pro', icon: Crown, label: 'Pro' },
  { path: '/calendar', icon: Calendar, label: 'Calendar' },
  { path: '/profile', icon: User, label: 'Profile' },
];

export default function BottomNav() {
  const location = useLocation();
  const hiddenPaths = ['/auth', '/onboarding', '/privacy', '/terms'];
  
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

      {/* Mobile Bottom Nav */}
      <nav className="lg:hidden fixed bottom-12 left-4 right-4 z-[9999]">
        <div className="backdrop-blur-xl rounded-full px-2 py-1 flex justify-around max-w-sm mx-auto" style={{ background: 'rgba(26,26,46,0.9)', border: '1.5px solid #FF1493' }}>
          {navItems.map(({ path, icon: Icon }) => {
            const isActive = location.pathname === path;
            const isPro = path === '/pro';
            return (
              <NavLink
                key={path}
                to={path}
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                  isActive 
                    ? 'bg-[#FF1493] text-white' 
                    : isPro ? 'text-[#D4A853]' : 'text-[#6c6c8a]'
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
