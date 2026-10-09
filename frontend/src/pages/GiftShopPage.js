import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Gift, Sparkles, ShoppingBag, Heart } from 'lucide-react';

const GOLD = '#D4A853';
const PINK = '#f4a7b9';

// Placeholder affiliate links — replace with real Amazon Associates links
const AFFILIATE_TAG = 'hormoscope-20';

const CATEGORIES = [
  {
    id: 'essentials',
    name: 'Essentials',
    tagline: 'What she actually needs',
    products: [
      {
        id: 'period-panties',
        name: 'Period Panties Set',
        description: 'Leak-proof, comfortable, reusable. The upgrade she deserves.',
        price: '$25 – $45',
        search: 'period panties for women leak proof',
        emoji: '🩲',
      },
      {
        id: 'organic-tampons',
        name: 'Organic Cotton Tampons',
        description: 'Chemical-free, ultra-absorbent. Gentle for sensitive days.',
        price: '$12 – $18',
        search: 'organic cotton tampons',
        emoji: '🌿',
      },
      {
        id: 'menstrual-cup',
        name: 'Menstrual Cup',
        description: '12-hour protection, eco-friendly, cost-effective.',
        price: '$20 – $35',
        search: 'menstrual cup',
        emoji: '🌙',
      },
      {
        id: 'pads-overnight',
        name: 'Overnight Pads',
        description: 'Extra-long, ultra-absorbent for worry-free sleep.',
        price: '$8 – $14',
        search: 'overnight sanitary pads extra long',
        emoji: '☁️',
      },
    ],
  },
  {
    id: 'comfort',
    name: 'Comfort',
    tagline: 'For the hard days',
    products: [
      {
        id: 'heating-pad',
        name: 'Heating Pad for Cramps',
        description: 'Cordless, wearable relief. Her new best friend.',
        price: '$25 – $50',
        search: 'portable heating pad for menstrual cramps',
        emoji: '🔥',
      },
      {
        id: 'period-tea',
        name: 'Cycle-Supporting Tea',
        description: 'Raspberry leaf, ginger, chamomile. Warmth in a cup.',
        price: '$10 – $18',
        search: 'menstrual cramp relief tea',
        emoji: '🍵',
      },
      {
        id: 'bath-salts',
        name: 'Relaxing Bath Salts',
        description: 'Magnesium and lavender. Melt the tension away.',
        price: '$12 – $22',
        search: 'lavender bath salts relaxation',
        emoji: '🛁',
      },
      {
        id: 'weighted-blanket',
        name: 'Weighted Blanket',
        description: 'Deep pressure comfort for restless nights.',
        price: '$40 – $80',
        search: 'weighted blanket 15 lbs',
        emoji: '🛌',
      },
    ],
  },
  {
    id: 'treats',
    name: 'Treats',
    tagline: 'Because she deserves it',
    products: [
      {
        id: 'dark-chocolate',
        name: 'Dark Chocolate Box',
        description: '70%+ cacao. Magnesium-rich and mood-lifting.',
        price: '$12 – $25',
        search: 'dark chocolate gift box 70 percent',
        emoji: '🍫',
      },
      {
        id: 'silk-eye-mask',
        name: 'Silk Sleep Mask',
        description: 'Total darkness for deeper rest.',
        price: '$15 – $30',
        search: 'silk sleep mask',
        emoji: '😴',
      },
      {
        id: 'journal',
        name: 'Beautiful Journal',
        description: 'For her thoughts, dreams, and everything in between.',
        price: '$15 – $28',
        search: 'luxury journal for women',
        emoji: '📓',
      },
      {
        id: 'candle',
        name: 'Scented Candle',
        description: 'Vanilla, sandalwood, or lavender. Set the mood.',
        price: '$18 – $35',
        search: 'luxury scented candle vanilla',
        emoji: '🕯️',
      },
    ],
  },
];

