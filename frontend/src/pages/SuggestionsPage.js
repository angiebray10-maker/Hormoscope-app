import React, { useState } from 'react';
import { Lightbulb } from 'lucide-react';
import BackButton from '../components/BackButton';

// Suggestion Box (Angelita, Nov 5, 2026): a menu item on the second
// tab where users say what they would like to see in HORMOscope, or
// what feature they would like built next. Worded in her spirit:
// she reads every one herself. Sends by email, same as Contact.
export default function SuggestionsPage() {
  const [text, setText] = useState('');

  const send = () => {
    const body = encodeURIComponent(text.trim() || 'My suggestion for HORMOscope:\n\n');
    window.location.href = `mailto:hormoscope@gmail.com?subject=${encodeURIComponent('HORMOscope Suggestion')}&body=${body}`;
  };

  return (
    <div className="min-h-screen pb-32 lg:pb-8 lg:pl-72 p-6" style={{ background: '#0B0B1E' }} data-testid="suggestions-page">
      <BackButton fallback="/profile" className="mb-8" />

      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#F4D3DC] to-[#E8A4B8] flex items-center justify-center">
          <Lightbulb className="w-6 h-6 text-[#0D0609]" />
        </div>
        <h1 className="text-4xl text-[#F4D3DC] font-script">Suggestion Box</h1>
      </div>

      <div className="glass-card p-6" style={{ fontFamily: 'Poppins, sans-serif' }}>
        <h2 className="text-lg font-medium text-[#FDF8FA] mb-3">What would you like to see in HORMOscope?</h2>
        <p className="text-[#CFC3CC] text-sm leading-relaxed mb-4">
          A feature you wish it had, something you would like changed, an idea you had while using it. Write it here and send it my way. I read every suggestion myself.
        </p>
        <textarea
          data-testid="suggestion-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          placeholder="I would love it if HORMOscope could..."
          className="w-full rounded-xl px-4 py-3 text-sm text-white focus:outline-none bg-white/5 border border-white/15 mb-4"
        />
        <button
          onClick={send}
          data-testid="suggestion-send-btn"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-transparent border-[1.5px] border-[#E8A4B8] text-[#F4D3DC] font-medium text-sm"
        >
          <Lightbulb className="w-5 h-5" />
          Send My Suggestion
        </button>
        <p className="text-[#CFC3CC] text-xs mt-4">
          The button opens your email app addressed to hormoscope@gmail.com. No email app? Write to hormoscope@gmail.com directly.
        </p>
      </div>
    </div>
  );
}
