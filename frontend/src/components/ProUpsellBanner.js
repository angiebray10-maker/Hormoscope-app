import React from 'react';
import { Crown, Lock, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { usePremium } from '../context/PremiumContext';

export default function ProUpsellBanner({ context, compact }) {
  const { isPro } = usePremium();
  if (isPro) return null;

  const messages = {
    dashboard: {
      title: 'Want to go deeper?',
      subtitle: 'Unlock deeper self-understanding with personalized daily reads.',
    },
    calendar: {
      title: 'Unlock HORMOscope Pro',
      subtitle: 'Unlock personalized daily reads, hormone maps, and unlimited journaling.',
    },
    journal: {
      title: 'Unlock deeper self-understanding',
      subtitle: 'Unlimited journal entries that train your personalized daily read.',
    },
    rhythm: {
      title: 'Your Daily Rhythm Report',
      subtitle: 'Unlock personalized guidance for energy, mood, focus, and more.',
    },
    hormone: {
      title: 'Your Hormone Map',
      subtitle: 'See estrogen, progesterone, and LH across your cycle.',
    },
    default: {
      title: 'Unlock HORMOscope Pro',
      subtitle: 'Unlock deeper self-understanding with personalized daily reads.',
    },
  };

  const msg = messages[context] || messages.default;

  if (compact) {
    return (
      <Link
        to={`/pro?from=${context}`}
        className="flex items-center gap-3 rounded-2xl p-4 border border-[#f4a7b9]/20 bg-gradient-to-r from-[#f4a7b9]/[0.06] to-[#c9b8f0]/[0.04] hover:border-[#f4a7b9]/40 transition-all"
        data-testid={`pro-upsell-${context}`}
      >
        <div className="w-9 h-9 rounded-full bg-[#f4a7b9]/15 flex items-center justify-center flex-shrink-0">
          <Crown className="w-4.5 h-4.5 text-[#f4a7b9]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-xs font-medium truncate" style={{ fontFamily: 'Poppins, sans-serif' }}>{msg.title}</p>
          <p className="text-[#9A8B91] text-[10px] truncate" style={{ fontFamily: 'Poppins, sans-serif' }}>{msg.subtitle}</p>
        </div>
        <ChevronRight className="w-4 h-4 text-[#f4a7b9] flex-shrink-0" />
      </Link>
    );
  }

  return (
    <Link
      to={`/pro?from=${context}`}
      className="block rounded-2xl overflow-hidden border border-[#f4a7b9]/20 bg-gradient-to-br from-[#f4a7b9]/[0.08] to-[#c9b8f0]/[0.04] hover:border-[#f4a7b9]/40 transition-all"
      data-testid={`pro-upsell-${context}`}
    >
      <div className="p-5">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#f4a7b9]/20 to-[#c9b8f0]/15 flex items-center justify-center flex-shrink-0">
            <Lock className="w-5 h-5 text-[#f4a7b9]" />
          </div>
          <div className="flex-1">
            <p className="text-white text-sm font-medium mb-1" style={{ fontFamily: 'Poppins, sans-serif' }}>{msg.title}</p>
            <p className="text-[#9A8B91] text-xs leading-relaxed" style={{ fontFamily: 'Poppins, sans-serif' }}>{msg.subtitle}</p>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-center gap-2 py-2.5 rounded-full text-white text-xs font-medium" style={{ fontFamily: 'Poppins, sans-serif', background: 'linear-gradient(135deg, #D4A853, #c9a030)' }}>
          <Crown className="w-3.5 h-3.5" />
          See Pro Plans
        </div>
      </div>
    </Link>
  );
}
