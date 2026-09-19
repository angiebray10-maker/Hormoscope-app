import React, { useState, useEffect } from 'react';
import { usePremium } from '../context/PremiumContext';
import { useAuth } from '../context/AuthContext';
import { Crown, Check, Shield, Loader2, RotateCcw, Sun, BarChart3, TrendingUp, ChevronDown, BookOpen } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const GOLD = '#D4A853';

const trackEvent = (token, event, context = '', plan = '') => {
  if (!token) return;
  axios.post(`${API}/analytics/event`, { event, context, plan }, {
    headers: { Authorization: `Bearer ${token}` }
  }).catch(() => {});
};

const PRO_FEATURES = [
  {
    icon: Sun,
    title: 'Your Daily Read',
    subtitle: 'Personalized readings that grow with you',
    description: 'Every morning, a fresh reading woven from your journal entries, cycle biology, symptoms, and patterns. The more you invest, the more powerfully it attunes to your unique body.',
  },
  {
    icon: TrendingUp,
    title: 'Daily Rhythm Report',
    subtitle: 'Know what to expect every single day',
    description: 'A personalized daily briefing covering your energy, mood, focus, movement, recovery, self-care, libido, and pain tolerance. Updated every morning based on where you are in your cycle.',
  },
  {
    icon: BarChart3,
    title: 'Hormone Map',
    subtitle: 'See your hormones in motion',
    description: 'An interactive chart showing your estrogen, progesterone, and LH levels across your entire cycle. See exactly where you are today and what it means for how you feel.',
  },
  {
    icon: BookOpen,
    title: 'The Journal',
    subtitle: 'Your private space — that makes Your Daily Read smarter',
    description: 'A beautiful lined-paper journal with handwritten "Satisfy" font and a mini-calendar to revisit any day. Every entry teaches your Daily Read more about you — so it grows more personal with every cycle.',
  },
];

