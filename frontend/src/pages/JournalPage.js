import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { Plus, Trash2, ChevronLeft, ChevronRight, Heart, Droplet, Calendar, X, Lock, Pencil } from 'lucide-react';
import axios from 'axios';
import logger from '../utils/logger';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const GOLD = '#C9B8F0';
const JOURNAL_PREVIEW_IMG = '/pro-screenshots/journal.png';
// Journal ENTRY text only (Angelita, Oct 29, fix list item 16): her own
// handwriting feel, Architects Daughter (the 8C sample), self-hosted in
// src/fonts so it renders offline in the WebView. Headings stay
// Poiret One and all other journal UI text stays Poppins; the
// .journal-handwriting class in index.css carries the app pink ink
// (#F74093) and the slight italic tilt (about 8 degrees, synthesized
// oblique, entry text only).
const SERIF = "'Architects Daughter', 'Poppins', cursive";

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
    <div className="rounded-xl p-2.5 w-56" style={{ background: 'rgba(20,15,30,0.97)', border: '1px solid rgba(255,79,154,0.2)', backdropFilter: 'blur(20px)', boxShadow: '0 10px 40px rgba(0,0,0,0.5)' }}>
      <div className="flex items-center justify-between mb-1.5">
        <button onClick={() => setCurrentMonth(new Date(y, m-1))} className="p-0.5 text-white/70"><ChevronLeft className="w-3 h-3" /></button>
        <span className="text-[9px] text-white/80" style={{ fontFamily: 'Poppins, sans-serif' }}>{currentMonth.toLocaleDateString('en-US',{month:'short',year:'numeric'})}</span>
        <button onClick={() => setCurrentMonth(new Date(y, m+1))} className="p-0.5 text-white/70"><ChevronRight className="w-3 h-3" /></button>
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
              style={{ background: sel?'#FF4F9A':isPeriod(day)?'rgba(232,90,107,0.25)':pk?'rgba(93,187,138,0.4)':ov?'rgba(93,187,138,0.22)':td?'rgba(255,255,255,0.08)':'transparent', color: sel?'#fff':ov?'#7ED3A6':td?'#fff':'#CFC3CC', fontFamily:'Poppins,sans-serif' }}>
              {day}
              {isIntimacy(day) && <Heart className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5" style={{color:'#FF4F9A'}} fill="#FF4F9A" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function JournalPage() {
  const { token, user } = useAuth();
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
  // Which entry is open in the editor for changes (null = a new page).
  // The save/edit/cancel code read this state for a long time without
  // it ever being declared; v49 declares it (see handleNewEntryClick).
  const [editingId, setEditingId] = useState(null);
  // The journal reads like a book: one day per page. Page 0 is the most
  // recent day with entries; turning a page moves one day at a time.
  const [pageIndex, setPageIndex] = useState(0);
  const [pageNotice, setPageNotice] = useState('');

  // Her first name, so the app speaks to her like a person, not a
  // username (Angelita, Oct 17). Falls back quietly when there is none.
  const firstName = (user?.name || '').trim().split(/\s+/).filter(Boolean)[0] || null;
  const todayISO = () => new Date().toISOString().split('T')[0];

  // ---- The Vault (Angelita, Oct 17) ----
  // The book now holds today's page only. Everything before today is a
  // sealed day, and sealed days open only in the vault, behind a
  // password she sets herself. The password lives in this component's
  // state just long enough to unlock, and closing the vault clears it
  // and the sealed days from memory: locked means locked.
  const [vaultOpen, setVaultOpen] = useState(false);
  const [vaultHasPw, setVaultHasPw] = useState(null); // null = not asked yet
  const [vaultBusy, setVaultBusy] = useState(false);
  const [vaultError, setVaultError] = useState('');
  const [vaultPw, setVaultPw] = useState('');       // unlock field
  const [vaultNew1, setVaultNew1] = useState('');   // set form: new password
  const [vaultNew2, setVaultNew2] = useState('');   // set form: say it again
  const [vaultDays, setVaultDays] = useState(null); // sealed days, once unlocked
  const [vaultPage, setVaultPage] = useState(0);
  const [showChangePw, setShowChangePw] = useState(false);
  const [changeCur, setChangeCur] = useState('');
  const [changeNew, setChangeNew] = useState('');
  const [changeMsg, setChangeMsg] = useState('');

  const todayStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  /* eslint-disable */
  useEffect(() => { if (token) fetchEntries(); else setLoading(false); }, [token]);
  /* eslint-enable */

  // Safety net: never spin forever. If the backend is asleep and both the
  // journal fetch and the premium check are still pending after 20 seconds,
  // stop and show the retry UI instead.
  useEffect(() => {
    if (!loading) return;
    const t = setTimeout(() => setLoadTimedOut(true), 20000);
    return () => clearTimeout(t);
  }, [loading]);

  const handleRetry = () => {
    setLoadError(false);
    setLoadTimedOut(false);
    setLoading(true);
    fetchEntries();
  };

  // The Journal and the Journal Vault are hers alone.

  // Normalize-or-default for GET /journal, both backend generations:
  // the old one returns a plain array of ALL her entries (the book then
  // pages every day, newest first, exactly as it used to); the new one
  // returns an object whose entries are today's page. Anything else,
  // or any field that is not an array, becomes an empty list, so no
  // undefined ever reaches state.
  const normalizeJournalPayload = (data) => {
    if (Array.isArray(data)) return data;
    return Array.isArray(data?.entries) ? data.entries : [];
  };

  const fetchEntries = async () => {
    setLoadError(false);
    try {
      const res = await axios.get(`${API}/journal`, { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 });
      setEntries(normalizeJournalPayload(res.data));
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
      const title = currentTitle.trim() || new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
      if (editingId) {
        // Editing an existing page: same entry, same day, words updated.
        await axios.put(`${API}/journal/${editingId}`, {
          title, content: currentEntry
        }, { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 });
      } else {
        await axios.post(`${API}/journal`, {
          title,
          content: currentEntry,
          is_intimate: isIntimate
        }, { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 });
      }
      setCurrentEntry(''); setCurrentTitle(''); setIsIntimate(false); setWriting(false);
      setEditingId(null);
      setPageIndex(0); // the entry lives on today's page, the first page
      fetchEntries();
    } catch (err) {
      // Never fail silently: keep her words on screen and tell her plainly.
      logger.error('Failed to save journal entry:', err);
      setSaveError(true);
    } finally { setSaving(false); }
  };

  const handleEditEntry = (entry) => {
    setEditingId(entry.id);
    setCurrentTitle(entry.title || '');
    setCurrentEntry(entry.content || '');
    setIsIntimate(!!entry.is_intimate);
    setSaveError(false);
    setWriting(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
    // The book only holds today's page now. A past day lives in the
    // vault, so point her there warmly instead of turning a page.
    const idx = pages.findIndex(p => p.date === dateStr);
    if (idx >= 0) {
      setPageIndex(idx);
      setPageNotice('');
    } else if (dateStr < todayISO()) {
      setPageNotice('That day is sealed in your vault now. Tap the lock up top to open it.');
      setTimeout(() => setPageNotice(''), 4000);
    } else {
      const label = new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
      setPageNotice(`No journal page for ${label} yet.`);
      setTimeout(() => setPageNotice(''), 3000);
    }
  };

  const openVault = async () => {
    setVaultOpen(true);
    setVaultError('');
    if (vaultHasPw === null) {
      try {
        const res = await axios.get(`${API}/journal/vault/status`, { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 });
        setVaultHasPw(!!res.data?.has_password);
      } catch (err) {
        logger.error('Vault status failed:', err);
        setVaultError('Your vault could not be reached. The server may be waking up, close this and try again in a moment.');
      }
    }
  };

  const closeVault = () => {
    // Closing locks it again: password fields and sealed days leave memory.
    setVaultOpen(false);
    setVaultPw(''); setVaultNew1(''); setVaultNew2('');
    setChangeCur(''); setChangeNew(''); setChangeMsg('');
    setShowChangePw(false);
    setVaultDays(null); setVaultPage(0); setVaultError('');
  };

  const unlockVault = async (password) => {
    setVaultBusy(true); setVaultError('');
    try {
      const [entriesRes, logsRes] = await Promise.all([
        axios.post(`${API}/journal/vault/entries`, { password }, { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 }),
        axios.get(`${API}/cycle-logs`, { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 }).catch(() => ({ data: [] })),
      ]);
      // A sealed day is any day before today with something in it: her
      // writing (from the unlock call), her quick logs (the same cycle
      // logs the Calendar reads), and/or that day's companion
      // exchanges, which seal with the day. Newest sealed day first.
      const vaultData = entriesRes.data || {};
      const today = todayISO();
      const byDay = new Map();
      const dayOf = (d) => {
        if (!byDay.has(d)) byDay.set(d, { date: d, entries: [], logs: [], companion: [] });
        return byDay.get(d);
      };
      [...(vaultData.entries || [])]
        .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
        .forEach((e) => {
          const d = (e.created_at || '').split('T')[0];
          if (d && d < today) dayOf(d).entries.push(e);
        });
      (logsRes.data || []).forEach((l) => {
        if (l.date && l.date < today) dayOf(l.date).logs.push(l);
      });
      Object.entries(vaultData.companion || {}).forEach(([d, exs]) => {
        if (d && d < today) dayOf(d).companion = exs || [];
      });
      setVaultDays([...byDay.values()].sort((a, b) => b.date.localeCompare(a.date)));
      setVaultPage(0);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setVaultError(typeof detail === 'string' ? detail : 'That did not open your vault. The server may be waking up, give it a moment and try again.');
    } finally { setVaultBusy(false); }
  };

  const handleSetVaultPassword = async () => {
    if (vaultNew1.length < 4) { setVaultError('Your vault password needs at least 4 characters.'); return; }
    if (vaultNew1 !== vaultNew2) { setVaultError('Those two do not match. Type them once more, slowly.'); return; }
    setVaultBusy(true); setVaultError('');
    try {
      await axios.post(`${API}/journal/vault/set`, { password: vaultNew1 }, { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 });
      setVaultHasPw(true);
      const pw = vaultNew1;
      setVaultNew1(''); setVaultNew2('');
      await unlockVault(pw); // she just set it, so open the vault for her
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setVaultError(typeof detail === 'string' ? detail : 'That did not save. The server may be waking up, try again.');
      setVaultBusy(false);
    }
  };

  const handleChangeVaultPassword = async () => {
    if (changeNew.length < 4) { setChangeMsg('Your new vault password needs at least 4 characters.'); return; }
    setVaultBusy(true); setChangeMsg('');
    try {
      await axios.post(`${API}/journal/vault/set`, { current_password: changeCur, password: changeNew }, { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 });
      setChangeCur(''); setChangeNew('');
      setChangeMsg('Your vault password is changed.');
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setChangeMsg(typeof detail === 'string' ? detail : 'That did not change. Try again in a moment.');
    } finally { setVaultBusy(false); }
  };

  const fmtDayLong = (dateStr) => new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const fmtTime = (iso) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  if (loading && !loadTimedOut && !loadError) return (
    <div className="relative min-h-screen" style={{ background: 'linear-gradient(180deg, #15152B 0%, #0f0a1a 30%, #0B0B1E 100%)' }}>
      <div className="absolute inset-x-0 bottom-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <img src="/images/life-stages-silhouettes.webp" alt="" className="w-full max-w-3xl mx-auto block" style={{ opacity: 0.12 }} />
      </div>
      <div className="relative max-w-2xl mx-auto px-5 pt-6">
        <p className="text-[10px] tracking-widest uppercase" style={{ fontFamily: 'Poppins, sans-serif', color: '#f4a7b9' }}>Yours only</p>
        <h1 className="text-3xl text-white mb-10" style={{ fontFamily: "'Poiret One', sans-serif" }}>{firstName ? `${firstName}'s Journal` : 'Journal'}</h1>
        <div className="flex flex-col items-center pt-10">
          <div className="cycle-orb orb-follicular w-12 h-12 mb-4" />
          <p className="text-white/80 text-sm" style={{ fontFamily: 'Poppins, sans-serif' }}>Opening your journal...</p>
          <p className="text-white/30 text-xs mt-1" style={{ fontFamily: 'Poppins, sans-serif' }}>Your words live here.</p>
        </div>
      </div>
    </div>
  );

  if (loadTimedOut || loadError) return (
    <div className="relative flex flex-col items-center justify-center min-h-screen px-6 text-center overflow-hidden">
      <div className="absolute inset-x-0 bottom-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <img src="/images/life-stages-silhouettes.webp" alt="" className="w-full max-w-3xl mx-auto block" style={{ opacity: 0.12 }} />
      </div>
      <p className="relative text-white/80 text-sm mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>Couldn&apos;t load your journal.</p>
      <p className="relative text-white/70 text-xs mb-6" style={{ fontFamily: 'Poppins, sans-serif' }}>The server might be waking up. Try again in a moment.</p>
      <button
        onClick={handleRetry}
        className="relative px-6 py-3 rounded-full text-white text-sm font-medium"
        style={{ background: '#FF4F9A', fontFamily: 'Poppins, sans-serif' }}
      >
        Try Again
      </button>
    </div>
  );

  // v49 (Angelita, Oct 26: "I pushed the journal plus and nothing
  // happened"). Root cause: the editor's Save button label and the save
  // handler read an `editingId` state that was never declared anywhere
  // in this file, so the moment the editor rendered it threw and the
  // whole page unmounted to a blank screen: the tap looked like it did
  // nothing at all. The state is declared now, and opening the editor
  // for a new page also clears any half-finished edit and scrolls the
  // editor into view, so the tap always visibly does its job.
  const handleNewEntryClick = () => {
    setEditingId(null);
    setCurrentEntry('');
    setCurrentTitle('');
    setIsIntimate(false);
    setSaveError(false);
    setWriting(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="relative min-h-screen pb-40 lg:ml-64" style={{ background: 'linear-gradient(180deg, #15152B 0%, #0f0a1a 30%, #0B0B1E 100%)' }} data-testid="journal-page">
      {/* Her life stages line, baby to old lady, faded to a soft outline
          behind the journal (Angelita, Oct 26, 2026). v54 (Oct 29): she
          asked for it back DOWN low where it was before v50, tight and
          clear of the wording, not up under the text, so the bottom
          anchoring from v49 is restored. Decorative only, kept faint so
          every word on the page stays easy to read. */}
      <div className="absolute inset-x-0 bottom-0 pointer-events-none overflow-hidden" aria-hidden="true" data-testid="journal-life-stages-backdrop">
        <img src="/images/life-stages-silhouettes.webp" alt="" className="w-full max-w-3xl mx-auto block" style={{ opacity: 0.13 }} />
      </div>
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
            <p className="text-[10px] tracking-widest uppercase" style={{ fontFamily: 'Poppins, sans-serif', color: '#f4a7b9' }}>Yours only</p>
            <h1 className="text-3xl text-white" style={{ fontFamily: "'Poiret One', sans-serif" }}>{firstName ? `${firstName}'s Journal` : 'Journal'}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={openVault} className="flex items-center gap-1.5 h-8 px-3 rounded-full" style={{ border: `1px solid rgba(201,184,240,0.4)`, background: 'rgba(201,184,240,0.08)' }} data-testid="journal-vault-btn" aria-label="Open your vault">
              <Lock className="w-3.5 h-3.5" style={{ color: GOLD }} />
              <span className="text-[10px] whitespace-nowrap" style={{ fontFamily: 'Poppins, sans-serif', color: GOLD }}>{firstName ? `${firstName}'s Vault` : 'Your Vault'}</span>
            </button>
            {!writing && (
              <button onClick={handleNewEntryClick} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ border: '1px solid rgba(255,79,154,0.3)', background: 'rgba(255,79,154,0.1)' }} data-testid="new-entry-btn">
                <Plus className="w-4 h-4" style={{ color: '#FF4F9A' }} />
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

        <div className="flex items-center justify-center gap-3 mt-1 mb-5" aria-hidden="true">
          <span style={{ height: '1px', width: '52px', background: 'linear-gradient(90deg, transparent, rgba(201,184,240,0.5))' }} />
          <span style={{ color: 'rgba(201,184,240,0.65)', fontSize: '11px' }}>✿</span>
          <span style={{ height: '1px', width: '52px', background: 'linear-gradient(90deg, rgba(201,184,240,0.5), transparent)' }} />
        </div>

        {/* Mini Calendar Dropdown */}
        {showCal && (
          <div className="absolute right-5 top-16 z-50">
            <MiniCalendar token={token} user={user} selectedDate={selectedDate} onSelectDate={handleDateSelect} onClose={() => setShowCal(false)} />
          </div>
        )}

        {/* Writing Area */}
        {writing && (
          <div className="rounded-2xl mb-5 overflow-hidden" style={{ border: '1px solid rgba(244,167,185,0.2)', background: 'linear-gradient(180deg, rgba(253,243,246,0.05) 0%, rgba(255,79,154,0.02) 100%)', boxShadow: '0 18px 40px rgba(0,0,0,0.35)' }} data-testid="journal-editor">
            {/* No ruled-line background: it started at the top of the box
                while the text starts lower, so the words never sat on the
                lines. Clean, even line spacing instead (28px), which
                always matches the text. */}
            <div className="relative p-4">
              <input
                type="text" value={currentTitle} onChange={(e) => setCurrentTitle(e.target.value)}
                placeholder="Title..."
                className="w-full bg-transparent border-none text-white text-sm mb-3 placeholder-white/20 outline-none"
                style={{ fontFamily: "'Poiret One', sans-serif", fontSize: '18px', borderBottom: '1px solid rgba(244,167,185,0.14)', paddingBottom: '8px' }}
                data-testid="journal-title-input"
              />
              <textarea
                value={currentEntry} onChange={(e) => { setCurrentEntry(e.target.value); if (saveError) setSaveError(false); }}
                placeholder="Write whatever is on your mind..."
                className="journal-handwriting w-full bg-transparent border-none min-h-[180px] resize-none outline-none placeholder-white/15"
                style={{ fontFamily: SERIF, fontSize: '16px', lineHeight: '28px', color: '#F74093' }}
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
                  background: isIntimate ? 'rgba(201,184,240,0.12)' : 'transparent'
                }}
                data-testid="intimate-toggle">
                <Lock className="w-4 h-4" style={{ color: isIntimate ? GOLD : 'rgba(255,255,255,0.35)' }} />
              </button>
              <button onClick={() => { setWriting(false); setCurrentEntry(''); setCurrentTitle(''); setIsIntimate(false); setEditingId(null); }}
                className="flex-1 py-2 rounded-full text-white/75 text-xs" style={{ fontFamily: 'Poppins, sans-serif', border: '1px solid rgba(255,255,255,0.08)' }}>
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving || !currentEntry.trim()}
                className="flex-1 py-2 rounded-full text-white text-xs font-medium disabled:opacity-40"
                style={{ fontFamily: 'Poppins, sans-serif', background: '#FF4F9A' }}
                data-testid="save-entry-btn">
                {saving ? 'Saving...' : (editingId ? 'Save changes' : 'Save')}
              </button>
            </div>
          </div>
        )}

        {/* The book: one day per page, turn pages with Older / Newer */}
        {pageNotice && (
          <p className="text-center text-xs mb-3" style={{ fontFamily: 'Poppins, sans-serif', color: '#c9b8f0' }} data-testid="journal-page-notice">{pageNotice}</p>
        )}
        {entries.length === 0 && !writing ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ background: 'radial-gradient(circle, rgba(255,79,154,0.14) 0%, rgba(255,79,154,0.03) 70%)', border: '1px solid rgba(244,167,185,0.18)' }}>
              <p className="text-2xl" style={{ color: 'rgba(244,167,185,0.55)' }}>✿</p>
            </div>
            <p className="text-white/45 text-sm" style={{ fontFamily: 'Poppins, sans-serif' }}>Nothing written yet today</p>
            <p className="text-white/25 text-xs mt-1 px-8 leading-relaxed" style={{ fontFamily: 'Poppins, sans-serif' }}>Tap + to write. Your past days are sealed in your vault, under the lock up top.</p>
          </div>
        ) : pages.length > 0 ? (
          <div data-testid="journal-book">
            {(() => {
              const page = pages[Math.min(pageIndex, pages.length - 1)];
              return (
                <>
                  <div className="flex items-end justify-between mb-2 px-1">
                    <p style={{ fontFamily: "'Poiret One', sans-serif", fontSize: '17px', color: '#F4D3DC', borderBottom: '1px solid rgba(201,184,240,0.35)', paddingBottom: '3px' }}>{fmtDayLong(page.date)}</p>
                    <p className="text-[10px] tracking-widest uppercase" style={{ fontFamily: 'Poppins, sans-serif', color: '#CFC3CC' }}>
                      Page {Math.min(pageIndex, pages.length - 1) + 1} of {pages.length}
                    </p>
                  </div>
                  <div className="rounded-2xl overflow-hidden"
                    style={{ border: '1px solid rgba(244,167,185,0.16)', borderLeft: '3px solid rgba(255,79,154,0.5)', background: 'linear-gradient(180deg, rgba(253,243,246,0.05) 0%, rgba(255,79,154,0.02) 100%)', boxShadow: '0 18px 40px rgba(0,0,0,0.35), inset 8px 0 16px rgba(0,0,0,0.22)' }}>
                    {page.entries.map((entry, i) => (
                      <div key={entry.id} className="p-4"
                        style={i > 0 ? { borderTop: '1px solid rgba(201,184,240,0.08)' } : {}}
                        data-testid={`journal-entry-${entry.id}`}>
                        <div className="flex items-start justify-between mb-1">
                          <div>
                            <h3 className="text-white text-sm" style={{ fontFamily: "'Poiret One', sans-serif" }}>{entry.title}</h3>
                            <p className="text-white/30 text-[10px] mt-0.5" style={{ fontFamily: 'Poppins, sans-serif' }}>{fmtTime(entry.created_at)}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <button onClick={() => handleEditEntry(entry)}
                              title="Edit this entry"
                              className="p-1" data-testid={`edit-entry-${entry.id}`}>
                              <Pencil className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.78)' }} />
                            </button>
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
                        <p className="journal-handwriting whitespace-pre-wrap mt-2" style={{ fontFamily: SERIF, fontSize: '16px', lineHeight: '28px', color: '#F74093' }}>{entry.content}</p>
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
                      style={{ fontFamily: 'Poppins, sans-serif', border: '1px solid rgba(255,79,154,0.3)', color: '#f4a7b9', background: 'rgba(255,79,154,0.06)' }}
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

      {/* The Vault: her sealed days, behind a password only she knows.
          Full-screen like the phase cards, above the bottom nav, and
          data-no-swipe keeps the tab-swipe handler out while it is open. */}
      {vaultOpen && (
        <div className="fixed inset-0 z-[80] flex flex-col" style={{ background: 'linear-gradient(180deg, #15152B 0%, #0f0a1a 30%, #0B0B1E 100%)' }} data-no-swipe="true" data-testid="journal-vault">
          {/* The same faded life stages line runs behind the vault,
              down low like the journal page (v49 placement, restored
              in v54 at her word). */}
          <div className="absolute inset-x-0 bottom-0 pointer-events-none overflow-hidden" aria-hidden="true">
            <img src="/images/life-stages-silhouettes.webp" alt="" className="w-full max-w-3xl mx-auto block" style={{ opacity: 0.10 }} />
          </div>
          <div className="relative flex items-center justify-between px-5 py-4 max-w-2xl mx-auto w-full flex-shrink-0">
            <div className="flex items-center gap-2">
              <Lock className="w-5 h-5" style={{ color: GOLD }} />
              <h2 className="text-white text-xl" style={{ fontFamily: "'Poiret One', sans-serif" }}>{firstName ? `${firstName}'s Vault` : 'Your Vault'}</h2>
            </div>
            <button onClick={closeVault} aria-label="Close vault" className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 text-white active:opacity-70">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="relative flex-1 overflow-y-auto px-5 pb-10">
            <div className="max-w-2xl mx-auto">
              <p className="text-sm leading-relaxed mb-5" style={{ fontFamily: 'Poppins, sans-serif', color: 'rgba(255,255,255,0.7)' }}>
                This is yours only. No one else can open this, not even someone linked to your account. When a day ends, everything you wrote and logged seals in here, safe.
              </p>

              {vaultDays ? (
                <div data-testid="vault-unlocked">
                  {vaultDays.length === 0 ? (
                    <div className="text-center py-16">
                      <p className="text-3xl mb-3" style={{ color: 'rgba(201,184,240,0.25)' }}>✿</p>
                      <p className="text-white/70 text-sm" style={{ fontFamily: 'Poppins, sans-serif' }}>Nothing sealed yet.</p>
                      <p className="text-white/25 text-xs mt-1" style={{ fontFamily: 'Poppins, sans-serif' }}>When today ends, it will be waiting here for you tomorrow.</p>
                    </div>
                  ) : (
                    <>
                      {(() => {
                        const day = vaultDays[Math.min(vaultPage, vaultDays.length - 1)];
                        return (
                          <>
                            <div className="flex items-end justify-between mb-2 px-1">
                              <p className="text-sm" style={{ fontFamily: 'Poppins, sans-serif', color: '#F4D3DC' }}>{fmtDayLong(day.date)}</p>
                              <p className="text-[10px] tracking-widest uppercase" style={{ fontFamily: 'Poppins, sans-serif', color: '#CFC3CC' }}>
                                Sealed day {Math.min(vaultPage, vaultDays.length - 1) + 1} of {vaultDays.length}
                              </p>
                            </div>
                            <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(244,167,185,0.16)', borderLeft: `3px solid ${GOLD}`, background: 'linear-gradient(180deg, rgba(253,243,246,0.05) 0%, rgba(255,79,154,0.02) 100%)', boxShadow: '0 18px 40px rgba(0,0,0,0.35), inset 8px 0 16px rgba(0,0,0,0.22)' }}>
                              {day.entries.map((entry, i) => (
                                <div key={entry.id} className="p-4" style={i > 0 ? { borderTop: '1px solid rgba(201,184,240,0.08)' } : {}} data-testid={`vault-entry-${entry.id}`}>
                                  <h3 className="text-white text-sm" style={{ fontFamily: "'Poiret One', sans-serif" }}>{entry.title}</h3>
                                  <p className="text-white/30 text-[10px] mt-0.5" style={{ fontFamily: 'Poppins, sans-serif' }}>{fmtTime(entry.created_at)}</p>
                                  {entry.is_intimate && (
                                    <p className="text-[10px] tracking-widest uppercase mt-1" style={{ fontFamily: 'Poppins, sans-serif', color: GOLD }}>
                                      Intimate · her eyes only
                                    </p>
                                  )}
                                  <p className="journal-handwriting whitespace-pre-wrap mt-2" style={{ fontFamily: SERIF, fontSize: '16px', lineHeight: '28px', color: '#F74093' }}>{entry.content}</p>
                                </div>
                              ))}
                              {day.logs.length > 0 && (
                                <div className="p-4" style={day.entries.length > 0 ? { borderTop: '1px solid rgba(201,184,240,0.08)' } : {}}>
                                  <p className="text-[#CFC3CC] text-[10px] tracking-widest uppercase mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>Logged this day</p>
                                  <div className="space-y-2">
                                    {day.logs.map((log) => (
                                      <div key={log.id}>
                                        {log.notes && (
                                          <p className="text-[#FDF8FA] text-xs leading-relaxed" style={{ fontFamily: 'Poppins, sans-serif' }}>{log.notes}</p>
                                        )}
                                        {!log.notes && log.symptoms?.length > 0 && (
                                          <p className="text-[#FDF8FA] text-xs leading-relaxed" style={{ fontFamily: 'Poppins, sans-serif' }}>{log.symptoms.join(', ')}</p>
                                        )}
                                        {log.flow && (
                                          <p className="text-[#CFC3CC] text-[11px] capitalize" style={{ fontFamily: 'Poppins, sans-serif' }}>Flow: {log.flow}</p>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="flex items-center justify-between mt-4">
                              <button
                                onClick={() => setVaultPage(Math.min(vaultPage + 1, vaultDays.length - 1))}
                                disabled={vaultPage >= vaultDays.length - 1}
                                className="flex items-center gap-1 px-4 py-2 rounded-full text-xs disabled:opacity-30"
                                style={{ fontFamily: 'Poppins, sans-serif', border: '1px solid rgba(201,184,240,0.25)', color: '#c9b8f0', background: 'rgba(201,184,240,0.05)' }}
                                data-testid="vault-older-btn">
                                <ChevronLeft className="w-4 h-4" /> Older day
                              </button>
                              <button
                                onClick={() => setVaultPage(Math.max(vaultPage - 1, 0))}
                                disabled={vaultPage <= 0}
                                className="flex items-center gap-1 px-4 py-2 rounded-full text-xs disabled:opacity-30"
                                style={{ fontFamily: 'Poppins, sans-serif', border: '1px solid rgba(255,79,154,0.3)', color: '#f4a7b9', background: 'rgba(255,79,154,0.06)' }}
                                data-testid="vault-newer-btn">
                                Newer day <ChevronRight className="w-4 h-4" />
                              </button>
                            </div>
                          </>
                        );
                      })()}
                    </>
                  )}

                  {/* Change the vault password, from inside the vault */}
                  <div className="mt-8 pt-5" style={{ borderTop: '1px solid rgba(201,184,240,0.12)' }}>
                    {!showChangePw ? (
                      <button onClick={() => setShowChangePw(true)} className="text-xs underline" style={{ fontFamily: 'Poppins, sans-serif', color: '#CFC3CC' }} data-testid="vault-change-toggle">
                        Change vault password
                      </button>
                    ) : (
                      <div data-testid="vault-change-form">
                        <input
                          type="password" value={changeCur} onChange={(e) => setChangeCur(e.target.value)}
                          placeholder="Current vault password" autoComplete="current-password"
                          className="w-full rounded-xl px-4 py-3 text-sm mb-3 outline-none placeholder-white/25 text-white"
                          style={{ fontFamily: 'Poppins, sans-serif', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(201,184,240,0.25)' }}
                        />
                        <input
                          type="password" value={changeNew} onChange={(e) => setChangeNew(e.target.value)}
                          placeholder="New vault password" autoComplete="new-password"
                          className="w-full rounded-xl px-4 py-3 text-sm mb-3 outline-none placeholder-white/25 text-white"
                          style={{ fontFamily: 'Poppins, sans-serif', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(201,184,240,0.25)' }}
                        />
                        {changeMsg && (
                          <p className="text-xs mb-3" style={{ fontFamily: 'Poppins, sans-serif', color: '#c9b8f0' }}>{changeMsg}</p>
                        )}
                        <div className="flex gap-2">
                          <button onClick={() => { setShowChangePw(false); setChangeMsg(''); setChangeCur(''); setChangeNew(''); }}
                            className="flex-1 py-2.5 rounded-full text-white/75 text-xs" style={{ fontFamily: 'Poppins, sans-serif', border: '1px solid rgba(255,255,255,0.08)' }}>
                            Cancel
                          </button>
                          <button onClick={handleChangeVaultPassword} disabled={vaultBusy || !changeCur || !changeNew}
                            className="flex-1 py-2.5 rounded-full text-white text-xs font-medium disabled:opacity-40"
                            style={{ fontFamily: 'Poppins, sans-serif', background: '#FF4F9A' }}
                            data-testid="vault-change-btn">
                            {vaultBusy ? 'Saving...' : 'Save new password'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : vaultHasPw === null ? (
                vaultError ? (
                  <p className="text-xs text-center py-10" style={{ fontFamily: 'Poppins, sans-serif', color: '#ff8fa3' }} data-testid="vault-error">{vaultError}</p>
                ) : (
                  <p className="text-white/70 text-sm text-center py-10" style={{ fontFamily: 'Poppins, sans-serif' }}>Opening your vault...</p>
                )
              ) : vaultHasPw ? (
                <div data-testid="vault-unlock-form">
                  <p className="text-sm leading-relaxed mb-4" style={{ fontFamily: 'Poppins, sans-serif', color: 'rgba(255,255,255,0.65)' }}>
                    Your sealed days are behind your vault password. Type it to open them.
                  </p>
                  <input
                    type="password" value={vaultPw} onChange={(e) => { setVaultPw(e.target.value); if (vaultError) setVaultError(''); }}
                    placeholder="Vault password" autoComplete="current-password"
                    className="w-full rounded-xl px-4 py-3 text-sm mb-3 outline-none placeholder-white/25 text-white"
                    style={{ fontFamily: 'Poppins, sans-serif', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(201,184,240,0.25)' }}
                    data-testid="vault-password-input"
                  />
                  {vaultError && (
                    <p className="text-xs mb-3" style={{ fontFamily: 'Poppins, sans-serif', color: '#ff8fa3' }} data-testid="vault-error">{vaultError}</p>
                  )}
                  <button onClick={() => unlockVault(vaultPw)} disabled={vaultBusy || !vaultPw}
                    className="w-full py-3 rounded-full text-white text-sm font-medium disabled:opacity-40"
                    style={{ fontFamily: 'Poppins, sans-serif', background: '#FF4F9A' }}
                    data-testid="vault-unlock-btn">
                    {vaultBusy ? 'Opening...' : 'Open my vault'}
                  </button>
                </div>
              ) : (
                <div data-testid="vault-set-form">
                  <p className="text-sm leading-relaxed mb-4" style={{ fontFamily: 'Poppins, sans-serif', color: 'rgba(255,255,255,0.65)' }}>
                    Set the password for your vault. You will need it to open your sealed days, so pick one you will remember. It is yours alone, and no one can reset it for you.
                  </p>
                  <input
                    type="password" value={vaultNew1} onChange={(e) => { setVaultNew1(e.target.value); if (vaultError) setVaultError(''); }}
                    placeholder="New vault password" autoComplete="new-password"
                    className="w-full rounded-xl px-4 py-3 text-sm mb-3 outline-none placeholder-white/25 text-white"
                    style={{ fontFamily: 'Poppins, sans-serif', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(201,184,240,0.25)' }}
                    data-testid="vault-new-password-input"
                  />
                  <input
                    type="password" value={vaultNew2} onChange={(e) => { setVaultNew2(e.target.value); if (vaultError) setVaultError(''); }}
                    placeholder="Type it once more" autoComplete="new-password"
                    className="w-full rounded-xl px-4 py-3 text-sm mb-3 outline-none placeholder-white/25 text-white"
                    style={{ fontFamily: 'Poppins, sans-serif', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(201,184,240,0.25)' }}
                    data-testid="vault-confirm-password-input"
                  />
                  {vaultError && (
                    <p className="text-xs mb-3" style={{ fontFamily: 'Poppins, sans-serif', color: '#ff8fa3' }} data-testid="vault-error">{vaultError}</p>
                  )}
                  <button onClick={handleSetVaultPassword} disabled={vaultBusy || !vaultNew1 || !vaultNew2}
                    className="w-full py-3 rounded-full text-white text-sm font-medium disabled:opacity-40"
                    style={{ fontFamily: 'Poppins, sans-serif', background: '#FF4F9A' }}
                    data-testid="vault-set-btn">
                    {vaultBusy ? 'Setting...' : 'Set my vault password'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
