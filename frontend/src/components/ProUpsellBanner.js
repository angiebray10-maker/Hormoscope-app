import React from 'react';
import { Sparkles, Lock, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { usePremium } from '../context/PremiumContext';

// Despite the file name, this banner only ever points at the Journal
// Companion, the one subscription in HORMOscope. It hides for companion
// subscribers (and legacy Pro state) so it never nags someone who paid.
export default function ProUpsellBanner({ context, compact }) {
  const { isPro, companionEntitled } = usePremium();
  if (isPro || companionEntitled) return null;

  const messages = {
    dashboard: {
      title: 'Meet your journal companion',
      subtitle: 'The one HORMOscope subscription lives in your private Journal. Everything else is free.',
    },
    calendar: {
      title: 'Meet your journal companion',
      subtitle: 'The one HORMOscope subscription lives in your private Journal. Everything else is free.',
    },
    journal: {
      title: 'Meet your journal companion',
      subtitle: 'A caring presence inside your Journal. Your entries are always free, and always yours.',
    },
    default: {
      title: 'Meet your journal companion',
      subtitle: 'The one HORMOscope subscription lives in your private Journal. Everything else is free.',
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
          <Sparkles className="w-4.5 h-4.5 text-[#f4a7b9]" />
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
          <Sparkles className="w-3.5 h-3.5" />
          See Journal Companion
        </div>
      </div>
    </Link>
  );
}
