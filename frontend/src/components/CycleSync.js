import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { PHASE_COLORS, PHASE_NAMES } from '../lib/phases';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Two-cycle syncing (launch fixes): both linked people side by side, plus
// the next 4 weeks with overlap highlights. Only what each chose to share.
function SideAvatar({ photo, name, size = 36 }) {
  if (photo) {
    return <img src={photo} alt={name || 'Partner'} className="rounded-full object-cover mx-auto mb-1.5" style={{ width: size, height: size }} />;
  }
  const initial = (name || 'P').trim().charAt(0).toUpperCase() || 'P';
  return (
    <span className="rounded-full flex items-center justify-center mx-auto mb-1.5 text-white font-semibold" aria-hidden="true"
      style={{ width: size, height: size, background: 'linear-gradient(135deg, #FF5C8A, #8B5CF6)', fontSize: Math.round(size * 0.45) }}>
      {initial}
    </span>
  );
}

function Side({ p }) {
  if (!p) return null;
  const color = PHASE_COLORS[p.phase] || PHASE_COLORS.unknown;
  return (
    <div className="flex-1 rounded-2xl p-4 text-center border border-white/10" style={{ background: 'rgba(255,255,255,0.04)' }}>
      {/* The face beside the name (v42), initial disc when she has
          no picture (legacy accounts). */}
      <SideAvatar photo={p.profile_photo} name={p.is_self ? 'You' : p.name} />
      <p className="text-white text-sm font-medium truncate">{p.is_self ? 'You' : p.name}</p>
      {!p.shared ? (
        <p className="text-[#E6E0EE] text-xs mt-3">Keeping this private</p>
      ) : p.no_periods ? (
        <>
          <p className="text-[#E6E0EE] text-xs mt-3">No periods to track</p>
          <p className="text-[#E6E0EE] text-xs mt-1">Her days come from what she logs</p>
          {Array.isArray(p.log_days) && (
            <p className="text-white text-xs mt-2">Logged {p.log_days.filter((d) => d.logged).length} of the last 28 days</p>
          )}
        </>
      ) : !p.tracking ? (
        <p className="text-[#E6E0EE] text-xs mt-3">Not tracking a cycle right now</p>
      ) : (
        <>
          <div className="w-16 h-16 rounded-full mx-auto my-3 flex items-center justify-center text-2xl font-bold text-[#1B1030]" style={{ background: color }}>
            {p.cycle_day}
          </div>
          <p className="text-sm" style={{ color }}>{PHASE_NAMES[p.phase] || p.phase}</p>
          {p.next_period_date && (
            <p className="text-[#E6E0EE] text-[11px] mt-1">Next period {new Date(p.next_period_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
          )}
        </>
      )}
    </div>
  );
}

export default function CycleSync({ token }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    axios.get(`${API}/partner/sync`, { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 })
      .then((r) => setData(r.data))
      .catch((e) => setError(e.response?.data?.detail || "Couldn't load your synced cycles."));
  }, [token]);

  if (error) return <p className="text-sm text-red-200 mb-4" role="alert">{error}</p>;
  if (!data) return null;
  const both = data.days.length > 0 && data.days[0].them;

  return (
    <div className="card p-5 mb-6" data-testid="cycle-sync" style={{ fontFamily: 'Poppins, sans-serif' }}>
      <h2 className="text-white text-xl mb-4" style={{ fontFamily: "'Poiret One', sans-serif" }}>Your cycles, side by side</h2>
      <div className="flex gap-3 mb-5">
        <Side p={data.me} />
        <Side p={data.them} />
      </div>
      {/* Feature B (v46): a no-periods side shows her logged days
          under the cards (feelings detail only rides along when she
          shares her mood and energy). */}
      {[data.me, data.them].filter((p) => p && p.no_periods && p.shared && Array.isArray(p.log_days)).map((p) => (
        <div key={p.is_self ? 'me-logs' : 'them-logs'} className="mb-5" data-testid="sync-logged-days">
          <p className="text-white text-sm mb-2">{p.is_self ? 'Your' : `${p.name}'s`} recent days</p>
          {p.log_days.filter((d) => d.logged).length === 0 ? (
            <p className="text-[#E6E0EE] text-xs">Nothing logged in the last few weeks yet.</p>
          ) : (
            <div className="space-y-2">
              {p.log_days.filter((d) => d.logged).slice(0, 7).map((d) => {
                const bits = [];
                if (d.feelings?.length) bits.push(`Feeling ${d.feelings.join(', ')}`);
                if (d.mood) bits.push(`Mood: ${d.mood}`);
                if (d.symptoms?.length) bits.push(d.symptoms.join(', '));
                if (d.flow) bits.push(`Flow: ${d.flow}`);
                if (d.is_period) bits.push('Period day');
                return (
                  <div key={d.date} className="rounded-xl px-3 py-2" style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <p className="text-[#f4a7b9] text-[11px]">{new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</p>
                    <p className="text-[#E6E0EE] text-xs">{bits.length ? bits.join(' · ') : 'Logged'}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
      {both ? (
        <>
          <p className="text-white text-sm mb-1">Next 4 weeks</p>
          <p className="text-[#E6E0EE] text-xs mb-3">
            {data.overlap_days} days in the same phase{data.both_period_days ? ` · ${data.both_period_days} days you're both on your period` : ''}.
          </p>
          <div className="grid grid-cols-7 gap-1" data-testid="cycle-sync-grid">
            {data.days.map((d) => (
              <div key={d.date} className="rounded-lg overflow-hidden text-center" style={{ outline: d.same_phase ? '2px solid #FF4F9A' : 'none' }} title={d.same_phase ? 'Same phase' : ''}>
                <div className="text-[10px] text-white/90 py-0.5" style={{ background: 'rgba(255,255,255,0.06)' }}>{new Date(d.date + 'T00:00:00').getDate()}</div>
                <div className="h-2.5" style={{ background: PHASE_COLORS[d.me.phase] }} />
                <div className="h-2.5" style={{ background: PHASE_COLORS[d.them.phase] }} />
              </div>
            ))}
          </div>
          <p className="text-[#E6E0EE] text-[11px] mt-3">Top bar: you. Bottom bar: {data.them.name}. Pink outline: same phase that day.</p>
        </>
      ) : (
        <p className="text-[#E6E0EE] text-xs">When you both share your phase, you'll see the next 4 weeks together here.</p>
      )}
    </div>
  );
}
