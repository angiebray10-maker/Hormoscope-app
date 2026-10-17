import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePremium } from '../context/PremiumContext';
import { Link } from 'react-router-dom';
import { Plus, Trash2, ChevronLeft, ChevronRight, Heart, Droplet, Calendar, X, Lock } from 'lucide-react';
import axios from 'axios';
import logger from '../utils/logger';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const GOLD = '#D4A853';
const JOURNAL_PREVIEW_IMG = '/pro-screenshots/journal.png';
// Classy, easy-to-read serif for the journal itself (Angelita, Oct 17:
// no more cursive). System serif stack, so it renders the same offline
// in the WebView with no font download.
const SERIF = "'Georgia', 'Noto Serif', 'Times New Roman', serif";

function MiniCalendar({ token, user, selectedDate, onSelectDate, onClose }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [cycleLogs, setCycleLogs] = useState([]);
  const [intimacyLogs, setIntimacyLogs] = useState([]);
  const [dashboard, setDashboard] = useState(null);

  /* eslint-disable */
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [c, i, d] = await Promise.all([
          axios.get(`${API}/cycle-logs`, { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 }),
          axios.get(`${API}/intimacy-logs`, { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 }),
          axios.get(`${API}/dashboard`, { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 }).catch(() => ({ data: null }))
        ]);
        setCycleLogs(c.data || []);
        setIntimacyLogs(i.data || []);
        setDashboard(d.data || null);
      } catch (err) { logger.error('Failed to fetch calendar data:', err); }
    };
    if (token) fetchData();
  }, [token]);
  /* eslint-enable */

  // Same ovulation math as the big Calendar tab (Angelita, Oct 17: the
  // small corner calendar needs the green ovulation days lit up too).
  // Next period comes from the dashboard when available, otherwise it is
  // projected forward from her last period start and cycle length.
  const getNextPeriodDate = () => {
    if (dashboard?.cycle_info?.next_period_date) return dashboard.cycle_info.next_period_date;
    if (!user?.last_period_date) return null;
    const cycleLen = user.cycle_length || 28;
    const next = new Date(user.last_period_date + 'T00:00:00');
    const todayD = new Date();
    todayD.setHours(0, 0, 0, 0);
    while (next <= todayD) next.setDate(next.getDate() + cycleLen);
    return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
  };
  const ovulationWindow = () => {
    const npd = getNextPeriodDate();
    if (!npd) return null;
    const ov = new Date(npd + 'T00:00:00');
    ov.setDate(ov.getDate() - 14);
    const start = new Date(ov);
    start.setDate(start.getDate() - 5);
    const end = new Date(ov);
    end.setDate(end.getDate() + 1);
    return { ov, start, end };
  };
  const isOvulation = (d) => {
    const w = ovulationWindow();
    if (!w) return false;
    const check = new Date(fmt(d) + 'T00:00:00');
    return check >= w.start && check <= w.end;
  };
  const isPeak = (d) => {
    const w = ovulationWindow();
    if (!w) return false;
    const check = new Date(fmt(d) + 'T00:00:00');
    const diff = Math.floor((check - w.ov) / (1000 * 60 * 60 * 24));
    return diff >= -1 && diff <= 0;
  };

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
          const ov = !sel && !isPeriod(day) && isOvulation(day);
          const pk = ov && isPeak(day);
          return (
            <button key={day} onClick={() => { onSelectDate(ds); onClose(); }}
              className="relative w-6 h-6 flex items-center justify-center rounded text-[8px]"
              style={{ background: sel?'#FF1493':isPeriod(day)?'rgba(232,90,107,0.25)':pk?'rgba(93,187,138,0.4)':ov?'rgba(93,187,138,0.22)':td?'rgba(255,255,255,0.08)':'transparent', color: sel?'#fff':ov?'#7ED3A6':td?'#fff':'#9A8B91', fontFamily:'Poppins,sans-serif' }}>
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
  const { token, user } = useAuth();
  const { isPro, inFirstCycle, loading: rcLoading } = usePremium();
  const [entries, setEntries] = useState([]);
  const [writing, setWriting] = useState(false);
  const [currentEntry, setCurrentEntry] = useState('');
  const [currentTitle, setCurrentTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [loadTimedOut, setLoadTimedOut] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [showCal, setShowCal] = useState(false);
  const [isIntimate, setIsIntimate] = useState(false);
  // The journal reads like a book: one day per page. Page 0 is the most
  // recent day with entries; turning a page moves one day at a time.
  const [pageIndex, setPageIndex] = useState(0);
  const [pageNotice, setPageNotice] = useState('');

  const todayStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  /* eslint-disable */
  useEffect(() => { if (token) fetchEntries(); else setLoading(false); }, [token]);
  /* eslint-enable */

  // Safety net: never spin forever. If the backend is asleep and both the
  // journal fetch and the premium check are still pending after 20 seconds,
  // stop and show the retry UI instead.
  useEffect(() => {
    if (!loading && !rcLoading) return;
    const t = setTimeout(() => setLoadTimedOut(true), 20000);
    return () => clearTimeout(t);
  }, [loading, rcLoading]);

  const handleRetry = () => {
    setLoadError(false);
    setLoadTimedOut(false);
    setLoading(true);
    fetchEntries();
  };

  // Journal gate: open for Pro, and open free during her first cycle
  // (one full personal cycle from signup; see PremiumContext.inFirstCycle)

  const fetchEntries = async () => {
    setLoadError(false);
    try {
      const res = await axios.get(`${API}/journal`, { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 });
      setEntries(res.data);
    } catch (err) {
      logger.error('Failed to fetch journal entries:', err);
      setLoadError(true);
    } finally { setLoading(false); }
  };

  // Group entries into book pages: one page per day, newest day first.
  // Within a page, entries read newest first.
  const pages = useMemo(() => {
    const byDay = new Map();
    [...entries]
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
      .forEach((e) => {
        const day = (e.created_at || '').split('T')[0];
        if (!day) return;
        if (!byDay.has(day)) byDay.set(day, []);
        byDay.get(day).push(e);
      });
    return [...byDay.entries()]
      .map(([date, dayEntries]) => ({ date, entries: dayEntries }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [entries]);

  // Keep the page pointer valid when entries are added or deleted.
  useEffect(() => {
    if (pageIndex > 0 && pageIndex >= pages.length) setPageIndex(Math.max(0, pages.length - 1));
  }, [pages, pageIndex]);

  const handleSave = async () => {
    if (!currentEntry.trim()) return;
    setSaving(true);
    setSaveError(false);
    try {
      await axios.post(`${API}/journal`, {
        title: currentTitle.trim() || new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
        content: currentEntry,
        is_intimate: isIntimate
      }, { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 });
      setCurrentEntry(''); setCurrentTitle(''); setIsIntimate(false); setWriting(false);
      setPageIndex(0); // the new entry lands on today's page, the first page
      fetchEntries();
    } catch (err) {
      // Never fail silently: keep her words on screen and tell her plainly.
      logger.error('Failed to save journal entry:', err);
      setSaveError(true);
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`${API}/journal/${id}`, { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 });
      setEntries(entries.filter(e => e.id !== id));
    } catch (err) { logger.error('Failed to delete journal entry:', err); }
  };

  const handleToggleIntimate = async (entry) => {
    try {
      const res = await axios.put(`${API}/journal/${entry.id}/intimate`, { is_intimate: !entry.is_intimate },
        { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 });
      setEntries(entries.map(e => e.id === entry.id ? { ...e, is_intimate: res.data.is_intimate } : e));
    } catch (err) { logger.error('Failed to toggle intimate flag:', err); }
  };

  const handleDateSelect = (dateStr) => {
    setSelectedDate(dateStr);
    // Turn straight to that day's page in the book, if she wrote that day.
    const idx = pages.findIndex(p => p.date === dateStr);
    if (idx >= 0) {
      setPageIndex(idx);
      setPageNotice('');
    } else {
      const label = new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
      setPageNotice(`No journal page for ${label} yet.`);
      setTimeout(() => setPageNotice(''), 3000);
    }
  };

  const fmtDayLong = (dateStr) => new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const fmtTime = (iso) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  if ((loading || rcLoading) && !loadTimedOut && !loadError) return <div className="flex items-center justify-center min-h-screen"><div className="cycle-orb orb-follicular w-16 h-16" /></div>;

  if (loadTimedOut || loadError) return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
      <p className="text-white/80 text-sm mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>Couldn&apos;t load your journal.</p>
      <p className="text-white/40 text-xs mb-6" style={{ fontFamily: 'Poppins, sans-serif' }}>The server might be waking up. Try again in a moment.</p>
      <button
        onClick={handleRetry}
        className="px-6 py-3 rounded-full text-white text-sm font-medium"
        style={{ background: '#FF1493', fontFamily: 'Poppins, sans-serif' }}
      >
        Try Again
      </button>
    </div>
  );

  // Locked only outside the first free cycle and without Pro
  if (!isPro && !inFirstCycle) {
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
              ✿&nbsp; A journal that reads like a real book, one day to a page<br />
              ✿&nbsp; Mini-calendar to revisit any day<br />
              ✿&nbsp; Your Daily Read learns your voice
            </p>
          </div>

          <Link to="/pro?from=journal" data-testid="journal-locked-cta" className="block w-full py-3.5 rounded-full text-center text-white text-base" style={{ fontFamily: "'Poiret One', cursive", letterSpacing: '0.05em', background: 'linear-gradient(135deg, #D4A853, #c9a030)', boxShadow: '0 0 25px rgba(212,168,83,0.3)' }}>
            Unlock HORMOscope Pro
          </Link>
          <p className="text-[10px] mt-3" style={{ fontFamily: 'Poppins, sans-serif', color: 'rgba(255,255,255,0.4)' }}>
            $6.99/mo or $49.99/yr · Cancel anytime
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

        {!isPro && inFirstCycle && (
          <div className="rounded-xl px-4 py-3 mb-4" style={{ border: '1px solid rgba(244,167,185,0.35)', background: 'rgba(244,167,185,0.07)' }} data-testid="journal-first-cycle-note">
            <p className="text-xs leading-relaxed" style={{ fontFamily: 'Poppins, sans-serif', color: '#F4D3DC' }}>
              Your Journal is open and free for your whole first cycle. Make yourself at home.
            </p>
          </div>
        )}

        {/* Mini Calendar Dropdown */}
        {showCal && (
          <div className="absolute right-5 top-16 z-50">
            <MiniCalendar token={token} user={user} selectedDate={selectedDate} onSelectDate={handleDateSelect} onClose={() => setShowCal(false)} />
          </div>
        )}

        {/* Writing Area */}
        {writing && (
          <div className="rounded-xl mb-5 overflow-hidden" style={{ border: '1px solid rgba(255,20,147,0.15)', background: 'rgba(255,255,255,0.03)' }} data-testid="journal-editor">
            {/* No ruled-line background: it started at the top of the box
                while the text starts lower, so the words never sat on the
                lines. Clean, even line spacing instead (28px), which
                always matches the text. */}
            <div className="relative p-4">
              <input
                type="text" value={currentTitle} onChange={(e) => setCurrentTitle(e.target.value)}
                placeholder="Title..."
                className="w-full bg-transparent border-none text-white text-sm mb-3 placeholder-white/20 outline-none"
                style={{ fontFamily: "'Poiret One', cursive", fontSize: '18px' }}
                data-testid="journal-title-input"
              />
              <textarea
                value={currentEntry} onChange={(e) => { setCurrentEntry(e.target.value); if (saveError) setSaveError(false); }}
                placeholder="Write whatever is on your mind..."
                className="w-full bg-transparent border-none text-white/90 min-h-[180px] resize-none outline-none placeholder-white/15"
                style={{ fontFamily: SERIF, fontSize: '16px', lineHeight: '28px' }}
                autoFocus
                data-testid="journal-content-input"
              />
            </div>
            {saveError && (
              <p className="px-4 pb-2 text-xs" style={{ fontFamily: 'Poppins, sans-serif', color: '#ff8fa3' }} data-testid="journal-save-error">
                That didn&apos;t save. Your words are still here. The server may be waking up, give it a moment and tap Save again.
              </p>
            )}
            <div className="flex gap-2 p-3 border-t border-white/5 items-center">
              <button
                onClick={() => setIsIntimate(!isIntimate)}
                title={isIntimate ? 'Intimate — her eyes only' : 'Mark as intimate'}
                className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                style={{
                  border: isIntimate ? `1px solid ${GOLD}` : '1px solid rgba(255,255,255,0.12)',
                  background: isIntimate ? 'rgba(212,168,83,0.12)' : 'transparent'
                }}
                data-testid="intimate-toggle">
                <Lock className="w-4 h-4" style={{ color: isIntimate ? GOLD : 'rgba(255,255,255,0.35)' }} />
              </button>
              <button onClick={() => { setWriting(false); setCurrentEntry(''); setCurrentTitle(''); setIsIntimate(false); }}
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

        {/* The book: one day per page, turn pages with Older / Newer */}
        {pageNotice && (
          <p className="text-center text-xs mb-3" style={{ fontFamily: 'Poppins, sans-serif', color: '#c9b8f0' }} data-testid="journal-page-notice">{pageNotice}</p>
        )}
        {entries.length === 0 && !writing ? (
          <div className="text-center py-20">
            <p className="text-3xl mb-3" style={{ color: 'rgba(201,184,240,0.15)' }}>✿</p>
            <p className="text-white/30 text-sm" style={{ fontFamily: 'Poppins, sans-serif' }}>No entries yet</p>
            <p className="text-white/15 text-xs mt-1" style={{ fontFamily: 'Poppins, sans-serif' }}>Tap + to write your first entry</p>
          </div>
        ) : pages.length > 0 ? (
          <div data-testid="journal-book">
            {(() => {
              const page = pages[Math.min(pageIndex, pages.length - 1)];
              return (
                <>
                  <div className="flex items-end justify-between mb-2 px-1">
                    <p className="text-sm" style={{ fontFamily: 'Poppins, sans-serif', color: '#F4D3DC' }}>{fmtDayLong(page.date)}</p>
                    <p className="text-[10px] tracking-widest uppercase" style={{ fontFamily: 'Poppins, sans-serif', color: '#9A8B91' }}>
                      Page {Math.min(pageIndex, pages.length - 1) + 1} of {pages.length}
                    </p>
                  </div>
                  <div className="rounded-xl overflow-hidden"
                    style={{ border: '1px solid rgba(201,184,240,0.12)', borderLeft: '3px solid rgba(255,20,147,0.45)', background: 'rgba(255,255,255,0.02)' }}>
                    {page.entries.map((entry, i) => (
                      <div key={entry.id} className="p-4"
                        style={i > 0 ? { borderTop: '1px solid rgba(201,184,240,0.08)' } : {}}
                        data-testid={`journal-entry-${entry.id}`}>
                        <div className="flex items-start justify-between mb-1">
                          <div>
                            <h3 className="text-white text-sm" style={{ fontFamily: "'Poiret One', cursive" }}>{entry.title}</h3>
                            <p className="text-white/30 text-[10px] mt-0.5" style={{ fontFamily: 'Poppins, sans-serif' }}>{fmtTime(entry.created_at)}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <button onClick={() => handleToggleIntimate(entry)}
                              title={entry.is_intimate ? 'Intimate — her eyes only' : 'Mark as intimate'}
                              className="p-1" data-testid={`intimate-entry-${entry.id}`}>
                              <Lock className="w-3.5 h-3.5" style={{ color: entry.is_intimate ? GOLD : 'rgba(255,255,255,0.15)' }} />
                            </button>
                            <button onClick={() => handleDelete(entry.id)} className="text-white/15 hover:text-red-400 p-1" data-testid={`delete-entry-${entry.id}`}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        {entry.is_intimate && (
                          <p className="text-[10px] tracking-widest uppercase mb-1" style={{ fontFamily: 'Poppins, sans-serif', color: GOLD }}>
                            Intimate · her eyes only
                          </p>
                        )}
                        <p className="text-white/85 whitespace-pre-wrap mt-2" style={{ fontFamily: SERIF, fontSize: '16px', lineHeight: '28px' }}>{entry.content}</p>
                      </div>
                    ))}
                  </div>
                  {/* Page-turn controls */}
                  <div className="flex items-center justify-between mt-4">
                    <button
                      onClick={() => setPageIndex(Math.min(pageIndex + 1, pages.length - 1))}
                      disabled={pageIndex >= pages.length - 1}
                      className="flex items-center gap-1 px-4 py-2 rounded-full text-xs disabled:opacity-30"
                      style={{ fontFamily: 'Poppins, sans-serif', border: '1px solid rgba(201,184,240,0.25)', color: '#c9b8f0', background: 'rgba(201,184,240,0.05)' }}
                      data-testid="journal-older-page-btn">
                      <ChevronLeft className="w-4 h-4" /> Older day
                    </button>
                    <button
                      onClick={() => setPageIndex(Math.max(pageIndex - 1, 0))}
                      disabled={pageIndex <= 0}
                      className="flex items-center gap-1 px-4 py-2 rounded-full text-xs disabled:opacity-30"
                      style={{ fontFamily: 'Poppins, sans-serif', border: '1px solid rgba(255,20,147,0.3)', color: '#f4a7b9', background: 'rgba(255,20,147,0.06)' }}
                      data-testid="journal-newer-page-btn">
                      Newer day <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        ) : null}
      </div>
    </div>
  );
}
