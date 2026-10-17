import React from 'react';
import { BookOpen } from 'lucide-react';
import { getTodaysProverb } from '../data/dailyProverbs';

// Angelita's daily Proverb card: one chapter of Proverbs for each day of the
// month, with her picked verse. Warm and quiet, a safe place on the home screen.
export default function DailyProverb() {
  const proverb = getTodaysProverb();
  if (!proverb) return null;
  return (
    <div className="card card-pink p-5 mb-4" data-testid="daily-proverb-card">
      <div className="flex items-center gap-2 mb-3">
        <BookOpen className="w-4 h-4 text-[#ff8fab]" />
        <p className="text-[#6c6c8a] text-[10px] tracking-widest uppercase">Today&apos;s Proverb</p>
      </div>
      <p className="text-white text-base leading-relaxed italic">
        &ldquo;{proverb.text}&rdquo;
      </p>
      <p className="text-[#ff8fab] text-xs mt-3">
        {proverb.reference} · KJV
      </p>
      <p className="text-[#b8b8d1] text-xs mt-2 pt-3 border-t border-white/10">
        One chapter a day, all month long. Today&apos;s chapter is Proverbs {proverb.day}, read the whole chapter when you have a quiet minute.
      </p>
    </div>
  );
}
