import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePremium } from '../context/PremiumContext';
import { Droplet } from 'lucide-react';
import axios from 'axios';
import DailyRhythmReport from '../components/DailyRhythmReport';
import HormoneMap from '../components/HormoneMap';
import ProUpsellBanner from '../components/ProUpsellBanner';
import DailyRead from '../components/DailyRead';
import logger from '../utils/logger';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const phases = {
  menstrual: { orb: 'orb-menstrual', color: '#ff6b6b', name: 'Menstrual Phase' },
  follicular: { orb: 'orb-follicular', color: '#74b9ff', name: 'Follicular Phase' },
  ovulatory: { orb: 'orb-ovulatory', color: '#55efc4', name: 'Ovulatory Phase' },
  luteal: { orb: 'orb-luteal', color: '#a29bfe', name: 'Luteal Phase' },
  late: { orb: 'orb-menstrual', color: '#ff6b6b', name: 'Period Expected' },
  unknown: { orb: 'orb-follicular', color: '#74b9ff', name: 'Setup Required' }
};

export default function HomePage() {
  const { user, token } = useAuth();
  const { isPro, refreshCustomerInfo } = usePremium();
  const [data, setData] = useState(null);
  const [rhythmData, setRhythmData] = useState(null);
  const [hormoneData, setHormoneData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paymentBanner, setPaymentBanner] = useState(null); // 'pending' | 'success' | 'failed'

  // Stripe redirect — poll for payment status if ?stripe_session_id is present
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sid = params.get('stripe_session_id');
    if (!sid || !token) return;
    setPaymentBanner('pending');
    let attempts = 0;
    const maxAttempts = 8;
    const interval = setInterval(async () => {
      attempts += 1;
      try {
        const res = await axios.get(`${API}/payments/v1/checkout/status/${sid}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.data?.payment_status === 'paid') {
          clearInterval(interval);
          setPaymentBanner('success');
          await refreshCustomerInfo();
          // Clean the URL
          window.history.replaceState({}, '', '/');
        } else if (res.data?.status === 'expired' || attempts >= maxAttempts) {
          clearInterval(interval);
          setPaymentBanner('failed');
        }
      } catch (err) {
        if (attempts >= maxAttempts) {
          clearInterval(interval);
          setPaymentBanner('failed');
        }
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [token, refreshCustomerInfo]);

  const fetchData = useCallback(async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [dashRes, rhythmRes, hormoneRes] = await Promise.all([
        axios.get(`${API}/dashboard`, { headers }),
        axios.get(`${API}/premium/daily-rhythm`, { headers }).catch(() => null),
        axios.get(`${API}/premium/hormone-map`, { headers }).catch(() => null),
      ]);
      setData(dashRes.data);
      if (rhythmRes) setRhythmData(rhythmRes.data);
      if (hormoneRes) setHormoneData(hormoneRes.data);
    } catch (err) {
      logger.error(err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  /* eslint-disable */
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  /* eslint-enable */

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="cycle-orb orb-follicular w-16 h-16" />
      </div>
    );
  }

  const phase = data?.cycle_info?.phase || 'unknown';
  const config = phases[phase] || phases.unknown;
  const cycle = data?.cycle_info || {};
  const mood = data?.mood_prediction || {};
  const periodIsLate = cycle.period_is_late || false;
  const daysLate = cycle.days_late || 0;

  return (
    <div className="min-h-screen pb-28 lg:pb-8 lg:pl-64 px-5 pt-8">
      
      {/* Header */}
      <div className="text-center mb-8">
        <p className="text-[#6c6c8a] text-xs tracking-widest uppercase mb-2">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
        <h1 className="text-3xl text-white mb-3 font-script">
          Hello, {data?.user_name || 'Beautiful'}
        </h1>
      </div>

      {/* Stripe payment banner */}
      {paymentBanner && (
        <div className={`card p-4 mb-6 border ${paymentBanner === 'success' ? 'border-[#D4A853]/40 bg-[#D4A853]/10' : paymentBanner === 'failed' ? 'border-[#ff6b6b]/30 bg-[#ff6b6b]/5' : 'border-white/20 bg-white/5'}`} data-testid={`payment-banner-${paymentBanner}`}>
          <p className="text-sm text-white">
            {paymentBanner === 'pending' && 'Confirming your payment with Stripe…'}
            {paymentBanner === 'success' && '✨ Welcome to HORMOscope Pro! Your subscription is active.'}
            {paymentBanner === 'failed' && 'We couldn\'t confirm your payment yet. If you completed checkout, refresh in a minute — your Pro access will activate automatically.'}
          </p>
        </div>
      )}

      {/* Period Late Info - Simple message */}
      {periodIsLate && (
        <div className="card p-4 mb-6 border border-[#ff6b6b]/30 bg-[#ff6b6b]/5">
          <div className="flex items-center gap-3">
            <Droplet className="w-5 h-5 text-[#ff6b6b] flex-shrink-0" fill="#ff6b6b" />
            <p className="text-[#b8b8d1] text-sm">
              {daysLate === 0
                ? <>Period expected today • <span className="text-[#ff6b6b]">Reset in Calendar tab when it starts</span></>
                : <>Period {daysLate} day{daysLate !== 1 ? 's' : ''} late • <span className="text-[#ff6b6b]">Reset in Calendar tab when it starts</span></>
              }
            </p>
          </div>
        </div>
      )}

      {/* Cycle Orb */}
      <div className="flex flex-col items-center mb-10">
        <div className={`cycle-orb ${config.orb}`}>
          <span className="text-white/90 text-sm tracking-widest uppercase font-semibold">
            {periodIsLate ? 'CYCLE DAY' : 'YOU ARE ON DAY'}
          </span>
          <span className="text-7xl font-bold text-white">{cycle.cycle_day || '?'}</span>
        </div>
        <h2 className="mt-6 text-2xl font-script" style={{ color: config.color }}>
          {config.name}
        </h2>
        <p className="text-[#b8b8d1] text-sm mt-1">
          {periodIsLate 
            ? `Expected ${cycle.cycle_length}-day cycle` 
            : cycle.days_until_period > 0 
              ? `${cycle.days_until_period} days until next period` 
              : ''
          }
        </p>
      </div>

      {/* Mood Card */}
      <div className="card card-pink p-5 mb-4">
        <div className="flex justify-between items-start mb-3">
          <div>
            <p className="text-[#6c6c8a] text-[10px] tracking-widest uppercase mb-1">TODAY&apos;S MOOD</p>
            <h3 className="text-white text-xl font-script">{mood.mood || 'Unknown'}</h3>
          </div>
        </div>
        <p className="text-[#b8b8d1] text-sm leading-relaxed">{mood.emotional_state}</p>
        {mood.relationship_advice && (
          <p className="text-[#ff8fab] text-xs mt-3 pt-3 border-t border-white/10">
            {mood.relationship_advice}
          </p>
        )}
      </div>

      {/* Your Daily Read — Pro */}
      {isPro && (
        <div className="mb-4">
          <DailyRead />
        </div>
      )}

      {/* Daily Rhythm Report — Premium */}
      {isPro && rhythmData?.rhythm && (
        <div className="mb-4">
          <DailyRhythmReport
            rhythm={rhythmData.rhythm}
            phase={rhythmData.phase}
            cycleDay={rhythmData.cycle_day}
          />
        </div>
      )}

      {/* Hormone Map — Premium */}
      {isPro && hormoneData?.data && (
        <div className="mb-4">
          <HormoneMap
            data={hormoneData.data}
            cycleDay={hormoneData.cycle_day}
            cycleLength={hormoneData.cycle_length}
            phase={hormoneData.phase}
          />
        </div>
      )}

      {/* Subtle upgrade hint for free users — ONE small card, not a giant paywall */}
      {!isPro && (
        <div className="mb-4">
          <ProUpsellBanner context="dashboard" compact />
        </div>
      )}

      {/* Cycle Phases */}
      <div className="card p-5 mb-4">
        <p className="text-[#6c6c8a] text-[10px] tracking-widest uppercase mb-4">YOUR CYCLE PHASES</p>
        <div className="space-y-3">
          <div className={`flex items-center gap-3 p-3 rounded-xl ${phase === 'menstrual' ? 'bg-[#ff6b6b]/20 border border-[#ff6b6b]/40' : 'bg-white/5'}`}>
            <div className="w-3 h-3 rounded-full bg-[#ff6b6b]" />
            <div className="flex-1">
              <p className={`text-sm font-medium ${phase === 'menstrual' ? 'text-[#ff6b6b]' : 'text-white/70'}`}>Menstrual Phase</p>
              <p className="text-[#6c6c8a] text-xs">Days 1-5 • Rest & renewal</p>
            </div>
            {phase === 'menstrual' && <span className="text-[#ff6b6b] text-xs font-medium">NOW</span>}
          </div>
          <div className={`flex items-center gap-3 p-3 rounded-xl ${phase === 'follicular' ? 'bg-[#74b9ff]/20 border border-[#74b9ff]/40' : 'bg-white/5'}`}>
            <div className="w-3 h-3 rounded-full bg-[#74b9ff]" />
            <div className="flex-1">
              <p className={`text-sm font-medium ${phase === 'follicular' ? 'text-[#74b9ff]' : 'text-white/70'}`}>Follicular Phase</p>
              <p className="text-[#6c6c8a] text-xs">Days 6-12 • Rising energy</p>
            </div>
            {phase === 'follicular' && <span className="text-[#74b9ff] text-xs font-medium">NOW</span>}
          </div>
          <div className={`flex items-center gap-3 p-3 rounded-xl ${phase === 'ovulatory' ? 'bg-[#55efc4]/20 border border-[#55efc4]/40' : 'bg-white/5'}`}>
            <div className="w-3 h-3 rounded-full bg-[#55efc4]" />
            <div className="flex-1">
              <p className={`text-sm font-medium ${phase === 'ovulatory' ? 'text-[#55efc4]' : 'text-white/70'}`}>Ovulatory Phase</p>
              <p className="text-[#6c6c8a] text-xs">Days 13-19 • Peak confidence</p>
            </div>
            {phase === 'ovulatory' && <span className="text-[#55efc4] text-xs font-medium">NOW</span>}
          </div>
          <div className={`flex items-center gap-3 p-3 rounded-xl ${phase === 'luteal' ? 'bg-[#a29bfe]/20 border border-[#a29bfe]/40' : 'bg-white/5'}`}>
            <div className="w-3 h-3 rounded-full bg-[#a29bfe]" />
            <div className="flex-1">
              <p className={`text-sm font-medium ${phase === 'luteal' ? 'text-[#a29bfe]' : 'text-white/70'}`}>Luteal Phase</p>
              <p className="text-[#6c6c8a] text-xs">Days 20+ • Slow down</p>
            </div>
            {phase === 'luteal' && <span className="text-[#a29bfe] text-xs font-medium">NOW</span>}
          </div>
          {/* Period Expected - shows when late */}
          {periodIsLate && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-[#ff6b6b]/20 border border-[#ff6b6b]/40 animate-pulse">
              <div className="w-3 h-3 rounded-full bg-[#ff6b6b]" />
              <div className="flex-1">
                <p className="text-sm font-medium text-[#ff6b6b]">Period Expected</p>
                <p className="text-[#6c6c8a] text-xs">Waiting for your period to start</p>
              </div>
              <span className="text-[#ff6b6b] text-xs font-medium">WAITING</span>
            </div>
          )}
        </div>
      </div>

      {/* Affirmation */}
      <div className="card p-5 mb-4">
        <p className="text-[#6c6c8a] text-[10px] tracking-widest uppercase mb-3">TODAY&apos;S AFFIRMATION</p>
        <p className="text-white text-base italic leading-relaxed">&ldquo;{data?.affirmation}&rdquo;</p>
      </div>

      {/* Do / Avoid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="card p-4">
          <p className="text-[#55efc4] text-[10px] tracking-widest uppercase mb-3">DO TODAY</p>
          <div className="space-y-2">
            {(mood.best_activities || []).slice(0, 3).map((act) => (
              <p key={`do-${act}`} className="text-[#b8b8d1] text-xs">• {act}</p>
            ))}
          </div>
        </div>
        <div className="card p-4">
          <p className="text-[#ff6b6b] text-[10px] tracking-widest uppercase mb-3">AVOID</p>
          <div className="space-y-2">
            {(mood.avoid_activities || []).slice(0, 3).map((act) => (
              <p key={`avoid-${act}`} className="text-[#b8b8d1] text-xs">• {act}</p>
            ))}
          </div>
        </div>
      </div>

      {/* Nutrition - Eat & Avoid */}
      <div className="card p-5 mb-4">
        <p className="text-[#6c6c8a] text-[10px] tracking-widest uppercase mb-3">NUTRITION</p>
        <p className="text-[#b8b8d1] text-sm mb-4">{data?.nutrition_tip}</p>
        
        {/* Eat Section */}
        <div className="mb-4">
          <p className="text-[#55efc4] text-[10px] tracking-widest uppercase mb-2">🥗 EAT</p>
          <div className="flex flex-wrap gap-2">
            {(data?.foods_to_eat || []).map((food) => (
              <span key={`eat-${food}`} className="tag tag-green">{food}</span>
            ))}
          </div>
        </div>
        
        {/* Avoid Section */}
        <div>
          <p className="text-[#ff6b6b] text-[10px] tracking-widest uppercase mb-2">🚫 AVOID</p>
          <div className="flex flex-wrap gap-2">
            {(data?.foods_to_avoid || []).map((food) => (
              <span key={`avoid-food-${food}`} className="tag tag-red">{food}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Wellness Tip */}
      <div className="card p-5">
        <p className="text-[#6c6c8a] text-[10px] tracking-widest uppercase mb-3">WELLNESS TIP</p>
        <p className="text-[#b8b8d1] text-sm leading-relaxed">{data?.wellness_tip}</p>
      </div>

    </div>
  );
}
