import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePremium } from '../context/PremiumContext';
import { Link } from 'react-router-dom';
import { Plus, Trash2, ChevronLeft, ChevronRight, Heart, Droplet, Calendar, X, Lock } from 'lucide-react';
import axios from 'axios';
import logger from '../utils/logger';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const GOLD = '#D4A853';
const JOURNAL_PREVIEW_IMG = '/pro-screenshots/journal.png';

function MiniCalendar({ token, selectedDate, onSelectDate, onClose }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [cycleLogs, setCycleLogs] = useState([]);
  const [intimacyLogs, setIntimacyLogs] = useState([]);

  /* eslint-disable */
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [c, i] = await Promise.all([
          axios.get(`${API}/cycle-logs`, { headers: { Authorization: `Bearer ${token}` } }),
          axios.get(`${API}/intimacy-logs`, { headers: { Authorization: `Bearer ${token}` } })
        ]);
        setCycleLogs(c.data || []);
        setIntimacyLogs(i.data || []);
      } catch (err) { logger.error('Failed to fetch calendar data:', err); }
    };
    if (token) fetchData();
  }, [token]);
  /* eslint-enable */

  const y = currentMonth.getFullYear(), m = currentMonth.getMonth();
  const firstDay = new Date(y, m, 1).getDay();
  const days = new Date(y, m + 1, 0).getDate();
  const fmt = (d) => `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  const isPeriod = (d) => cycleLogs.some(l => l.date === fmt(d) && l.is_period);
  const isIntimacy = (d) => intimacyLogs.some(l => l.date === fmt(d));
  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="rounded-xl p-2.5 w-56" style={{ background: 'rgba(20,15,30,0.97)', border: '1px solid rgba(255,20,147,0.2)', backdropFilter: 'blur(20px)', boxShadow: '0 10px 40px rgba(0,0,0,0.5)' }}>
      <div className="flex items-center justify-between mb-1.5">
        <button onClick={() => setCurrentMonth(new Date(y, m-1))} className="p-0.5 text-white/40"><ChevronLeft className="w-3 h-3" /></button>
        <span className="text-[9px] text-white/60" style={{ fontFamily: 'Poppins, sans-serif' }}>{currentMonth.toLocaleDateString('en-US',{month:'short',year:'numeric'})}</span>
        <button onClick={() => setCurrentMonth(new Date(y, m+1))} className="p-0.5 text-white/40"><ChevronRight className="w-3 h-3" /></button>
      </div>
      <div className="grid grid-cols-7 gap-px">
        {['S','M','T','W','T','F','S'].map((d, i) => <span key={`dow-${i}-${d}`} className="text-[7px] text-center text-white/25" style={{fontFamily:'Poppins,sans-serif'}}>{d}</span>)}
        {Array.from({length:firstDay}).map((_,i) => <span key={`e${i}`} />)}
        {Array.from({length:days},(_,i)=>i+1).map(day => {
          const ds = fmt(day), sel = selectedDate===ds, td = ds===today;
          return (
            <button key={day} onClick={() => { onSelectDate(ds); onClose(); }}
              className="relative w-6 h-6 flex items-center justify-center rounded text-[8px]"
              style={{ background: sel?'#FF1493':isPeriod(day)?'rgba(232,90,107,0.25)':td?'rgba(255,255,255,0.08)':'transparent', color: sel?'#fff':td?'#fff':'#9A8B91', fontFamily:'Poppins,sans-serif' }}>
              {day}
              {isIntimacy(day) && <Heart className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5" style={{color:'#FF1493'}} fill="#FF1493" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function JournalPage() {
  const { token } = useAuth();
  const { isPro, loading: rcLoading } = usePremium();
  const [entries, setEntries] = useState([]);
  const [writing, setWriting] = useState(false);
  const [currentEntry, setCurrentEntry] = useState('');
  const [currentTitle, setCurrentTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(null);
  const [showCal, setShowCal] = useState(false);
  const entryRefs = useRef({});

  const todayStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  /* eslint-disable */
  useEffect(() => { if (token) fetchEntries(); else setLoading(false); }, [token]);
  /* eslint-enable */

  // Journal is Pro-only — fully locked for free users (no trial entries)

  const fetchEntries = async () => {
    try {
      const res = await axios.get(`${API}/journal`, { headers: { Authorization: `Bearer ${token}` } });
      setEntries(res.data);
    } catch (err) { logger.error('Failed to fetch journal entries:', err); } finally { setLoading(false); }
  };

  const handleSave = async () => {
    if (!currentEntry.trim()) return;
    setSaving(true);
    try {
      await axios.post(`${API}/journal`, {
        title: currentTitle.trim() || new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
        content: currentEntry
      }, { headers: { Authorization: `Bearer ${token}` } });
      setCurrentEntry(''); setCurrentTitle(''); setWriting(false);
      fetchEntries();
    } catch (err) { logger.error('Failed to save journal entry:', err); } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`${API}/journal/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      setEntries(entries.filter(e => e.id !== id));
    } catch (err) { logger.error('Failed to delete journal entry:', err); }
  };

  const handleDateSelect = (dateStr) => {
    setSelectedDate(dateStr);
    const target = entries.find(e => e.created_at?.startsWith(dateStr));
    if (target && entryRefs.current[target.id]) {
      entryRefs.current[target.id].scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const fmtDate = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  if (loading || rcLoading) return <div className="flex items-center justify-center min-h-screen"><div className="cycle-orb orb-follicular w-16 h-16" /></div>;

  // Pro-only gate: free users see a locked preview, no trial
  if (!isPro) {
    return (
      <div className="min-h-screen pb-20 lg:ml-64" style={{ background: 'linear-gradient(180deg, #1a1030 0%, #0f0a1a 30%, #0a0a1a 100%)' }} data-testid="journal-locked">
        <div className="max-w-md mx-auto px-5 pt-10 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-4" style={{ border: `1px solid ${GOLD}`, background: 'rgba(212,168,83,0.08)' }}>
            <Lock className="w-3.5 h-3.5" style={{ color: GOLD }} />
            <span className="text-[10px] tracking-widest uppercase" style={{ fontFamily: 'Poppins, sans-serif', color: GOLD }}>HORMOscope Pro</span>
          </div>
          <h1 className="text-4xl text-white mb-3" style={{ fontFamily: "'Poiret One', cursive" }}>The Journal</h1>
          <p className="text-sm leading-relaxed mb-6" style={{ fontFamily: 'Poppins, sans-serif', color: 'rgba(255,255,255,0.7)' }}>
            Your private space — that makes Your Daily Read smarter with every entry.
          </p>

          <div className="rounded-2xl overflow-hidden mb-6" style={{ border: `1.5px solid ${GOLD}`, boxShadow: '0 0 40px rgba(212,168,83,0.2)' }}>
            <img src={JOURNAL_PREVIEW_IMG} alt="Journal preview" className="w-full block" />
          </div>

          <div className="rounded-xl p-4 mb-6 text-left" style={{ border: '1px solid rgba(212,168,83,0.25)', background: 'rgba(212,168,83,0.04)' }}>
            <p className="text-xs leading-relaxed" style={{ fontFamily: 'Poppins, sans-serif', color: 'rgba(255,255,255,0.8)' }}>
              ✿&nbsp; Unlimited journal entries<br />
              ✿&nbsp; Beautiful lined-paper journal with handwritten font<br />
              ✿&nbsp; Mini-calendar to revisit any day<br />
              ✿&nbsp; Your Daily Read learns your voice
            </p>
          </div>

          <Link to="/pro?from=journal" data-testid="journal-locked-cta" className="block w-full py-3.5 rounded-full text-center text-white text-base" style={{ fontFamily: "'Poiret One', cursive", letterSpacing: '0.05em', background: 'linear-gradient(135deg, #D4A853, #c9a030)', boxShadow: '0 0 25px rgba(212,168,83,0.3)' }}>
            Unlock HORMOscope Pro
          </Link>
          <p className="text-[10px] mt-3" style={{ fontFamily: 'Poppins, sans-serif', color: 'rgba(255,255,255,0.4)' }}>
            $9.99/mo or $79.99/yr · Cancel anytime
          </p>
        </div>
      </div>
    );
  }

  const handleNewEntryClick = () => {
    setWriting(true);
  };

  return (
    <div className="min-h-screen pb-20 lg:ml-64" style={{ background: 'linear-gradient(180deg, #1a1030 0%, #0f0a1a 30%, #0a0a1a 100%)' }} data-testid="journal-page">
      {/* Decorative flowers */}
      <div className="absolute top-0 left-0 w-full h-64 pointer-events-none overflow-hidden opacity-20">
        <div className="absolute top-4 left-4 text-2xl" style={{ color: '#f4a7b9' }}>✿</div>
        <div className="absolute top-12 right-8 text-xl" style={{ color: '#c9b8f0' }}>✿</div>
        <div className="absolute top-24 left-1/3 text-lg" style={{ color: '#74b9ff' }}>✿</div>
        <div className="absolute top-8 right-1/3 text-sm" style={{ color: '#f4a7b9' }}>✿</div>
        <div className="absolute top-32 right-16 text-2xl" style={{ color: '#c9b8f0' }}>✿</div>
      </div>

      <div className="max-w-2xl mx-auto px-5 pt-6 relative">
        {/* Header Row */}
        <div className="flex items-start justify-between mb-1">
          <div>
            <p className="text-[10px] tracking-widest uppercase" style={{ fontFamily: 'Poppins, sans-serif', color: '#f4a7b9' }}>My Journal</p>
            <h1 className="text-3xl text-white" style={{ fontFamily: "'Poiret One', cursive" }}>Journal</h1>
          </div>
          <div className="flex items-center gap-2">
            {!writing && (
              <button onClick={handleNewEntryClick} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ border: '1px solid rgba(255,20,147,0.3)', background: 'rgba(255,20,147,0.1)' }} data-testid="new-entry-btn">
                <Plus className="w-4 h-4" style={{ color: '#FF1493' }} />
              </button>
            )}
            <button onClick={() => setShowCal(!showCal)} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ border: '1px solid rgba(201,184,240,0.3)', background: showCal ? 'rgba(201,184,240,0.15)' : 'rgba(201,184,240,0.05)' }} data-testid="toggle-calendar-btn">
              <Calendar className="w-4 h-4" style={{ color: '#c9b8f0' }} />
            </button>
          </div>
        </div>

        {/* Today's Date */}
        <button onClick={() => { setSelectedDate(new Date().toISOString().split('T')[0]); setWriting(true); }} className="mb-4">
          <p className="text-xs" style={{ fontFamily: 'Poppins, sans-serif', color: '#c9b8f0' }}>{todayStr}</p>
        </button>

        {/* Mini Calendar Dropdown */}
        {showCal && (
          <div className="absolute right-5 top-16 z-50">
            <MiniCalendar token={token} selectedDate={selectedDate} onSelectDate={handleDateSelect} onClose={() => setShowCal(false)} />
          </div>
        )}

        {/* Writing Area */}
        {writing && (
          <div className="rounded-xl mb-5 overflow-hidden" style={{ border: '1px solid rgba(255,20,147,0.15)', background: 'rgba(255,255,255,0.03)' }} data-testid="journal-editor">
            {/* Journal lines background */}
            <div className="relative p-4" style={{ backgroundImage: 'repeating-linear-gradient(transparent, transparent 27px, rgba(201,184,240,0.06) 27px, rgba(201,184,240,0.06) 28px)' }}>
              <input
                type="text" value={currentTitle} onChange={(e) => setCurrentTitle(e.target.value)}
                placeholder="Title..."
                className="w-full bg-transparent border-none text-white text-sm mb-3 placeholder-white/20 outline-none"
                style={{ fontFamily: "'Poiret One', cursive", fontSize: '18px' }}
                data-testid="journal-title-input"
              />
              <textarea
                value={currentEntry} onChange={(e) => setCurrentEntry(e.target.value)}
                placeholder="Write whatever is on your mind..."
                className="w-full bg-transparent border-none text-white/90 min-h-[180px] resize-none outline-none placeholder-white/15 leading-7"
                style={{ fontFamily: "'Satisfy', cursive", fontSize: '16px', lineHeight: '28px' }}
                autoFocus
                data-testid="journal-content-input"
              />
            </div>
            <div className="flex gap-2 p-3 border-t border-white/5">
              <button onClick={() => { setWriting(false); setCurrentEntry(''); setCurrentTitle(''); }}
                className="flex-1 py-2 rounded-full text-white/50 text-xs" style={{ fontFamily: 'Poppins, sans-serif', border: '1px solid rgba(255,255,255,0.08)' }}>
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving || !currentEntry.trim()}
                className="flex-1 py-2 rounded-full text-white text-xs font-medium disabled:opacity-40"
                style={{ fontFamily: 'Poppins, sans-serif', background: '#FF1493' }}
                data-testid="save-entry-btn">
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        )}

        {/* Entries */}
        {entries.length === 0 && !writing ? (
          <div className="text-center py-20">
            <p className="text-3xl mb-3" style={{ color: 'rgba(201,184,240,0.15)' }}>✿</p>
            <p className="text-white/30 text-sm" style={{ fontFamily: 'Poppins, sans-serif' }}>No entries yet</p>
            <p className="text-white/15 text-xs mt-1" style={{ fontFamily: 'Poppins, sans-serif' }}>Tap + to write your first entry</p>
          </div>
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => {
              const eDate = entry.created_at?.split('T')[0];
              const hl = selectedDate && eDate === selectedDate;
              return (
                <div key={entry.id} ref={el => entryRefs.current[entry.id] = el}
                  className="rounded-xl overflow-hidden transition-all"
                  style={{ border: hl ? '1px solid #FF1493' : '1px solid rgba(201,184,240,0.08)', background: 'rgba(255,255,255,0.02)', boxShadow: hl ? '0 0 15px rgba(255,20,147,0.1)' : 'none' }}
                  data-testid={`journal-entry-${entry.id}`}>
                  {/* Journal lines background */}
                  <div className="p-4 relative" style={{ backgroundImage: 'repeating-linear-gradient(transparent, transparent 27px, rgba(201,184,240,0.04) 27px, rgba(201,184,240,0.04) 28px)' }}>
                    <div className="flex items-start justify-between mb-1">
                      <div>
                        <h3 className="text-white text-sm" style={{ fontFamily: "'Poiret One', cursive" }}>{entry.title}</h3>
                        <p className="text-white/30 text-[10px] mt-0.5" style={{ fontFamily: 'Poppins, sans-serif' }}>{fmtDate(entry.created_at)}</p>
                      </div>
                      <button onClick={() => handleDelete(entry.id)} className="text-white/15 hover:text-red-400 p-1" data-testid={`delete-entry-${entry.id}`}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-white/80 leading-7 whitespace-pre-wrap mt-2" style={{ fontFamily: "'Satisfy', cursive", fontSize: '15px', lineHeight: '28px' }}>{entry.content}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
