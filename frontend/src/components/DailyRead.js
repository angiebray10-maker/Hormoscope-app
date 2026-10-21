import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { BookOpen, Utensils, Dumbbell, Heart, Sparkles, Loader2 } from 'lucide-react';
import axios from 'axios';
import { purchaseCompanion, restoreCompanion } from '../utils/revenueCat';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PHASE_ACCENTS = {
  menstrual: '#D4A853',
  follicular: '#D4A853',
  ovulatory: '#D4A853',
  luteal: '#D4A853',
  late: '#D4A853',
  unknown: '#D4A853',
};

const SECTION_ICONS = {
  body_insight: { icon: Sparkles, label: 'Your Body Right Now' },
  mood_forecast: { icon: Heart, label: 'Mood Forecast' },
  food: { icon: Utensils, label: 'Eat This Today' },
  movement: { icon: Dumbbell, label: 'Movement' },
  self_care: { icon: BookOpen, label: 'Tonight\'s Ritual' },
};

export default function DailyRead() {
  const { user, token } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [subBusy, setSubBusy] = useState('');
  const [subMsg, setSubMsg] = useState('');

  const fetchRead = async () => {
    try {
      const res = await axios.get(`${API}/premium/daily-read`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(res.data);
    } catch (err) {
      console.error('Daily read error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchRead();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Subscribing from the locked full read (Angelita, Oct 21, 2026):
  // the same Journal Companion product and Google Play purchase as
  // the Journal. When it lands, the read reloads unlocked.
  const refreshAfterPurchase = async () => {
    try {
      await axios.get(`${API}/journal/companion`, { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 });
    } catch (e) { /* best-effort entitlement sync */ }
    await fetchRead();
  };

  const handleSubscribe = async () => {
    if (subBusy) return;
    setSubBusy('buy');
    setSubMsg('');
    try {
      const res = await purchaseCompanion(user?.id);
      if (res?.status === 'active') {
        await refreshAfterPurchase();
        setSubMsg('You are subscribed. Your full read is open.');
      } else if (res?.status === 'pending') {
        setSubMsg('Google Play is finishing your purchase. If it does not complete in a moment, tap Restore Purchase.');
      } else if (res?.status === 'cancelled') {
        setSubMsg('No charge was made.');
      } else {
        setSubMsg(res?.message || 'The subscription is not available right now.');
      }
    } catch (err) {
      setSubMsg('Something went wrong starting the purchase. Nothing was charged.');
    } finally { setSubBusy(''); }
  };

  const handleRestore = async () => {
    if (subBusy) return;
    setSubBusy('restore');
    setSubMsg('');
    try {
      const res = await restoreCompanion();
      if (res?.status === 'active') {
        await refreshAfterPurchase();
        setSubMsg('Your subscription is restored. Your full read is open.');
      } else if (res?.status === 'none') {
        setSubMsg('No subscription was found for this account.');
      } else {
        setSubMsg(res?.message || 'Restore could not be completed.');
      }
    } catch (err) {
      setSubMsg('Restore could not be completed. Nothing was changed.');
    } finally { setSubBusy(''); }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-8 flex items-center justify-center" data-testid="daily-read-loading">
        <Loader2 className="w-5 h-5 text-[#c9b8f0] animate-spin" />
        <span className="ml-2 text-[#9A8B91] text-xs" style={{ fontFamily: 'Poppins, sans-serif' }}>Generating your reading...</span>
      </div>
    );
  }

  if (!data?.reading) return null;

  const reading = data.reading;
  const accent = PHASE_ACCENTS[data.phase] || '#c9b8f0';
  const sections = ['body_insight', 'mood_forecast', 'food', 'movement', 'self_care'];

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1.5px solid #D4A853', background: 'linear-gradient(135deg, rgba(212,168,83,0.10) 0%, rgba(212,168,83,0.03) 100%)' }} data-testid="daily-read">
      <div className="px-3 pt-2.5 pb-0.5 flex items-center gap-1.5">
        <span style={{ color: '#D4A853', fontSize: '9px' }}>✿</span>
        <span className="text-[10px]" style={{ fontFamily: "'Poiret One', cursive", color: '#D4A853' }}>HORMOscope</span>
        <span style={{ color: '#D4A853', fontSize: '9px' }}>✿</span>
      </div>
      <div className="text-center pt-1 pb-1">
        <h3 className="text-sm" style={{ fontFamily: "'Poiret One', cursive", color: '#FF1493' }}>Your Daily Read</h3>
        <p className="text-white/50 text-[9px]" style={{ fontFamily: 'Poppins, sans-serif' }}>Day {data.cycle_day}</p>
      </div>
      <div className="px-3 pb-2">
        <p className="text-white text-[11px] leading-relaxed" style={{ fontFamily: 'Poppins, sans-serif' }} data-testid="daily-read-greeting">
          {reading.greeting}
        </p>
      </div>

      {/* Body insight — always visible */}
      <div className="px-3 py-2">
        <div className="flex items-center gap-1.5 mb-1">
          <Sparkles className="w-3 h-3" style={{ color: '#D4A853' }} />
          <span className="text-white/70 text-[9px] tracking-widest uppercase" style={{ fontFamily: 'Poppins, sans-serif' }}>Your Body Right Now</span>
        </div>
        <p className="text-[#d4d4e0] text-[11px] leading-relaxed" style={{ fontFamily: 'Poppins, sans-serif' }}>
          {reading.body_insight}
        </p>
      </div>

      {/* Expandable sections */}
      {expanded && !data?.locked && sections.slice(1).map((key) => {
        const config = SECTION_ICONS[key];
        if (!config || !reading[key]) return null;
        const Icon = config.icon;
        return (
          <div key={key} className="px-3 py-2 border-t border-white/[0.05]" data-testid={`daily-read-${key}`}>
            <div className="flex items-center gap-1.5 mb-1">
              <Icon className="w-3 h-3" style={{ color: '#D4A853' }} />
              <span className="text-white/70 text-[9px] tracking-widest uppercase" style={{ fontFamily: 'Poppins, sans-serif' }}>{config.label}</span>
            </div>
            <p className="text-[#d4d4e0] text-[11px] leading-relaxed" style={{ fontFamily: 'Poppins, sans-serif' }}>
              {reading[key]}
            </p>
          </div>
        );
      })}

      {/* Affirmation — always visible when expanded */}
      {expanded && !data?.locked && reading.affirmation && (
        <div className="px-3 py-2 border-t border-white/[0.05]" style={{ background: `${accent}08` }}>
          <p className="text-[11px] text-center leading-relaxed" style={{ color: accent, fontFamily: 'Poppins, sans-serif' }} data-testid="daily-read-affirmation">
            {reading.affirmation}
          </p>
        </div>
      )}

      {expanded && data?.locked && (
        <div className="px-3 py-3 border-t border-white/[0.05]" data-testid="daily-read-offer">
          <p className="text-[#d4d4e0] text-[11px] leading-relaxed mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
            The full read, your mood forecast, what to eat today, how to move, and tonight's ritual, comes with your Journal Companion.
          </p>
          <p className="text-[10px] mb-3" style={{ fontFamily: 'Poppins, sans-serif', color: 'rgba(255,255,255,0.55)' }}>
            Journal Companion: $9.99/month through Google Play. Cancel anytime.
          </p>
          <button onClick={handleSubscribe} disabled={!!subBusy} className="block w-full py-2.5 rounded-full text-white text-xs font-medium disabled:opacity-50" style={{ fontFamily: 'Poppins, sans-serif', background: '#FF1493' }} data-testid="daily-read-subscribe-btn">
            {subBusy === 'buy' ? 'Opening Google Play...' : 'Subscribe'}
          </button>
          <button onClick={handleRestore} disabled={!!subBusy} className="block w-full mt-2 py-1.5 text-center text-[11px] disabled:opacity-50" style={{ fontFamily: 'Poppins, sans-serif', color: 'rgba(255,255,255,0.55)' }} data-testid="daily-read-restore-btn">
            {subBusy === 'restore' ? 'Restoring...' : 'Restore Purchase'}
          </button>
          {subMsg && (
            <p className="text-[11px] mt-2" style={{ fontFamily: 'Poppins, sans-serif', color: '#c9b8f0' }} data-testid="daily-read-sub-msg">{subMsg}</p>
          )}
        </div>
      )}

      <button onClick={() => setExpanded(!expanded)} className="w-full py-1.5 text-[10px] text-center" style={{ color: accent, fontFamily: 'Poppins, sans-serif', borderTop: '1px solid rgba(255,255,255,0.05)' }} data-testid="daily-read-toggle">
        {expanded ? 'Show less' : 'Read full reading'}
      </button>
      <div className="px-3 pb-1.5">
        <p className="text-[#6c6c8a] text-[8px] text-center" style={{ fontFamily: 'Poppins, sans-serif' }}>
          Personalized to your cycle. Not medical advice.
        </p>
      </div>
    </div>
  );
}
