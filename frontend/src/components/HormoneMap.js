import React, { useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
} from 'recharts';

const PHASE_COLORS = {
  Menstrual: '#ff6b6b',
  Follicular: '#74b9ff',
  Ovulatory: '#55efc4',
  Luteal: '#a29bfe',
};

const HORMONE_COLORS = {
  estrogen: '#f4a7b9',
  progesterone: '#a29bfe',
  lh: '#55efc4',
};

// Stable chart config — extracted to module scope to avoid per-render allocations
const CHART_MARGIN = { top: 10, right: 10, left: -20, bottom: 0 };
const AXIS_TICK = { fill: '#6c6c8a', fontSize: 10, fontFamily: 'Poppins, sans-serif' };
const X_AXIS_LINE = { stroke: 'rgba(255,255,255,0.06)' };
const Y_DOMAIN = [0, 100];
const TODAY_LABEL = { value: 'Today', fill: '#fff', fontSize: 10, position: 'top', fontFamily: 'Poppins, sans-serif' };
const ACTIVE_DOT_E = { r: 4, fill: HORMONE_COLORS.estrogen, stroke: '#fff', strokeWidth: 1 };
const ACTIVE_DOT_P = { r: 4, fill: HORMONE_COLORS.progesterone, stroke: '#fff', strokeWidth: 1 };
const ACTIVE_DOT_LH = { r: 4, fill: HORMONE_COLORS.lh, stroke: '#fff', strokeWidth: 1 };

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <div className="rounded-xl px-3 py-2.5 border border-white/10 shadow-xl" style={{ background: 'rgba(20,20,40,0.95)', backdropFilter: 'blur(12px)' }}>
      <p className="text-white text-xs font-medium mb-1" style={{ fontFamily: 'Poppins, sans-serif' }}>
        Day {point.day} — <span style={{ color: PHASE_COLORS[point.phase] }}>{point.phase}</span>
      </p>
      <div className="space-y-0.5">
        <p className="text-[11px]" style={{ color: HORMONE_COLORS.estrogen, fontFamily: 'Poppins, sans-serif' }}>
          Estrogen: {point.estrogen}%
        </p>
        <p className="text-[11px]" style={{ color: HORMONE_COLORS.progesterone, fontFamily: 'Poppins, sans-serif' }}>
          Progesterone: {point.progesterone}%
        </p>
        <p className="text-[11px]" style={{ color: HORMONE_COLORS.lh, fontFamily: 'Poppins, sans-serif' }}>
          LH: {point.lh}%
        </p>
      </div>
    </div>
  );
};

