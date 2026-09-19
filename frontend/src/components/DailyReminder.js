import React, { useState, useEffect } from 'react';
import { X, Sparkles } from 'lucide-react';

const sweetMessages = [
  "You're doing amazing, beautiful ✨",
  "Listen to your body today ✨",
  "You are worthy of love and rest ✨",
  "Your cycle is your superpower ✨",
  "Be gentle with yourself today ✨",
  "You're stronger than you know ✨",
  "Trust your body's wisdom ✨",
  "Today is a fresh start ✨",
  "You deserve all the good things ✨",
  "Your feelings are valid ✨"
];

export default function DailyReminder({ cycleDay, phase, userName }) {
  const [show, setShow] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    // Check if we've shown the reminder today
    const today = new Date().toDateString();
    const lastShown = localStorage.getItem('horMoscope_lastReminder');
    
    if (lastShown !== today && cycleDay) {
      // Pick a message based on the day
      const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
      const messageIndex = dayOfYear % sweetMessages.length;
      setMessage(sweetMessages[messageIndex]);
      
      // Show after a short delay
      const timer = setTimeout(() => {
        setShow(true);
      }, 1500);
      
      return () => clearTimeout(timer);
    }
  }, [cycleDay]);

  const handleDismiss = () => {
    setShow(false);
    localStorage.setItem('horMoscope_lastReminder', new Date().toDateString());
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-sm glass-card p-8 relative animate-fade-in-up">
        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-[#9A8B91] hover:text-[#FDF8FA] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#F4D3DC] to-[#E8A4B8] mb-4 shadow-[0_0_40px_rgba(244,211,220,0.3)]">
            <Sparkles className="w-8 h-8 text-[#12090E]" />
          </div>
          <h1 className="text-2xl" style={{ fontFamily: "'Poiret One', cursive", fontWeight: 400, color: '#c9b8f0' }}>HORMOscope</h1>
        </div>

        {/* Cycle Day - Big and prominent */}
        <div className="text-center mb-6">
          <p className="text-[#9A8B91] text-xs tracking-[0.3em] uppercase mb-2">Today you are on</p>
          <div className="inline-flex items-baseline gap-2">
            <span className="text-[#F4D3DC] text-lg tracking-wider">DAY</span>
            <span className="text-5xl font-semibold text-[#FDF8FA]">{cycleDay}</span>
          </div>
          <p className="text-[#C9B8C1] text-sm mt-2 tracking-wide">{phase}</p>
        </div>

        {/* Sweet message */}
        <div className="text-center mb-6">
          <p className="text-[#F4D3DC] text-lg leading-relaxed">
            {message}
          </p>
        </div>

        {/* Greeting */}
        {userName && (
          <p className="text-center text-[#9A8B91] text-sm">
            Have a beautiful day, {userName} ✨
          </p>
        )}

        {/* Dismiss button */}
        <button
          onClick={handleDismiss}
          className="w-full mt-6 py-3 rounded-full bg-gradient-to-r from-[#F4D3DC] to-[#E8A4B8] text-[#12090E] font-medium text-sm tracking-wider"
        >
          Let&apos;s Go
        </button>
      </div>
    </div>
  );
}
