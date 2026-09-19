import React from 'react';
import { Sun, Brain, Target, Dumbbell, BedDouble, Heart, Flame, ShieldAlert } from 'lucide-react';

const ICONS = {
  energy: Sun,
  mood: Heart,
  focus: Target,
  movement: Dumbbell,
  recovery: BedDouble,
  self_care: Flame,
  libido: Brain,
  pain: ShieldAlert,
};

const LABELS = {
  energy: 'Energy',
  mood: 'Mood',
  focus: 'Focus',
  movement: 'Movement',
  recovery: 'Recovery',
  self_care: 'Self-Care',
  libido: 'Libido',
  pain: 'Pain Threshold',
};

const BAR_COLORS = {
  energy: '#f4a7b9',
  mood: '#c9b8f0',
  focus: '#74b9ff',
  movement: '#55efc4',
  recovery: '#a29bfe',
  self_care: '#f4a7b9',
  libido: '#ff8fab',
  pain: '#ff6b6b',
};

const PHASE_COLORS = {
  menstrual: '#ff6b6b',
  follicular: '#74b9ff',
  ovulatory: '#55efc4',
  luteal: '#a29bfe',
  late: '#ff6b6b',
};

const PHASE_LABELS = {
  menstrual: 'Menstrual',
  follicular: 'Follicular',
  ovulatory: 'Ovulatory',
  luteal: 'Luteal',
  late: 'Period Expected',
};

export default function DailyRhythmReport({ rhythm, phase, cycleDay }) {
  if (!rhythm) return null;

  const phaseColor = PHASE_COLORS[phase] || '#c9b8f0';
  const categories = ['energy', 'mood', 'focus', 'movement', 'recovery', 'self_care', 'libido', 'pain'];

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1.5px solid #D4A853', background: 'linear-gradient(135deg, rgba(212,168,83,0.10) 0%, rgba(212,168,83,0.03) 100%)' }} data-testid="daily-rhythm-report">
      <div className="px-3 pt-2.5 pb-0.5 flex items-center gap-1.5">
        <span style={{ color: '#D4A853', fontSize: '9px' }}>✿</span>
        <span className="text-[10px]" style={{ fontFamily: "'Poiret One', cursive", color: '#D4A853' }}>HORMOscope Pro</span>
        <span style={{ color: '#D4A853', fontSize: '9px' }}>✿</span>
      </div>
      <div className="text-center pt-1 pb-1">
        <h3 className="text-sm" style={{ fontFamily: "'Poiret One', cursive", color: '#FF1493' }}>Daily Rhythm Report</h3>
        <p className="text-white/50 text-[9px]" style={{ fontFamily: 'Poppins, sans-serif' }}>Day {cycleDay} — {PHASE_LABELS[phase] || 'Unknown'}</p>
      </div>
      <div className="px-3 pb-2">
        <p className="text-[#b8a8be] text-[10px] leading-relaxed" style={{ fontFamily: 'Poppins, sans-serif' }} data-testid="rhythm-summary">
          {rhythm.summary}
        </p>
      </div>

      <div className="px-3 pb-3 space-y-2">
        {categories.map((key) => {
          const item = rhythm[key];
          if (!item) return null;
          const Icon = ICONS[key];
          const color = BAR_COLORS[key];
          return (
            <div key={key} data-testid={`rhythm-${key}`}>
              <div className="flex items-center justify-between mb-0.5">
                <div className="flex items-center gap-1.5">
                  <Icon className="w-3 h-3" style={{ color }} />
                  <span className="text-white/80 text-[10px]" style={{ fontFamily: 'Poppins, sans-serif' }}>{LABELS[key]}</span>
                </div>
                <span className="text-[10px]" style={{ fontFamily: 'Poppins, sans-serif', color }}>{item.level}</span>
              </div>
              <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${item.score}%`, background: color, opacity: 0.8 }} />
              </div>
              <p className="text-[#9A8B91] text-[9px] mt-0.5 leading-relaxed" style={{ fontFamily: 'Poppins, sans-serif' }}>{item.tip}</p>
            </div>
          );
        })}
      </div>
      <div className="px-3 pb-2 border-t border-white/[0.05] pt-1.5">
        <p className="text-[#6c6c8a] text-[8px]" style={{ fontFamily: 'Poppins, sans-serif' }}>Based on typical cycle patterns. Not medical advice.</p>
      </div>
    </div>
  );
}