function ProductCard({ product }) {
  const amazonUrl = `https://www.amazon.com/s?k=${encodeURIComponent(product.search)}&tag=${AFFILIATE_TAG}`;
  return (
    <div className="rounded-2xl p-5 border border-white/[0.06] bg-white/[0.03]" data-testid={`gift-${product.id}`}>
      <div className="text-4xl mb-3">{product.emoji}</div>
      <h3 className="text-white text-base font-medium mb-1" style={{ fontFamily: 'Poppins, sans-serif' }}>
        {product.name}
      </h3>
      <p className="text-[#9A8B91] text-xs mb-2 leading-relaxed" style={{ fontFamily: 'Poppins, sans-serif' }}>
        {product.description}
      </p>
      <p className="text-sm mb-3" style={{ fontFamily: 'Poppins, sans-serif', color: GOLD }}>
        {product.price}
      </p>
      <a
        href={amazonUrl}
        target="_blank"
        rel="noopener noreferrer sponsored"
        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-full text-sm font-medium text-white"
        style={{ fontFamily: 'Poppins, sans-serif', background: 'linear-gradient(135deg, #D4A853, #c9a030)' }}
        data-testid={`gift-buy-${product.id}`}
      >
        <ShoppingBag className="w-4 h-4" />
        Buy on Amazon
      </a>
    </div>
  );
}

export default function GiftShopPage() {
  const [activeCategory, setActiveCategory] = useState('essentials');
  const category = CATEGORIES.find(c => c.id === activeCategory);

  return (
    <div className="min-h-screen pb-28" style={{ background: 'linear-gradient(180deg, #1a1030 0%, #0f0a1a 30%, #0a0a1a 100%)' }} data-testid="gift-shop">
      <div className="max-w-md mx-auto px-5 pt-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link to="/partner-hub" className="w-10 h-10 rounded-full flex items-center justify-center border border-white/[0.1] bg-white/[0.04]">
            <ArrowLeft className="w-5 h-5 text-white/70" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <Gift className="w-4 h-4" style={{ color: GOLD }} />
              <span className="text-[10px] tracking-widest uppercase" style={{ fontFamily: 'Poppins, sans-serif', color: GOLD }}>
                Secret Gift Shop
              </span>
            </div>
            <h1 className="text-2xl text-white" style={{ fontFamily: "'Poiret One', cursive" }}>
              For Her
            </h1>
          </div>
        </div>

        {/* Intro */}
        <div className="rounded-2xl p-5 mb-6 text-center" style={{ background: `${GOLD}08`, border: `1px solid ${GOLD}20` }}>
          <Sparkles className="w-5 h-5 mx-auto mb-2" style={{ color: GOLD }} />
          <p className="text-white text-sm leading-relaxed" style={{ fontFamily: 'Poppins, sans-serif' }}>
            She is cycling. Show her you are paying attention.
          </p>
          <p className="text-[#9A8B91] text-xs mt-1" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Curated period care, comfort, and treats — delivered to her door.
          </p>
        </div>

        {/* Category tabs */}
        <div className="flex gap-2 mb-2">
          {CATEGORIES.map(c => (
            <button
              key={c.id}
              onClick={() => setActiveCategory(c.id)}
              className="flex-1 py-2.5 rounded-full text-sm font-medium"
              style={{
                fontFamily: 'Poppins, sans-serif',
                background: activeCategory === c.id ? `linear-gradient(135deg, ${GOLD}, #c9a030)` : 'rgba(255,255,255,0.04)',
                color: activeCategory === c.id ? '#fff' : 'rgba(255,255,255,0.5)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
              data-testid={`gift-cat-${c.id}`}
            >
              {c.name}
            </button>
          ))}
        </div>
        <p className="text-center text-[#9A8B91] text-xs mb-5" style={{ fontFamily: 'Poppins, sans-serif' }}>
          {category.tagline}
        </p>

        {/* Products */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {category.products.map(p => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <div className="flex items-center justify-center gap-1.5 mb-2">
            <Heart className="w-3 h-3" style={{ color: PINK }} />
            <span className="text-[#6c6c8a] text-[10px]" style={{ fontFamily: 'Poppins, sans-serif' }}>
              Thoughtful gifts, chosen with care
            </span>
          </div>
          <p className="text-[#6c6c8a] text-[10px]" style={{ fontFamily: 'Poppins, sans-serif' }}>
            As an Amazon Associate, HORMOscope earns from qualifying purchases.
          </p>
        </div>
      </div>
    </div>
  );
}
