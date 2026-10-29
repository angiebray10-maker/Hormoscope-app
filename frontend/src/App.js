import React, { useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { AuthProvider, useAuth } from './context/AuthContext';
import { PremiumProvider } from './context/PremiumContext';
import { BottomNav } from './components/BottomNav';
import { Toaster } from './components/ui/sonner';
import { syncLocalNotifications } from './utils/localNotifications';
import InstallPrompt from './components/InstallPrompt';
import AmbientOrb from './components/PhaseOrb';
import FallingFlowers from './components/FallingFlowers';

// Pages
import AuthPage from './pages/AuthPage';
import OnboardingPage from './pages/OnboardingPage';
import HomePage from './pages/HomePage';
import CalendarPage from './pages/CalendarPage';
import JournalPage from './pages/JournalPage';
import ProfilePage from './pages/ProfilePage';
import PrivacyPage from './pages/PrivacyPage';
import TermsPage from './pages/TermsPage';
import FoundersNotePage from './pages/FoundersNotePage';
import GuidePage from './pages/GuidePage';
import ContactPage from './pages/ContactPage';
import PartnerViewPage from './pages/PartnerViewPage';
import PartnerHubPage from './pages/PartnerHubPage';
import AttunementPage from './pages/AttunementPage';
import NotFoundPage from './pages/NotFoundPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
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

  // Email verification is a HARD GATE (v42 correction, Angelita,
  // Oct 25, 2026: "they need to verify email. Take Later off."). A
  // signed-in but unverified user is routed to the verification gate
  // at the start of onboarding before reaching ANY app screen, so the
  // rule also holds for accounts created before this change. Resend
  // lives inside the gate, so nobody is stuck without a code path.
  // The /verify-email link page is a public route (not wrapped here),
  // so the emailed link keeps working for unverified users too.
  if (user.email_verified === false && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
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
const FLOWER_TAB_ROUTES = ['/', '/journal', '/attunement', '/calendar', '/profile'];

// App Content with routing
const AppContent = () => {
  const { user, token, loading } = useAuth();
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
      const ROOT_ROUTES = ['/', '/journal', '/attunement', '/calendar', '/profile', '/auth'];
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

  // v43: on-device local notifications are reconciled once per app
  // open for a signed-in, onboarded user. This is what keeps the
  // Daily Read text fresh (the schedule is rebuilt with today's
  // headline) and the cycle alerts lined up with her current cycle
  // data. Permission is requested in context only if she has the
  // preference on and has never been asked; a denial is left alone
  // (Profile carries one plain line about it). No-op on web.
  const notifSyncUserRef = useRef(null);
  useEffect(() => {
    if (!user || !token || loading) return;
    if (!user.onboarding_complete || user.email_verified === false) return;
    if (notifSyncUserRef.current === user.id) return;
    notifSyncUserRef.current = user.id;
    syncLocalNotifications({ user, token, requestPermission: true }).catch(() => {});
  }, [user, token, loading]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-16 h-16 rounded-full border-4 border-[#6B5B95] border-t-[#ff8fab] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen noise-overlay">
      <AmbientOrb />
      {FLOWER_TAB_ROUTES.includes(location.pathname) && <FallingFlowers />}
      {/* Email verification is the hard gate at the start of
          onboarding (v42): ProtectedRoute sends every signed-in
          unverified user there before any app screen. */}
      <div className="pb-24 lg:pb-0 relative z-[1]">
      <Routes>
        {/* Public routes */}
        <Route path="/auth" element={user ? <Navigate to="/" replace /> : <AuthPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/founders-note" element={<FoundersNotePage />} />
        <Route path="/guide" element={<GuidePage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
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
            <HomePage />
          </ProtectedRoute>
        } />
        <Route path="/calendar" element={
          <ProtectedRoute>
            <CalendarPage />
          </ProtectedRoute>
        } />
        <Route path="/journal" element={
          <ProtectedRoute>
            <JournalPage />
          </ProtectedRoute>
        } />
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
        <Route path="/attunement" element={
          <ProtectedRoute>
            <AttunementPage />
          </ProtectedRoute>
        } />
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
