import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { PremiumProvider } from './context/PremiumContext';
import { BottomNav } from './components/BottomNav';
import { Toaster } from './components/ui/sonner';
import InstallPrompt from './components/InstallPrompt';

// Pages
import AuthPage from './pages/AuthPage';
import OnboardingPage from './pages/OnboardingPage';
import HomePage from './pages/HomePage';
import DevotionalPage from './pages/DevotionalPage';
import CalendarPage from './pages/CalendarPage';
import JournalPage from './pages/JournalPage';
import ProfilePage from './pages/ProfilePage';
import ProPage from './pages/ProPage';
import PrivacyPage from './pages/PrivacyPage';
import TermsPage from './pages/TermsPage';
import FoundersNotePage from './pages/FoundersNotePage';
import GuidePage from './pages/GuidePage';
import ContactPage from './pages/ContactPage';
import PartnerViewPage from './pages/PartnerViewPage';
import PartnerHubPage from './pages/PartnerHubPage';
import AttunementPage from './pages/AttunementPage';
import NotFoundPage from './pages/NotFoundPage';

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

// App Content with routing
const AppContent = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-16 h-16 rounded-full border-4 border-[#6B5B95] border-t-[#ff8fab] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen noise-overlay">
      <Routes>
        {/* Public routes */}
        <Route path="/auth" element={user ? <Navigate to="/" replace /> : <AuthPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/founders-note" element={<FoundersNotePage />} />
        <Route path="/guide" element={<GuidePage />} />
        <Route path="/contact" element={<ContactPage />} />
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
        <Route path="/devotional" element={
          <ProtectedRoute>
            <DevotionalPage />
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
        <Route path="/pro" element={
          <ProtectedRoute>
            <ProPage />
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
