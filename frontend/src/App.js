import React, { useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { AuthProvider, useAuth } from './context/AuthContext';
import { PremiumProvider } from './context/PremiumContext';
import { BottomNav } from './components/BottomNav';
import { Toaster } from './components/ui/sonner';
import InstallPrompt from './components/InstallPrompt';
import FadedBackdrop from './components/PhaseOrb';
import FallingFlowers from './components/FallingFlowers';

// Pages
import AuthPage from './pages/AuthPage';
import OnboardingPage from './pages/OnboardingPage';
import MainTabPage from './pages/MainTabPage';
import ProfilePage from './pages/ProfilePage';
import PrivacyPage from './pages/PrivacyPage';
import TermsPage from './pages/TermsPage';
import FoundersNotePage from './pages/FoundersNotePage';
import GuidePage from './pages/GuidePage';
import ContactPage from './pages/ContactPage';
import PartnerViewPage from './pages/PartnerViewPage';
import PartnerHubPage from './pages/PartnerHubPage';
import NotFoundPage from './pages/NotFoundPage';
import AppMapPage from './pages/AppMapPage';

import './index.css';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-16 h-16 rounded-full border-4 border-[#6B5B95] border-t-[#ff8fab] animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Compare the ROUTER path, not window.location.pathname: under a
  // basename (the web preview lives at /Hormoscope-app/preview) the
  // window path carries the prefix, never equals '/onboarding', and
  // this guard redirected to onboarding forever (blank screen).
  if (!user.onboarding_complete && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  return children;
};

// The main tab pages get the falling flowers layer (v50). The
// Devotional the owner speaks of lives inside these tabs in this
// build (there is no separate devotional route); the layer mounts
// once here in the shell and only on tab routes.
// v56: the fading peaches live on Home and Calendar ONLY (her word,
// Oct 30, 2026). They were removed from Journal, Attunement,
// Profile, and everywhere else.
// v59: the Calendar tab is gone; the calendar now lives inside the
// Journal tab, so the fading peaches live on Home and Journal.
const FLOWER_TAB_ROUTES = ['/'];

// App Content with routing
const AppContent = () => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // v54 (Angelita, Oct 29, 2026): "when I push the back button it
  // goes back to my email." There was NO Android back handler at
  // all, so the system default finished the app whenever the
  // WebView history ran out, and because she had arrived from her
  // mail app the phone landed her back in her email mid-flow. The
  // standard Capacitor fix: own the backButton event. Inside the
  // app, back walks back through her screens; from a main tab it
  // takes her Home; only on Home (or the sign-in page) does back
  // minimize the app like any other Android app. No-op on web.
  const pathnameRef = useRef(location.pathname);
  pathnameRef.current = location.pathname;
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;
    let handle = null;
    let removed = false;
    CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      const path = pathnameRef.current;
      const ROOT_ROUTES = ['/', '/journal', '/attunement', '/profile', '/auth'];
      if (!ROOT_ROUTES.includes(path)) {
        if (canGoBack) navigate(-1);
        else navigate('/');
      } else if (path !== '/' && path !== '/auth') {
        navigate('/');
      } else {
        CapacitorApp.minimizeApp();
      }
    }).then((h) => { if (removed) h.remove(); else handle = h; }).catch(() => {});
    return () => { removed = true; if (handle) handle.remove(); };
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-16 h-16 rounded-full border-4 border-[#6B5B95] border-t-[#ff8fab] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen noise-overlay">
      <FadedBackdrop />
      {FLOWER_TAB_ROUTES.includes(location.pathname) && <FallingFlowers />}
      <div className="pb-24 lg:pb-0 relative z-[1]">
      <Routes>
        {/* Public routes */}
        <Route path="/auth" element={user ? <Navigate to="/" replace /> : <AuthPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/founders-note" element={<FoundersNotePage />} />
        <Route path="/guide" element={<GuidePage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/app-map" element={<AppMapPage />} />
        <Route path="/partner/:linkCode" element={<PartnerViewPage />} />

        {/* Protected routes */}
        <Route path="/onboarding" element={
          <ProtectedRoute>
            <OnboardingPage />
          </ProtectedRoute>
        } />
        <Route path="/" element={
          <ProtectedRoute>
            <MainTabPage />
          </ProtectedRoute>
        } />
        {/* v64 (Angelita, Nov 4, 2026): TWO tabs only. Home, Journal
            and Attunement live stacked on the one main tab; Profile
            is the second tab. Old deep links land on the main tab. */}
        <Route path="/calendar" element={<Navigate to="/" replace />} />
        <Route path="/journal" element={<Navigate to="/" replace />} />
        <Route path="/profile" element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        } />
        <Route path="/partner-hub" element={
          <ProtectedRoute>
            <PartnerHubPage />
          </ProtectedRoute>
        } />
        <Route path="/attunement" element={<Navigate to="/" replace />} />
        {/* Fallback - 404 Page */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      </div>
      <BottomNav />
      <InstallPrompt />
      <Toaster />
    </div>
  );
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <PremiumProvider>
          <AppContent />
        </PremiumProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