export default function HormoneMap({ data, cycleDay, cycleLength, phase }) {
  const [activeHormone, setActiveHormone] = useState(null);

  if (!data?.length) return null;

  const currentDayData = data.find(d => d.is_current);

  const hormones = [
    { key: 'estrogen', label: 'Estrogen', color: HORMONE_COLORS.estrogen, desc: 'Peaks at ovulation. Drives energy, mood, and skin glow.' },
    { key: 'progesterone', label: 'Progesterone', color: HORMONE_COLORS.progesterone, desc: 'Rises after ovulation. Promotes calm, sleep, and nesting.' },
    { key: 'lh', label: 'LH', color: HORMONE_COLORS.lh, desc: 'Surges to trigger ovulation. Short but powerful spike.' },
  ];

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1.5px solid #D4A853', background: 'linear-gradient(135deg, rgba(212,168,83,0.10) 0%, rgba(212,168,83,0.03) 100%)' }} data-testid="hormone-map">
      <div className="px-3 pt-2.5 pb-0.5 flex items-center gap-1.5">
        <span style={{ color: '#D4A853', fontSize: '9px' }}>✿</span>
        <span className="text-[10px]" style={{ fontFamily: "'Poiret One', cursive", color: '#D4A853' }}>HORMOscope Pro</span>
        <span style={{ color: '#D4A853', fontSize: '9px' }}>✿</span>
      </div>
      <div className="text-center pt-1 pb-1">
        <h3 className="text-sm" style={{ fontFamily: "'Poiret One', cursive", color: '#FF1493' }}>Hormone Map</h3>
        <p className="text-white/50 text-[9px]" style={{ fontFamily: 'Poppins, sans-serif' }}>Your hormones across {cycleLength} days</p>
      </div>

      <div className="px-1 pb-1" data-testid="hormone-chart">
        <ResponsiveContainer width="100%" height={150}>
          <AreaChart data={data} margin={CHART_MARGIN}>
            <defs>
              <linearGradient id="estGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={HORMONE_COLORS.estrogen} stopOpacity={0.3} />
                <stop offset="100%" stopColor={HORMONE_COLORS.estrogen} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="progGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={HORMONE_COLORS.progesterone} stopOpacity={0.3} />
                <stop offset="100%" stopColor={HORMONE_COLORS.progesterone} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="lhGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={HORMONE_COLORS.lh} stopOpacity={0.3} />
                <stop offset="100%" stopColor={HORMONE_COLORS.lh} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis
              dataKey="day"
              tick={AXIS_TICK}
              axisLine={X_AXIS_LINE}
              tickLine={false}
              interval={6}
            />
            <YAxis
              tick={AXIS_TICK}
              axisLine={false}
              tickLine={false}
              domain={Y_DOMAIN}
              tickCount={3}
            />
            <Tooltip content={<CustomTooltip />} />

            {/* Current day marker */}
            {currentDayData && (
              <ReferenceLine
                x={currentDayData.day}
                stroke="rgba(255,255,255,0.25)"
                strokeDasharray="4 4"
                label={TODAY_LABEL}
              />
            )}

            <Area
              type="monotone"
              dataKey="estrogen"
              stroke={HORMONE_COLORS.estrogen}
              fill="url(#estGrad)"
              strokeWidth={activeHormone === 'estrogen' ? 2.5 : 1.5}
              opacity={!activeHormone || activeHormone === 'estrogen' ? 1 : 0.2}
              dot={false}
              activeDot={ACTIVE_DOT_E}
            />
            <Area
              type="monotone"
              dataKey="progesterone"
              stroke={HORMONE_COLORS.progesterone}
              fill="url(#progGrad)"
              strokeWidth={activeHormone === 'progesterone' ? 2.5 : 1.5}
              opacity={!activeHormone || activeHormone === 'progesterone' ? 1 : 0.2}
              dot={false}
              activeDot={ACTIVE_DOT_P}
            />
            <Area
              type="monotone"
              dataKey="lh"
              stroke={HORMONE_COLORS.lh}
              fill="url(#lhGrad)"
              strokeWidth={activeHormone === 'lh' ? 2.5 : 1.5}
              opacity={!activeHormone || activeHormone === 'lh' ? 1 : 0.2}
              dot={false}
              activeDot={ACTIVE_DOT_LH}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Legend — tap to highlight */}
      <div className="px-5 pb-4 space-y-2">
        {hormones.map(h => (
          <button
            key={h.key}
            onClick={() => setActiveHormone(prev => prev === h.key ? null : h.key)}
            className={`w-full flex items-start gap-3 p-2.5 rounded-xl text-left transition-all ${
              activeHormone === h.key ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]'
            }`}
            data-testid={`hormone-legend-${h.key}`}
          >
            <div className="w-3 h-3 rounded-full flex-shrink-0 mt-0.5" style={{ background: h.color }} />
            <div>
              <p className="text-white text-xs font-medium" style={{ fontFamily: 'Poppins, sans-serif' }}>{h.label}</p>
              <p className="text-[#9A8B91] text-[10px] leading-relaxed" style={{ fontFamily: 'Poppins, sans-serif' }}>{h.desc}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Phase timeline */}
      <div className="px-5 pb-4">
        <div className="flex rounded-full overflow-hidden h-2">
          {Object.entries(PHASE_COLORS).map(([phaseName, color]) => {
            const phaseData = data.filter(d => d.phase === phaseName);
            const width = (phaseData.length / data.length) * 100;
            return (
              <div
                key={phaseName}
                style={{ width: `${width}%`, background: color, opacity: 0.6 }}
                title={phaseName}
              />
            );
          })}
        </div>
        <div className="flex justify-between mt-1.5">
          {Object.entries(PHASE_COLORS).map(([phaseName, color]) => (
            <span key={phaseName} className="text-[9px]" style={{ color, fontFamily: 'Poppins, sans-serif' }}>
              {phaseName}
            </span>
          ))}
        </div>
      </div>

      {/* Disclaimer */}
      <div className="px-5 pb-4 border-t border-white/[0.05] pt-3">
        <p className="text-[#6c6c8a] text-[10px] leading-relaxed" style={{ fontFamily: 'Poppins, sans-serif' }}>
          Hormone levels shown are based on typical cycle patterns and may not reflect your individual levels. For accurate hormone testing, consult your doctor.
        </p>
      </div>
    </div>
  );
}
