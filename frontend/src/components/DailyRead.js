import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { BookOpen, Utensils, Dumbbell, Heart, Sparkles, Loader2 } from 'lucide-react';
import axios from 'axios';

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
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const fetch = async () => {
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
    if (token) fetch();
  }, [token]);

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
        <span className="text-[10px]" style={{ fontFamily: "'Poiret One', cursive", color: '#D4A853' }}>HORMOscope Pro</span>
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
      {expanded && sections.slice(1).map((key) => {
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
      {expanded && reading.affirmation && (
        <div className="px-3 py-2 border-t border-white/[0.05]" style={{ background: `${accent}08` }}>
          <p className="text-[11px] text-center leading-relaxed" style={{ color: accent, fontFamily: 'Poppins, sans-serif' }} data-testid="daily-read-affirmation">
            {reading.affirmation}
          </p>
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
