import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp, Activity, Droplet, Sun, Moon, Flower, Lock } from 'lucide-react';
import { Button } from '../components/ui/button';
import axios from 'axios';
import logger from '../utils/logger';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const phaseInfo = {
  menstrual: { color: '#7B1E30', icon: Droplet, name: 'Menstrual' },
  follicular: { color: '#2E8B57', icon: Flower, name: 'Follicular' },
  ovulatory: { color: '#FF69B4', icon: Sun, name: 'Ovulatory' },
  luteal: { color: '#4B0082', icon: Moon, name: 'Luteal' }
};

// Stable chart config — extracted to module scope to avoid per-render allocations
const AXIS_TICK = { fill: '#A0A0A0', fontSize: 10 };
const AXIS_TICK_LINE = { stroke: '#505050' };
const TOOLTIP_STYLE = {
  backgroundColor: '#0A0A12',
  border: '1px solid rgba(212, 175, 55, 0.3)',
  borderRadius: '12px',
  color: '#F5F5F5'
};
const LEGEND_STYLE = { color: '#A0A0A0', fontSize: '12px' };

export default function InsightsPage() {
  const { user, token } = useAuth();
  const [insights, setInsights] = useState(null);
  const [cycleStats, setCycleStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchInsights = useCallback(async () => {
    try {
      const [insightsRes, statsRes] = await Promise.all([
        axios.get(`${API}/insights`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/cycle-stats`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
      ]);
      setInsights(insightsRes.data);
      if (statsRes) setCycleStats(statsRes.data);
    } catch (err) {
      logger.error('Insights error:', err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (user?.is_premium) {
      fetchInsights();
    } else {
      setLoading(false);
    }
  }, [user?.is_premium, fetchInsights]); // eslint-disable-line

  // Show locked state for non-premium users
  if (!user?.is_premium) {
    return (
      <div className="min-h-screen pb-24 p-6 stars-bg flex flex-col items-center justify-center text-center">
        <div className="w-24 h-24 rounded-full bg-[#12121A] border-2 border-[#ff8fab]/30 flex items-center justify-center mb-6">
          <Lock className="w-12 h-12 text-[#ff8fab]" />
        </div>
        <h1 className="text-3xl font-bold text-[#F5F5F5] mb-4" >
          Advanced Insights is Premium
        </h1>
        <p className="text-[#A0A0A0] mb-8 max-w-sm">
          Unlock detailed hormone charts, cycle predictions, and personalized analytics with a premium subscription.
        </p>
        <Button 
          onClick={() => navigate('/subscription')} 
          className="btn-gold text-lg px-8 py-6"
          data-testid="unlock-insights-btn"
        >
          Unlock Insights
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-16 h-16 rounded-full border-4 border-[#ff8fab] border-t-transparent animate-spin" />
      </div>
    );
  }

  const currentPhase = insights?.cycle_info?.phase || 'menstrual';
  const PhaseIcon = phaseInfo[currentPhase]?.icon || Moon;

  return (
    <div className="pb-24 p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#F5F5F5]" >
          Insights
        </h1>
        <p className="text-[#A0A0A0] text-sm mt-1">Your hormone patterns & cycle data</p>
      </div>

      {/* Cycle History Card — pattern recognition from logged periods */}
      {cycleStats && cycleStats.cycles_tracked > 0 && (
        <div className="glass-card p-6 mb-6" data-testid="cycle-history-card">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#D4A853] to-[#c9a030] flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-[#05050A]" />
            </div>
            <div>
              <h2 className="text-lg text-[#F5F5F5]">Your Cycle History</h2>
              <p className="text-[#A0A0A0] text-xs" style={{ fontFamily: 'Poppins, sans-serif' }}>
                Based on {cycleStats.cycles_tracked} {cycleStats.cycles_tracked === 1 ? 'cycle' : 'cycles'} logged
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="text-center p-3 rounded-xl" style={{ background: 'rgba(212,168,83,0.08)', border: '1px solid rgba(212,168,83,0.2)' }}>
              <p className="text-2xl" style={{ color: '#D4A853', fontFamily: "'Poiret One', cursive" }} data-testid="stat-avg-cycle">{cycleStats.avg_cycle_length}</p>
              <p className="text-[10px] text-[#9A8B91] mt-1" style={{ fontFamily: 'Poppins, sans-serif' }}>avg cycle (days)</p>
            </div>
            <div className="text-center p-3 rounded-xl" style={{ background: 'rgba(212,168,83,0.08)', border: '1px solid rgba(212,168,83,0.2)' }}>
              <p className="text-2xl" style={{ color: '#D4A853', fontFamily: "'Poiret One', cursive" }} data-testid="stat-avg-period">{cycleStats.avg_period_length}</p>
              <p className="text-[10px] text-[#9A8B91] mt-1" style={{ fontFamily: 'Poppins, sans-serif' }}>avg period (days)</p>
            </div>
            <div className="text-center p-3 rounded-xl" style={{ background: 'rgba(212,168,83,0.08)', border: '1px solid rgba(212,168,83,0.2)' }}>
              <p className="text-2xl" style={{ color: '#D4A853', fontFamily: "'Poiret One', cursive" }} data-testid="stat-prediction">±{cycleStats.prediction_window}</p>
              <p className="text-[10px] text-[#9A8B91] mt-1" style={{ fontFamily: 'Poppins, sans-serif' }}>prediction (days)</p>
            </div>
          </div>

          {cycleStats.cycles_tracked >= 2 ? (
            <p className="text-xs text-[#A0A0A0] leading-relaxed" style={{ fontFamily: 'Poppins, sans-serif' }}>
              Your next period is expected within ±{cycleStats.prediction_window} {cycleStats.prediction_window === 1 ? 'day' : 'days'} of the predicted date.
              {cycleStats.prediction_window <= 2 && ' Your cycle is very consistent — your body is in tune.'}
              {cycleStats.prediction_window >= 4 && ' Your cycle varies a bit cycle-to-cycle — keep logging for sharper predictions.'}
            </p>
          ) : (
            <p className="text-xs text-[#A0A0A0] leading-relaxed" style={{ fontFamily: 'Poppins, sans-serif' }}>
              Log at least 2 cycles to unlock prediction confidence — your body&apos;s pattern becomes clearer with every period you track.
            </p>
          )}
        </div>
      )}

      {/* Current Hormones Card */}
      <div className="glass-card p-6 mb-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#ff8fab] to-[#ffc2d1] flex items-center justify-center">
            <Activity className="w-5 h-5 text-[#05050A]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[#F5F5F5]" >
              Current Hormone Levels
            </h2>
            <p className="text-[#A0A0A0] text-sm">Day {insights?.cycle_info?.cycle_day || '?'} - {insights?.cycle_info?.phase_info}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <HormoneLevel 
            name="Estrogen" 
            level={insights?.current_hormones?.estrogen || 0} 
            color="#FF69B4" 
          />
          <HormoneLevel 
            name="Progesterone" 
            level={insights?.current_hormones?.progesterone || 0} 
            color="#4B0082" 
          />
          <HormoneLevel 
            name="LH" 
            level={insights?.current_hormones?.lh || 0} 
            color="#ff8fab" 
          />
          <HormoneLevel 
            name="FSH" 
            level={insights?.current_hormones?.fsh || 0} 
            color="#2E8B57" 
          />
        </div>
      </div>

      {/* Hormone Chart */}
      <div className="glass-card p-6 mb-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-[#12121A] border border-[#ff8fab]/30 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-[#ff8fab]" />
          </div>
          <h2 className="text-lg font-semibold text-[#F5F5F5]" >
            Hormone Cycle Chart
          </h2>
        </div>

        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={insights?.hormone_chart || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#12121A" />
              <XAxis 
                dataKey="day" 
                stroke="#505050" 
                tick={AXIS_TICK}
                tickLine={AXIS_TICK_LINE}
              />
              <YAxis 
                stroke="#505050" 
                tick={AXIS_TICK}
                tickLine={AXIS_TICK_LINE}
              />
              <Tooltip 
                contentStyle={TOOLTIP_STYLE}
              />
              <Legend 
                wrapperStyle={LEGEND_STYLE}
              />
              <Line 
                type="monotone" 
                dataKey="estrogen" 
                stroke="#FF69B4" 
                strokeWidth={2} 
                dot={false}
                name="Estrogen"
              />
              <Line 
                type="monotone" 
                dataKey="progesterone" 
                stroke="#4B0082" 
                strokeWidth={2} 
                dot={false}
                name="Progesterone"
              />
              <Line 
                type="monotone" 
                dataKey="lh" 
                stroke="#ff8fab" 
                strokeWidth={2} 
                dot={false}
                name="LH"
              />
              <Line 
                type="monotone" 
                dataKey="fsh" 
                stroke="#2E8B57" 
                strokeWidth={2} 
                dot={false}
                name="FSH"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Phase indicators */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-[#12121A]">
          {Object.entries(phaseInfo).map(([phase, info]) => {
            const Icon = info.icon;
            return (
              <div 
                key={phase} 
                className={`flex flex-col items-center gap-1 ${currentPhase === phase ? 'opacity-100' : 'opacity-40'}`}
              >
                <div 
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: `${info.color}30`, border: `1px solid ${info.color}` }}
                >
                  <Icon className="w-4 h-4" style={{ color: info.color }} />
                </div>
                <span className="text-[10px] text-[#A0A0A0]">{info.name}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="glass-card p-4">
          <p className="text-[#A0A0A0] text-xs mb-1">Cycle Length</p>
          <p className="text-2xl font-bold text-[#F5F5F5]" >
            {insights?.cycle_length || 28} <span className="text-sm font-normal text-[#A0A0A0]">days</span>
          </p>
        </div>
        <div className="glass-card p-4">
          <p className="text-[#A0A0A0] text-xs mb-1">Period Days Tracked</p>
          <p className="text-2xl font-bold text-[#F5F5F5]" >
            {insights?.period_days_tracked || 0}
          </p>
        </div>
      </div>

      {/* Common Symptoms */}
      {insights?.common_symptoms?.length > 0 && (
        <div className="glass-card p-6 mt-6">
          <h3 className="text-lg font-semibold text-[#F5F5F5] mb-4" >
            Common Symptoms
          </h3>
          <div className="flex flex-wrap gap-2">
            {insights.common_symptoms.map(([symptom, count]) => (
              <span 
                key={symptom}
                className="px-3 py-1 rounded-full bg-[#12121A] border border-[#ff8fab]/20 text-[#A0A0A0] text-sm"
              >
                {symptom} ({count})
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function HormoneLevel({ name, level, color }) {
  return (
    <div className="bg-[#12121A] rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[#A0A0A0] text-sm">{name}</span>
        <span className="text-[#F5F5F5] font-semibold">{level}%</span>
      </div>
      <div className="h-2 rounded-full bg-[#05050A] overflow-hidden">
        <div 
          className="h-full rounded-full transition-all duration-500"
          style={{ 
            width: `${level}%`, 
            background: `linear-gradient(90deg, ${color}80, ${color})`
          }}
        />
      </div>
    </div>
  );
}
