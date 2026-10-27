import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { BookOpen, Utensils, Dumbbell, Heart, Flower2, Loader2 } from 'lucide-react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PHASE_ACCENTS = {
  menstrual: '#C9B8F0',
  follicular: '#C9B8F0',
  ovulatory: '#C9B8F0',
  luteal: '#C9B8F0',
  late: '#C9B8F0',
  unknown: '#C9B8F0',
};

const SECTION_ICONS = {
  body_insight: { icon: Flower2, label: 'Your Body Right Now' },
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


  if (loading) {
    return (
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-8 flex items-center justify-center" data-testid="daily-read-loading">
        <Loader2 className="w-5 h-5 text-[#c9b8f0] animate-spin" />
        <span className="ml-2 text-[#CFC3CC] text-xs" style={{ fontFamily: 'Poppins, sans-serif' }}>Generating your reading...</span>
      </div>
    );
  }

  if (!data?.reading) return null;

  const reading = data.reading;
  const accent = PHASE_ACCENTS[data.phase] || '#c9b8f0';
  const sections = ['body_insight', 'mood_forecast', 'food', 'movement', 'self_care'];

  return (
    <div className="relative rounded-xl overflow-hidden" style={{ border: '1.5px solid #C9B8F0', background: 'linear-gradient(135deg, rgba(201,184,240,0.10) 0%, rgba(201,184,240,0.03) 100%)' }} data-testid="daily-read">
      {/* v50 (Angelita, Oct 26, 2026): the life stages line no longer
          sits behind the Daily Read. It belongs to the Journal only. */}
      <div className="relative">
      <div className="px-3 pt-2.5 pb-0.5 flex items-center gap-1.5">
        <span style={{ color: '#C9B8F0', fontSize: '9px' }}>✿</span>
        <span className="text-[10px]" style={{ fontFamily: "'Poiret One', sans-serif", color: '#C9B8F0' }}>HORMOscope</span>
        <span style={{ color: '#C9B8F0', fontSize: '9px' }}>✿</span>
      </div>
      <div className="text-center pt-1 pb-1">
        <h3 className="text-base" style={{ fontFamily: "'Poiret One', sans-serif", color: '#FF4F9A' }}>Your Daily Read</h3>
        <p className="text-white/75 text-[10px]" style={{ fontFamily: 'Poppins, sans-serif' }}>Day {data.cycle_day}</p>
      </div>
      <div className="px-3 pb-2">
        <p className="text-white text-[12px] leading-relaxed" style={{ fontFamily: 'Poppins, sans-serif' }} data-testid="daily-read-greeting">
          {reading.greeting}
        </p>
      </div>

      {/* Body insight — always visible */}
      <div className="px-3 py-2">
        <div className="flex items-center gap-1.5 mb-1">
          <Flower2 className="w-3.5 h-3.5" style={{ color: '#FF4F9A' }} />
          <span className="text-[12px] uppercase" style={{ fontFamily: "'Poiret One', sans-serif", color: '#FF4F9A', letterSpacing: '0.08em' }}>Your Body Right Now</span>
        </div>
        <p className="text-[#d4d4e0] text-[12px] leading-relaxed" style={{ fontFamily: 'Poppins, sans-serif' }}>
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
              <Icon className="w-3.5 h-3.5" style={{ color: '#FF4F9A' }} />
              <span className="text-[12px] uppercase" style={{ fontFamily: "'Poiret One', sans-serif", color: '#FF4F9A', letterSpacing: '0.08em' }}>{config.label}</span>
            </div>
            <p className="text-[#d4d4e0] text-[12px] leading-relaxed" style={{ fontFamily: 'Poppins, sans-serif' }}>
              {reading[key]}
            </p>
          </div>
        );
      })}

      {/* Affirmation — always visible when expanded */}
      {expanded && reading.affirmation && (
        <div className="px-3 py-2 border-t border-white/[0.05]" style={{ background: `${accent}08` }}>
          <p className="text-[12px] text-center leading-relaxed" style={{ color: accent, fontFamily: 'Poppins, sans-serif' }} data-testid="daily-read-affirmation">
            {reading.affirmation}
          </p>
        </div>
      )}

      <button onClick={() => setExpanded(!expanded)} className="w-full py-1.5 text-[10px] text-center" style={{ color: accent, fontFamily: 'Poppins, sans-serif', borderTop: '1px solid rgba(255,255,255,0.05)' }} data-testid="daily-read-toggle">
        {expanded ? 'Show less' : 'Read full reading'}
      </button>
      <div className="px-3 pb-1.5">
        <p className="text-[#B4B0C8] text-[8px] text-center" style={{ fontFamily: 'Poppins, sans-serif' }}>
          Personalized to your cycle. Not medical advice.
        </p>
      </div>
      </div>
    </div>
  );
}