export default function ProPage() {
  const { isPro, refreshCustomerInfo } = usePremium();
  const { token } = useAuth();
  const location = useLocation();
  const [selectedPlan, setSelectedPlan] = useState('yearly');
  const [purchasing, setPurchasing] = useState(null);
  const [unlocking, setUnlocking] = useState(false);
  const [expandedFeature, setExpandedFeature] = useState(null);

  useEffect(() => {
    const source = new URLSearchParams(location.search).get('from') || 'tab';
    trackEvent(token, 'paywall_view', source);
  }, [location.search, token]);

  const handleStripeCheckout = async (plan) => {
    if (purchasing) return;
    setPurchasing(plan);
    trackEvent(token, 'stripe_checkout_start', '', plan);
    try {
      const res = await axios.post(
        `${API}/payments/v1/checkout/session`,
        { plan, origin_url: window.location.origin },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data?.url) {
        window.location.href = res.data.url;
      } else {
        throw new Error('No checkout URL');
      }
    } catch (err) {
      setPurchasing(null);
      alert('Could not start checkout. Please try again or contact support.');
    }
  };

  const handleManualUnlock = async () => {
    if (unlocking) return;
    const confirmed = window.confirm(
      'Only click this if you have already subscribed and your access has not unlocked. Misuse may result in account suspension. Continue?'
    );
    if (!confirmed) return;
    setUnlocking(true);
    try {
      await axios.post(`${API}/premium/manual-unlock`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      await refreshCustomerInfo();
      window.location.href = '/';
    } catch (err) {
      alert('Could not unlock. Please try again or contact support.');
      setUnlocking(false);
    }
  };

  // Already Pro — show welcome state
  if (isPro) {
    return (
      <div className="min-h-screen pb-32 px-5 lg:ml-64 pt-6" style={{ background: 'linear-gradient(180deg, rgba(212,168,83,0.12) 0%, rgba(212,168,83,0.04) 30%, #0a0a1a 60%)' }} data-testid="pro-page-active">
        <div className="max-w-lg mx-auto">
          <div className="text-center py-6 mb-4">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: 'rgba(212,168,83,0.2)', boxShadow: '0 0 30px rgba(212,168,83,0.15)' }}>
              <Crown className="w-7 h-7" style={{ color: GOLD }} />
            </div>
            <h1 className="text-2xl text-white mb-1" style={{ fontFamily: "'Poiret One', cursive" }}>HORMOscope Pro</h1>
            <p className="text-sm" style={{ fontFamily: 'Poppins, sans-serif', color: GOLD }}>Your Pro Self, Cycle by Cycle</p>
          </div>

          <div className="space-y-3 mb-6">
            {PRO_FEATURES.map((f, i) => (
              <button
                key={f.title}
                onClick={() => setExpandedFeature(expandedFeature === i ? null : i)}
                className="w-full rounded-xl p-4 text-left transition-all"
                style={{ border: '1px solid rgba(212,168,83,0.35)', background: 'rgba(212,168,83,0.04)' }}
                data-testid={`pro-feature-${f.title}`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(212,168,83,0.12)' }}>
                    <f.icon className="w-4 h-4" style={{ color: GOLD }} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm" style={{ fontFamily: "'Poiret One', cursive", color: '#FF1493' }}>{f.title}</h3>
                    <p className="text-xs" style={{ fontFamily: 'Poppins, sans-serif', color: GOLD }}>{f.subtitle}</p>
                  </div>
                  <ChevronDown className={`w-4 h-4 transition-transform ${expandedFeature === i ? 'rotate-180' : ''}`} style={{ color: GOLD }} />
                </div>
                {expandedFeature === i && (
                  <p className="text-white/60 text-xs leading-relaxed mt-3 ml-12" style={{ fontFamily: 'Poppins, sans-serif' }}>{f.description}</p>
                )}
              </button>
            ))}
          </div>

          <Link to="/" className="block w-full py-3.5 rounded-full text-white font-semibold text-sm text-center" style={{ fontFamily: 'Poppins, sans-serif', background: 'linear-gradient(135deg, #D4A853, #c9a030)', boxShadow: '0 0 25px rgba(212,168,83,0.3)' }} data-testid="ultimate-cta-btn">
            Start Your Pro Experience
          </Link>
        </div>
      </div>
    );
  }

  // Free user — paywall (renders INSTANTLY, no SDK loading)
  return (
    <div className="min-h-screen pb-44 px-0 lg:ml-64 pt-0" style={{ background: 'linear-gradient(180deg, #0a0a1a 0%, #0a0a1a 100%)' }} data-testid="pro-page">

      {/* HERO */}
      <section className="py-12 px-5 relative overflow-hidden">
        <div className="absolute inset-0" style={{ backgroundImage: `url(https://customer-assets.emergentagent.com/job_e50c2d92-7748-4a4a-9e13-69705a94ca58/artifacts/5wjhwc0j_IMG_0551.jpeg)`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
          <div className="absolute inset-0" style={{ background: 'rgba(10,10,26,0.88)' }} />
        </div>
        <div className="max-w-lg mx-auto relative z-10">
          <div className="text-center mb-8">
            <p className="text-xs sm:text-sm tracking-[0.3em] uppercase mb-3" style={{ fontFamily: "'Poiret One', cursive", color: GOLD }}>Introducing</p>
            <h1 className="text-white leading-[1.05]" style={{ fontFamily: "'Poiret One', cursive", fontSize: 'clamp(2.5rem, 9vw, 4.5rem)' }} data-testid="paywall-headline">
              HORMOscope
              <br />
              <span style={{ color: GOLD }}>Pro</span>
            </h1>
            <p className="text-xs sm:text-sm leading-relaxed mt-5 max-w-md mx-auto" style={{ fontFamily: "'Poiret One', cursive", color: 'rgba(255,255,255,0.75)' }} data-testid="paywall-tagline">
              Unlock deeper self-understanding with personalized daily reads.
            </p>
          </div>

          {/* Screenshots showcase */}
          <div className="rounded-2xl p-3 sm:p-4 mb-2" style={{ border: '1.5px solid #D4A853', background: 'rgba(212,168,83,0.05)', boxShadow: '0 0 40px rgba(212,168,83,0.18)' }} data-testid="pro-screenshot-showcase">
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div className="rounded-lg overflow-hidden relative" style={{ border: '1px solid rgba(212,168,83,0.4)' }}>
                <img src="/pro-screenshots/daily_read.png" alt="Your Daily Read" className="w-full block" loading="lazy" />
                <p className="absolute bottom-0 left-0 right-0 text-center py-1 text-[10px]" style={{ background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.7))', fontFamily: 'Poppins, sans-serif', color: '#FFFFFF' }}>Your Daily Read</p>
              </div>
              <div className="rounded-lg overflow-hidden relative" style={{ border: '1px solid rgba(212,168,83,0.4)' }}>
                <img src="/pro-screenshots/rhythm.png" alt="Daily Rhythm Report" className="w-full block" loading="lazy" />
                <p className="absolute bottom-0 left-0 right-0 text-center py-1 text-[10px]" style={{ background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.7))', fontFamily: 'Poppins, sans-serif', color: '#FFFFFF' }}>Daily Rhythm Report</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div className="rounded-lg overflow-hidden relative" style={{ border: '1px solid rgba(212,168,83,0.4)' }}>
                <img src="/pro-screenshots/hormone.png" alt="Hormone Map" className="w-full block" loading="lazy" />
                <p className="absolute bottom-0 left-0 right-0 text-center py-1 text-[10px]" style={{ background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.7))', fontFamily: 'Poppins, sans-serif', color: '#FFFFFF' }}>Hormone Map</p>
              </div>
              <div className="rounded-lg overflow-hidden relative" style={{ border: '1px solid rgba(212,168,83,0.4)' }}>
                <img src="/pro-screenshots/journal.png" alt="The Journal" className="w-full block" loading="lazy" />
                <p className="absolute bottom-0 left-0 right-0 text-center py-1 text-[10px]" style={{ background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.7))', fontFamily: 'Poppins, sans-serif', color: '#FFFFFF' }}>The Journal</p>
              </div>
            </div>
            <div className="max-w-[50%] mx-auto">
              <div className="rounded-lg overflow-hidden relative" style={{ border: '1px solid rgba(212,168,83,0.4)' }}>
                <img src="/pro-screenshots/calendar.png" alt="Private Calendar" className="w-full block" loading="lazy" />
                <p className="absolute bottom-0 left-0 right-0 text-center py-1 text-[10px]" style={{ background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.7))', fontFamily: 'Poppins, sans-serif', color: '#FFFFFF' }}>Private Calendar</p>
              </div>
            </div>
          </div>
          <p className="text-center text-[10px] mt-4" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>
            Scroll down to learn more &amp; subscribe
          </p>
        </div>
      </section>

      <div className="max-w-lg mx-auto px-5">

        {/* Feature list */}
        <div className="space-y-2 mb-6 mt-4">
          {PRO_FEATURES.map((f, i) => (
            <button
              key={f.title}
              onClick={() => setExpandedFeature(expandedFeature === i ? null : i)}
              className="w-full rounded-xl p-4 text-left transition-all"
              style={{ border: '1px solid rgba(212,168,83,0.35)', background: 'rgba(212,168,83,0.04)' }}
              data-testid={`pro-feature-${f.title}`}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(212,168,83,0.12)' }}>
                  <f.icon className="w-4 h-4" style={{ color: GOLD }} />
                </div>
                <div className="flex-1">
                  <h3 className="text-white text-sm" style={{ fontFamily: "'Poiret One', cursive" }}>{f.title}</h3>
                  <p className="text-xs" style={{ fontFamily: 'Poppins, sans-serif', color: GOLD }}>{f.subtitle}</p>
                </div>
                <ChevronDown className={`w-4 h-4 transition-transform ${expandedFeature === i ? 'rotate-180' : ''}`} style={{ color: GOLD }} />
              </div>
              {expandedFeature === i && (
                <p className="text-white/60 text-xs leading-relaxed mt-3 ml-12" style={{ fontFamily: 'Poppins, sans-serif' }}>{f.description}</p>
              )}
            </button>
          ))}
        </div>

        {/* Pricing */}
        <div className="text-center mb-4">
          <h2 className="text-lg text-white" style={{ fontFamily: "'Poiret One', cursive" }}>Choose Your Plan</h2>
        </div>

        <div className="space-y-2 mb-4">
          {/* Yearly */}
          <button
            data-testid="plan-yearly"
            onClick={() => setSelectedPlan('yearly')}
            className="w-full rounded-xl text-left transition-all relative overflow-hidden"
            style={{
              border: selectedPlan === 'yearly' ? '2px solid #D4A853' : '1px solid rgba(212,168,83,0.3)',
              background: selectedPlan === 'yearly' ? 'rgba(212,168,83,0.08)' : 'rgba(212,168,83,0.02)',
              boxShadow: selectedPlan === 'yearly' ? '0 0 20px rgba(212,168,83,0.15)' : 'none'
            }}
          >
            <div className="py-1.5 px-3 text-center" style={{ background: 'linear-gradient(135deg, #D4A853, #c9a030)' }}>
              <span className="text-white text-xs font-medium tracking-wider uppercase" style={{ fontFamily: 'Poppins, sans-serif' }}>
                Best Value — Save 33%
              </span>
            </div>
            <div className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white text-sm" style={{ fontFamily: "'Poiret One', cursive" }}>Yearly</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs line-through" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }} data-testid="yearly-strikethrough-pro">$119.99</span>
                    <span className="text-lg font-semibold" style={{ color: GOLD }}>$79.99</span>
                    <span className="text-white/50 text-xs">/yr</span>
                  </div>
                  <p className="text-white/40 text-xs" style={{ fontFamily: 'Poppins, sans-serif' }}>$6.67/mo · Save $40</p>
                </div>
                <div className="w-6 h-6 rounded-full border-2 flex items-center justify-center" style={{ borderColor: selectedPlan === 'yearly' ? GOLD : 'rgba(255,255,255,0.3)', background: selectedPlan === 'yearly' ? GOLD : 'transparent' }}>
                  {selectedPlan === 'yearly' && <Check className="w-3.5 h-3.5 text-white" />}
                </div>
              </div>
            </div>
          </button>

          {/* Monthly */}
          <button
            data-testid="plan-monthly"
            onClick={() => setSelectedPlan('monthly')}
            className="w-full p-3 rounded-xl text-left transition-all"
            style={{
              border: selectedPlan === 'monthly' ? '2px solid #D4A853' : '1px solid rgba(212,168,83,0.3)',
              background: selectedPlan === 'monthly' ? 'rgba(212,168,83,0.08)' : 'rgba(212,168,83,0.02)',
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white text-sm" style={{ fontFamily: "'Poiret One', cursive" }}>Monthly</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-xs line-through" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }} data-testid="monthly-strikethrough-pro">$14.99</span>
                  <span className="text-lg font-semibold" style={{ color: GOLD }}>$9.99</span>
                  <span className="text-white/50 text-xs">/mo</span>
                </div>
                <p className="text-white/40 text-xs" style={{ fontFamily: 'Poppins, sans-serif' }}>Cancel anytime</p>
              </div>
              <div className="w-6 h-6 rounded-full border-2 flex items-center justify-center" style={{ borderColor: selectedPlan === 'monthly' ? GOLD : 'rgba(255,255,255,0.3)', background: selectedPlan === 'monthly' ? GOLD : 'transparent' }}>
                {selectedPlan === 'monthly' && <Check className="w-3.5 h-3.5 text-white" />}
              </div>
            </div>
          </button>
        </div>

        {/* Trust */}
        <div className="flex items-center justify-center gap-6 mb-4">
          <div className="flex items-center gap-1.5 text-white/50 text-xs" style={{ fontFamily: 'Poppins, sans-serif' }}>
            <Shield className="w-3.5 h-3.5" style={{ color: GOLD }} />
            Secure payment
          </div>
          <div className="flex items-center gap-1.5 text-white/50 text-xs" style={{ fontFamily: 'Poppins, sans-serif' }}>
            <RotateCcw className="w-3.5 h-3.5" style={{ color: GOLD }} />
            Cancel anytime
          </div>
        </div>

        {/* Footer links */}
        <div className="flex items-center justify-center gap-4 pb-6 flex-wrap mt-6" data-testid="footer-links">
          <Link to="/terms" className="text-[#9A8B91]/80 text-xs hover:text-white transition-colors" style={{ fontFamily: 'Poppins, sans-serif' }} data-testid="terms-link">Terms</Link>
          <Link to="/privacy" className="text-[#9A8B91]/80 text-xs hover:text-white transition-colors" style={{ fontFamily: 'Poppins, sans-serif' }} data-testid="privacy-link">Privacy</Link>
        </div>
      </div>

      {/* Sticky CTA — direct Stripe checkout */}
      <div className="fixed bottom-24 lg:bottom-0 left-0 right-0 lg:left-64 px-5 pb-2 pt-2 z-[999]">
        <div className="max-w-lg mx-auto">
          <button
            data-testid="purchase-btn"
            onClick={() => handleStripeCheckout(selectedPlan)}
            disabled={!!purchasing}
            className="w-full py-2.5 rounded-full text-white font-semibold text-xs tracking-wide transition-all disabled:opacity-60"
            style={{ fontFamily: 'Poppins, sans-serif', background: 'transparent', border: '2px solid #FF1493', color: '#FF1493' }}
          >
            {purchasing ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Redirecting to Stripe...
              </span>
            ) : (
              'Unlock HORMOscope Pro'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
