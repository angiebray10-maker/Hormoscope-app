import React, { useEffect } from 'react';
import HomePage from './HomePage';
import JournalPage from './JournalPage';
import AttunementPage from './AttunementPage';
import TabFooter from '../components/TabFooter';
import { rescheduleIfPermitted } from '../utils/notifications';

// v64 (Angelita, Nov 4, 2026): the ONE main tab. Home, Journal and
// Attunement live stacked in a single scroll, in that order; the
// only other tab is Profile. Each section renders embedded: no
// full-screen chrome of its own, and the logo footer rests once at
// the very bottom of the whole tab.
export default function MainTabPage() {
  useEffect(() => {
    // Keep her twice-a-week 9 AM reminders scheduled across
    // restarts, without ever prompting from here.
    rescheduleIfPermitted();
  }, []);

  return (
    <div data-testid="main-tab" className="lg:pl-64">
      <HomePage embedded />
      <JournalPage embedded />
      <AttunementPage embedded />
      <div className="px-5 pb-28 lg:pb-8">
        <TabFooter />
      </div>
    </div>
  );
}
