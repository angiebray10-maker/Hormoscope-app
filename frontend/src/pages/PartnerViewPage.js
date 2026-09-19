import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Heart, Sun, Brain, Shield, Loader2 } from 'lucide-react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PHASE_COLORS = {
  menstrual: '#ff6b6b',
  follicular: '#74b9ff',
  ovulatory: '#55efc4',
  luteal: '#a29bfe',
  late: '#ff6b6b',
  unknown: '#74b9ff',
};

const PHASE_NAMES = {
  menstrual: 'Menstrual Phase',
  follicular: 'Follicular Phase',
  ovulatory: 'Ovulatory Phase',
  luteal: 'Luteal Phase',
  late: 'Period Expected',
  unknown: 'Unknown',
};

export default function PartnerViewPage() {
  const { linkCode } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await axios.get(`${API}/partner/view/${linkCode}`);
        setData(res.data);
      } catch (err) {
        setError(err.response?.status === 404 ? 'This link is no longer active.' : 'Something went wrong.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [linkCode]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0a1a' }}>
        <Loader2 className="w-8 h-8 text-[#c9b8f0] animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ background: '#0a0a1a' }}>
        <div className="text-center">
          <Heart className="w-12 h-12 text-[#f4a7b9] mx-auto mb-4" />
          <h1 className="text-2xl text-white mb-2" style={{ fontFamily: "'Poiret One', cursive" }}>Link Not Found</h1>
          <p className="text-[#9A8B91] text-sm" style={{ fontFamily: 'Poppins, sans-serif' }}>{error}</p>
        </div>
      </div>
    );
  }

  const phaseColor = PHASE_COLORS[data.phase] || '#c9b8f0';
  const tips = data.partner_tips;

  return (
    <div className="min-h-screen px-5 py-8 pb-16" style={{ background: '#0a0a1a' }} data-testid="partner-view">
      <div className="max-w-md mx-auto">

        {/* Header */}
        <div className="text-center mb-8">
          <p className="text-[10px] tracking-widest uppercase mb-2" style={{ fontFamily: 'Poppins, sans-serif', color: '#f4a7b9' }}>
            Attuned Partner Mode
          </p>
          <h1 className="text-2xl text-white mb-1" style={{ fontFamily: "'Poiret One', cursive" }}>
            {data.name}'s Cycle
          </h1>
          <p className="text-[#9A8B91] text-xs" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Updated in real time
          </p>
        </div>

        {/* Cycle Day Orb */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-32 h-32 rounded-full flex flex-col items-center justify-center" style={{ background: `linear-gradient(135deg, ${phaseColor}40, ${phaseColor}20)`, boxShadow: `0 0 40px ${phaseColor}30` }}>
            <span className="text-white/70 text-[10px] tracking-widest uppercase" style={{ fontFamily: 'Poppins, sans-serif' }}>Day</span>
            <span className="text-5xl font-bold text-white">{data.cycle_day}</span>
          </div>
          <h2 className="mt-4 text-xl" style={{ fontFamily: "'Poiret One', cursive", color: phaseColor }}>
            {PHASE_NAMES[data.phase]}
          </h2>
        </div>

        {/* Headline */}
        <div className="rounded-2xl p-5 mb-4 text-center" style={{ background: `${phaseColor}10`, border: `1px solid ${phaseColor}25` }}>
          <p className="text-white text-base font-medium" style={{ fontFamily: 'Poppins, sans-serif' }}>{tips.headline}</p>
        </div>

        {/* Energy & Mood */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="rounded-2xl p-4 border border-white/[0.06] bg-white/[0.03]">
            <div className="flex items-center gap-2 mb-2">
              <Sun className="w-4 h-4 text-[#f4a7b9]" />
              <span className="text-[#9A8B91] text-xs" style={{ fontFamily: 'Poppins, sans-serif' }}>Energy</span>
            </div>
            <p className="text-white text-sm font-medium" style={{ fontFamily: 'Poppins, sans-serif' }}>{data.energy}</p>
            <div className="h-1.5 rounded-full bg-white/[0.06] mt-2 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${data.energy_score}%`, background: '#f4a7b9', opacity: 0.7 }} />
            </div>
          </div>
          <div className="rounded-2xl p-4 border border-white/[0.06] bg-white/[0.03]">
            <div className="flex items-center gap-2 mb-2">
              <Brain className="w-4 h-4 text-[#c9b8f0]" />
              <span className="text-[#9A8B91] text-xs" style={{ fontFamily: 'Poppins, sans-serif' }}>Mood</span>
            </div>
            <p className="text-white text-sm font-medium" style={{ fontFamily: 'Poppins, sans-serif' }}>{data.mood}</p>
            <div className="h-1.5 rounded-full bg-white/[0.06] mt-2 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${data.mood_score}%`, background: '#c9b8f0', opacity: 0.7 }} />
            </div>
          </div>
        </div>

        {/* Conversation Tip */}
        <div className="rounded-2xl p-5 mb-4 border border-white/[0.06] bg-white/[0.03]">
          <p className="text-[10px] tracking-widest uppercase mb-2" style={{ fontFamily: 'Poppins, sans-serif', color: '#f4a7b9' }}>Conversation</p>
          <p className="text-white text-sm leading-relaxed" style={{ fontFamily: 'Poppins, sans-serif' }}>{tips.conversation}</p>
        </div>

        {/* Do & Don't */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <div className="rounded-2xl p-5 border border-white/[0.06] bg-white/[0.03]">
            <p className="text-[10px] tracking-widest uppercase mb-3" style={{ fontFamily: 'Poppins, sans-serif', color: '#55efc4' }}>Do</p>
            <div className="space-y-2">
              {tips.do.map((item) => (
                <p key={`do-${item}`} className="text-[#d4d4e0] text-xs leading-relaxed" style={{ fontFamily: 'Poppins, sans-serif' }}>+ {item}</p>
              ))}
            </div>
          </div>
          <div className="rounded-2xl p-5 border border-white/[0.06] bg-white/[0.03]">
            <p className="text-[10px] tracking-widest uppercase mb-3" style={{ fontFamily: 'Poppins, sans-serif', color: '#ff6b6b' }}>Avoid</p>
            <div className="space-y-2">
              {tips.avoid.map((item) => (
                <p key={`avoid-${item}`} className="text-[#d4d4e0] text-xs leading-relaxed" style={{ fontFamily: 'Poppins, sans-serif' }}>- {item}</p>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-[#6c6c8a] text-[10px] leading-relaxed" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Powered by HORMOscope. Based on typical cycle patterns. Not medical advice.
          </p>
          <div className="flex items-center justify-center gap-1.5 mt-2">
            <Shield className="w-3 h-3 text-[#6c6c8a]" />
            <span className="text-[#6c6c8a] text-[10px]" style={{ fontFamily: 'Poppins, sans-serif' }}>Her data stays private. You only see what she chose to share.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
