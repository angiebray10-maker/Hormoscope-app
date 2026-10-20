import React, { useState, useEffect } from 'react';
import { usePremium } from '../context/PremiumContext';
import { useAuth } from '../context/AuthContext';
import { Shield, Loader2, RotateCcw, Sun, ChevronDown, BookOpen } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import {
  isBillingConfigured,
  ensureRevenueCatUser,
  getCompanionPackage,
  purchaseCompanion,
  restoreCompanion,
} from '../utils/revenueCat';

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
    icon: BookOpen,
    title: 'Journal Companion',
    subtitle: 'Our one subscription',
    description: 'A caring companion who lives inside your private Journal: you choose the name, and it answers you in the book, knowing your cycle and what your day has held. Your first 3 messages together are free, and every word stays in your journal when you subscribe. The Journal itself, and your Vault, are free forever. The companion is the one feature offered as a subscription, $9.99 a month through Google Play.',
  },
  {
    icon: Sun,
    title: 'Everything Else Is Free',
    subtitle: 'Tracking, readings, journal, and Attunement',
    description: 'Cycle tracking, your Calendar, your Daily Read, your Journal and Journal Vault, and Attuned Partner Mode are all free for every user. No trial clock, no locked pages. This page exists for the one companion subscription.',
  },
];

export default function ProPage() {
  const { companionEntitled, companionExpires, companionWillRenew, refreshCompanion, refreshCustomerInfo } = usePremium();
  const { token, user } = useAuth();
  const location = useLocation();
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [expandedFeature, setExpandedFeature] = useState(null);
  const [companionPkg, setCompanionPkg] = useState(null);
  const [pkgLoading, setPkgLoading] = useState(false);
  const [status, setStatus] = useState('');
  const nativeBilling = isBillingConfigured();

  useEffect(() => {
    const source = new URLSearchParams(location.search).get('from') || 'tab';
    trackEvent(token, 'paywall_view', source);
  }, [location.search, token]);

  // Native: load the dedicated journal_companion offering's monthly package.
  // The price shown is the real Google Play price, read through RevenueCat.
  useEffect(() => {
    if (!nativeBilling) return;
    let cancelled = false;
    (async () => {
      setPkgLoading(true);
      await ensureRevenueCatUser(user?.id);
      const found = await getCompanionPackage();
      if (!cancelled) {
        setCompanionPkg(found);
        setPkgLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [nativeBilling, user?.id]);

  // After any purchase or restore, ask our backend to verify with
  // RevenueCat server-side and refresh both entitlement views.
  const syncWithBackend = async () => {
    try {
      await axios.post(`${API}/subscription/revenuecat/sync`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // Non-fatal: the RevenueCat webhook will sync it shortly.
    }
    await refreshCompanion();
    await refreshCustomerInfo();
  };

  const handleCompanionPurchase = async () => {
    if (purchasing) return;
    setPurchasing(true);
    setStatus('');
    trackEvent(token, 'companion_purchase_start', '', 'journal_companion_monthly');
    try {
      await ensureRevenueCatUser(user?.id);
      const result = await purchaseCompanion();
      if (result.status === 'active') {
        trackEvent(token, 'companion_purchase_success', '', 'journal_companion_monthly');
        await syncWithBackend();
        setStatus('Your Journal Companion is active. Welcome.');
      } else if (result.status === 'pending') {
        setStatus('Your purchase is pending with Google Play. Your companion opens as soon as Google completes it, and there is nothing more you need to do.');
      } else if (result.status === 'cancelled') {
        trackEvent(token, 'companion_purchase_cancelled', '', 'journal_companion_monthly');
        setStatus('');
      } else {
        trackEvent(token, 'companion_purchase_failed', result.message || '', 'journal_companion_monthly');
        setStatus('That purchase could not be completed. Nothing was charged. Please try again.');
      }
    } catch {
      setStatus('That purchase could not be completed. Nothing was charged. Please try again.');
    } finally {
      setPurchasing(false);
    }
  };

  const handleCompanionRestore = async () => {
    if (restoring) return;
    setRestoring(true);
    setStatus('');
    try {
      await ensureRevenueCatUser(user?.id);
      const result = await restoreCompanion();
      if (result.status === 'active') {
        await syncWithBackend();
        setStatus('Your Journal Companion subscription is restored.');
      } else if (result.status === 'none') {
        setStatus('No Journal Companion subscription was found for this Google account.');
      } else {
        setStatus('Restore could not be completed. Please try again.');
      }
    } finally {
      setRestoring(false);
    }
  };

  const renewalLine = () => {
    if (!companionExpires) return '';
    try {
      const d = new Date(companionExpires);
      const label = d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
      return companionWillRenew ? `Renews ${label}` : `Access until ${label}`;
    } catch {
      return '';
    }
  };

  const featureList = (
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
  );

  // Already subscribed to the Journal Companion.
  if (companionEntitled) {
    return (
      <div className="min-h-screen pb-32 px-5 lg:ml-64 pt-6" style={{ background: 'linear-gradient(180deg, rgba(212,168,83,0.12) 0%, rgba(212,168,83,0.04) 30%, #0a0a1a 60%)' }} data-testid="companion-active-page">
        <div className="max-w-lg mx-auto">
          <div className="text-center py-6 mb-4">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: 'rgba(212,168,83,0.2)', boxShadow: '0 0 30px rgba(212,168,83,0.15)' }}>
              <BookOpen className="w-7 h-7" style={{ color: GOLD }} />
            </div>
            <h1 className="text-2xl text-white mb-1" style={{ fontFamily: "'Poiret One', cursive" }}>Journal Companion</h1>
            <p className="text-sm" style={{ fontFamily: 'Poppins, sans-serif', color: GOLD }}>Your Journey&apos;s Companion.</p>
            <p className="text-sm mt-1" style={{ fontFamily: 'Poppins, sans-serif', color: 'rgba(255,255,255,0.6)' }}>Your companion is with you</p>
            {renewalLine() && (
              <p className="text-xs mt-2" style={{ fontFamily: 'Poppins, sans-serif', color: 'rgba(255,255,255,0.55)' }}>{renewalLine()}</p>
            )}
          </div>

          {featureList}

          <Link to="/journal" className="block w-full py-3.5 rounded-full text-white font-semibold text-sm text-center" style={{ fontFamily: 'Poppins, sans-serif', background: 'linear-gradient(135deg, #D4A853, #c9a030)', boxShadow: '0 0 25px rgba(212,168,83,0.3)' }} data-testid="companion-open-journal-btn">
            Open Your Journal
          </Link>
          {nativeBilling && (
            <button
              onClick={() => window.open('https://play.google.com/store/account/subscriptions', '_blank')}
              className="block w-full mt-3 py-2 text-center text-xs"
              style={{ fontFamily: 'Poppins, sans-serif', color: 'rgba(255,255,255,0.5)' }}
              data-testid="companion-manage-btn"
            >
              Manage subscription in Google Play
            </button>
          )}
        </div>
      </div>
    );
  }

  // Purchase screen for the Journal Companion subscription.
  return (
    <div className="min-h-screen pb-32 px-0 lg:ml-64 pt-0" style={{ background: 'linear-gradient(180deg, #0a0a1a 0%, #0a0a1a 100%)' }} data-testid="pro-page">

      {/* HERO */}
      <section className="py-12 px-5 relative overflow-hidden">
        <div className="absolute inset-0" style={{ backgroundImage: `url(/images/img-0551.jpeg)`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
          <div className="absolute inset-0" style={{ background: 'rgba(10,10,26,0.88)' }} />
        </div>
        <div className="max-w-lg mx-auto relative z-10">
          <div className="text-center mb-8">
            <p className="text-xs sm:text-sm tracking-[0.3em] uppercase mb-3" style={{ fontFamily: "'Poiret One', cursive", color: GOLD }}>Introducing</p>
            <h1 className="text-white leading-[1.05]" style={{ fontFamily: "'Poiret One', cursive", fontSize: 'clamp(2.5rem, 9vw, 4.5rem)' }} data-testid="paywall-headline">
              Journal
              <br />
              <span style={{ color: GOLD }}>Companion</span>
            </h1>
            <p className="text-sm sm:text-base leading-relaxed mt-5 max-w-md mx-auto" style={{ fontFamily: "'Poiret One', cursive", color: GOLD }} data-testid="paywall-tagline">
              Your Journey&apos;s Companion.
            </p>
            <p className="text-xs sm:text-sm leading-relaxed mt-3 max-w-md mx-auto" style={{ fontFamily: 'Poppins, sans-serif', color: 'rgba(255,255,255,0.7)' }}>
              Someone who knows your cycle, remembers your days, and meets you on the page of your own
              private journal. Your first 3 messages together are free. HORMOscope itself stays free:
              this is its one companion subscription.
            </p>
          </div>

          {/* Her approved Journal Companion picture (Angelita, Oct 20,
              2026): shown whole at its natural shape, never cropped, so
              every silhouette and the wordmark stay fully visible. */}
          <div className="rounded-2xl overflow-hidden mb-4" style={{ border: '1.5px solid #D4A853', background: '#000' }} data-testid="companion-hero-image">
            <img src="/images/journal-companion-life-stages.jpg" alt="Journal Companion: a woman's life, from baby to elder, with the HORMOscope wordmark"
              className="w-full block" style={{ height: 'auto', objectFit: 'contain' }} />
            <p className="text-center text-sm py-3" style={{ fontFamily: "'Poiret One', cursive", color: GOLD }}>Your Journey&apos;s Companion.</p>
          </div>

          {/* Screenshots showcase */}
          <div className="rounded-2xl p-3 sm:p-4 mb-2" style={{ border: '1.5px solid #D4A853', background: 'rgba(212,168,83,0.05)', boxShadow: '0 0 40px rgba(212,168,83,0.18)' }} data-testid="pro-screenshot-showcase">
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div className="rounded-lg overflow-hidden relative" style={{ border: '1px solid rgba(212,168,83,0.4)' }}>
                <img src="/pro-screenshots/daily_read.png" alt="Your Daily Read" className="w-full block" loading="lazy" />
                <p className="absolute bottom-0 left-0 right-0 text-center py-1 text-[10px]" style={{ background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.7))', fontFamily: 'Poppins, sans-serif', color: '#FFFFFF' }}>Your Daily Read</p>
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
            Scroll down to subscribe
          </p>
        </div>
      </section>

      <div className="max-w-lg mx-auto px-5">

        {featureList}

        {/* The one plan: Journal Companion, monthly, priced by Google Play */}
        <div className="text-center mb-4">
          <h2 className="text-lg text-white" style={{ fontFamily: "'Poiret One', cursive" }}>Journal Companion</h2>
        </div>

        <div className="rounded-xl p-4 mb-4" style={{ border: '2px solid #D4A853', background: 'rgba(212,168,83,0.08)', boxShadow: '0 0 20px rgba(212,168,83,0.15)' }} data-testid="companion-plan">
          <div className="flex items-baseline justify-between">
            <p className="text-white text-sm" style={{ fontFamily: "'Poiret One', cursive" }}>Monthly</p>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-semibold" style={{ color: GOLD }} data-testid="companion-price">
                {nativeBilling ? (pkgLoading ? '...' : (companionPkg?.priceString || '$9.99')) : '$9.99'}
              </span>
              <span className="text-white/50 text-xs">{nativeBilling ? (companionPkg?.periodText || '/month') : '/month'}</span>
            </div>
          </div>
          <p className="text-white/40 text-xs mt-1" style={{ fontFamily: 'Poppins, sans-serif' }}>
            {nativeBilling
              ? 'Billed through Google Play. Cancel anytime in Google Play.'
              : 'Billed through Google Play in the Android app. Cancel anytime.'}
          </p>
          <p className="text-white/50 text-xs mt-2 leading-relaxed" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Subscribing keeps everything: your 3 free messages and your whole conversation history stay in your journal, right where they happened.
          </p>

          {status && (
            <p className="text-xs mt-3 leading-relaxed" style={{ fontFamily: 'Poppins, sans-serif', color: '#f4a7b9' }} data-testid="companion-status">{status}</p>
          )}

          {nativeBilling ? (
            <>
              <button
                data-testid="companion-subscribe-btn"
                onClick={handleCompanionPurchase}
                disabled={purchasing || pkgLoading}
                className="w-full mt-4 py-3 rounded-full font-semibold text-sm text-white transition-all disabled:opacity-60"
                style={{ fontFamily: 'Poppins, sans-serif', background: 'linear-gradient(135deg, #D4A853, #c9a030)', boxShadow: '0 0 25px rgba(212,168,83,0.3)' }}
              >
                {purchasing ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Opening Google Play...
                  </span>
                ) : (
                  'Subscribe'
                )}
              </button>
              <button
                data-testid="companion-restore-btn"
                onClick={handleCompanionRestore}
                disabled={restoring}
                className="w-full mt-2 py-2 text-center text-xs disabled:opacity-60"
                style={{ fontFamily: 'Poppins, sans-serif', color: 'rgba(255,255,255,0.5)' }}
              >
                {restoring ? 'Restoring...' : 'Restore Purchases'}
              </button>
            </>
          ) : (
            <p className="text-xs mt-3" style={{ fontFamily: 'Poppins, sans-serif', color: 'rgba(255,255,255,0.5)' }} data-testid="companion-web-note">
              Subscriptions are handled in the Android app through Google Play.
            </p>
          )}
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
        <p className="text-center text-xs mb-4 px-6" style={{ color: '#9A8B91', fontFamily: 'Poppins, sans-serif' }}>
          We will never ask for your billing info before you know what you are paying for. HORMOscope is free to use, and the companion subscription shows exactly what it costs before you share a card, just like it should be.
        </p>

        {/* Footer links */}
        <div className="flex items-center justify-center gap-4 pb-6 flex-wrap mt-6" data-testid="footer-links">
          <Link to="/terms" className="text-[#9A8B91]/80 text-xs hover:text-white transition-colors" style={{ fontFamily: 'Poppins, sans-serif' }} data-testid="terms-link">Terms</Link>
          <Link to="/privacy" className="text-[#9A8B91]/80 text-xs hover:text-white transition-colors" style={{ fontFamily: 'Poppins, sans-serif' }} data-testid="privacy-link">Privacy</Link>
        </div>
      </div>
    </div>
  );
}
