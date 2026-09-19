import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { PremiumProvider } from './context/PremiumContext';
import { BottomNav } from './components/BottomNav';
import { Toaster } from './components/ui/sonner';
import InstallPrompt from './components/InstallPrompt';

// Pages
import AuthPage from './pages/AuthPage';
import OnboardingPage from './pages/OnboardingPage';
import HomePage from './pages/HomePage';
import CalendarPage from './pages/CalendarPage';
import JournalPage from './pages/JournalPage';
import InsightsPage from './pages/InsightsPage';
import ProfilePage from './pages/ProfilePage';
import ProPage from './pages/ProPage';
import PrivacyPage from './pages/PrivacyPage';
import TermsPage from './pages/TermsPage';
import FoundersNotePage from './pages/FoundersNotePage';
import ContactPage from './pages/ContactPage';
import PartnerViewPage from './pages/PartnerViewPage';
import NotFoundPage from './pages/NotFoundPage';

import './index.css';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

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

  if (!user.onboarding_complete && window.location.pathname !== '/onboarding') {
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
        <Route path="/insights" element={
          <ProtectedRoute>
            <InsightsPage />
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
