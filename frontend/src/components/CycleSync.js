import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { PHASE_COLORS, PHASE_NAMES } from '../lib/phases';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Two-cycle syncing (launch fixes): both linked people side by side, plus
// the next 4 weeks with overlap highlights. Only what each chose to share.
function Side({ p }) {
  if (!p) return null;
  const color = PHASE_COLORS[p.phase] || PHASE_COLORS.unknown;
  return (
    <div className="flex-1 rounded-2xl p-4 text-center border border-white/10" style={{ background: 'rgba(255,255,255,0.04)' }}>
      <p className="text-white text-sm font-medium truncate">{p.is_self ? 'You' : p.name}</p>
      {!p.shared ? (
        <p className="text-[#E6E0EE] text-xs mt-3">Keeping this private</p>
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
