import React from 'react';
import { BookHeart } from 'lucide-react';
import { getTodaysProverb } from '../data/dailyProverbs';

// Daily Devotional — the day's Proverb in its own quiet place (Angelita,
// Oct 17: the verse comes off Home and gets a tab of its own). One verse a
// day from the existing dailyProverbs data; nothing else lives here.
export default function DevotionalPage() {
  const proverb = getTodaysProverb();
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div
      className="min-h-screen pb-28 lg:pb-8 lg:pl-64 px-5 pt-8"
      style={{ background: 'linear-gradient(180deg, #1a1030 0%, #0f0a1a 30%, #0a0a1a 100%)' }}
      data-testid="devotional-page"
    >
      <div className="w-full max-w-2xl mx-auto">
        <div className="flex items-center gap-2 mb-2">
          <BookHeart className="w-5 h-5 text-[#ff8fab]" />
          <h1 className="text-3xl text-white" style={{ fontFamily: "'Poiret One', cursive" }}>
            Daily Devotional
          </h1>
        </div>
        <p className="text-[#c9b8f0] text-sm mb-8" data-testid="devotional-date">
          {today}
        </p>

        {proverb && (
          <div className="card card-pink p-6 sm:p-8" data-testid="devotional-verse-card">
            <p className="text-[#6c6c8a] text-[10px] tracking-widest uppercase mb-4">
              Today&apos;s reading
            </p>
            <p
              className="text-white text-xl sm:text-2xl leading-relaxed italic"
              data-testid="devotional-verse"
            >
              &ldquo;{proverb.text}&rdquo;
            </p>
            <p className="text-[#ff8fab] text-sm mt-5" data-testid="devotional-reference">
              {proverb.reference} · KJV
            </p>
            <p className="text-[#b8b8d1] text-xs leading-relaxed mt-6 pt-4 border-t border-white/10">
              Proverbs has 31 chapters, one for each day of the month, so there is a new
              reading waiting for you every day.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
