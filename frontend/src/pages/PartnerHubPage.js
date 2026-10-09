import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePremium } from '../context/PremiumContext';
import { Link } from 'react-router-dom';
import { Heart, Shield, Loader2, Calendar as CalendarIcon, Send, Trash2, Link2, Lock, Gift } from 'lucide-react';
import axios from 'axios';
import logger from '../utils/logger';

const GOLD = '#D4A853';

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

const KIND_STYLES = {
  period: { bg: 'rgba(232,90,107,0.25)', label: 'Period' },
  fertile: { bg: 'rgba(85,239,196,0.18)', label: 'Fertile' },
  ovulation: { bg: 'rgba(85,239,196,0.45)', label: 'Ovulation' },
  expected_period: { bg: 'rgba(255,107,107,0.14)', label: 'Period expected' },
};

function NotesTab({ token, currentUserId, onUnreadChange }) {
  const [notes, setNotes] = useState([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchNotes = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/partner/notes`, { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 });
      setNotes(res.data.notes || []);
      onUnreadChange(res.data.unread_count || 0);
    } catch (err) {
      logger.error('Failed to fetch notes:', err);
    } finally {
      setLoading(false);
    }
  }, [token, onUnreadChange]);

  useEffect(() => {
    fetchNotes();
    const t = setInterval(fetchNotes, 15000);
    return () => clearInterval(t);
  }, [fetchNotes]);

  useEffect(() => {
    // Mark as read shortly after opening, so the dot clears naturally
    const t = setTimeout(async () => {
      try {
        await axios.put(`${API}/partner/notes/read`, {}, { headers: { Authorization: `Bearer ${token}` } });
        onUnreadChange(0);
      } catch (err) { /* quiet */ }
    }, 4000);
    return () => clearTimeout(t);
  }, [token, onUnreadChange]);

  const handleSend = async () => {
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true);
    try {
      await axios.post(`${API}/partner/notes`, { content }, { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 });
      setDraft('');
      fetchNotes();
    } catch (err) {
      logger.error('Failed to send note:', err);
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`${API}/partner/notes/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      setNotes(notes.filter(n => n.id !== id));
    } catch (err) {
      logger.error('Failed to delete note:', err);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-[#f4a7b9] animate-spin" /></div>;
  }

  return (
    <div data-testid="partner-notes">
      {notes.length === 0 ? (
        <div className="text-center py-12">
          <Heart className="w-10 h-10 text-[#f4a7b9]/40 mx-auto mb-3" />
          <p className="text-white/50 text-sm" style={{ fontFamily: 'Poppins, sans-serif' }}>Nothing here yet.</p>
          <p className="text-white/25 text-xs mt-1" style={{ fontFamily: 'Poppins, sans-serif' }}>Leave the first little note below.</p>
        </div>
      ) : (
        <div className="space-y-3 mb-4">
          {notes.map((n) => {
            const mine = currentUserId && n.author_id === currentUserId;
            return (
              <div key={n.id}
                className={`rounded-2xl p-4 border border-white/[0.06] ${mine ? 'ml-8' : 'mr-8'}`}
                style={{ background: mine ? 'rgba(255,20,147,0.07)' : 'rgba(255,255,255,0.03)' }}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-white text-sm leading-relaxed whitespace-pre-wrap" style={{ fontFamily: 'Poppins, sans-serif' }}>{n.content}</p>
                  {mine && (
                    <button onClick={() => handleDelete(n.id)} className="text-white/15 hover:text-red-400 p-1 shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <p className="text-white/25 text-[10px] mt-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
                  {n.author_name} · {n.created_at ? new Date(n.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                </p>
              </div>
            );
          })}
        </div>
      )}
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, 280))}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
          placeholder="Write a little note..."
          className="flex-1 px-4 py-3 rounded-full bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder-white/25 outline-none"
          style={{ fontFamily: 'Poppins, sans-serif' }}
          data-testid="note-input"
        />
        <button onClick={handleSend} disabled={sending || !draft.trim()}
          className="w-12 h-12 rounded-full flex items-center justify-center disabled:opacity-40 shrink-0"
          style={{ background: '#FF1493' }} data-testid="note-send">
          <Send className="w-5 h-5 text-white" />
        </button>
      </div>
    </div>
  );
}

function CalendarTab({ markedDays }) {
  const [viewDate, setViewDate] = useState(new Date());
  const y = viewDate.getFullYear(), m = viewDate.getMonth();
  const firstDay = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const markMap = {};
  (markedDays || []).forEach(md => { markMap[md.date] = md.kind; });
  const fmt = (d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div data-testid="partner-calendar">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setViewDate(new Date(y, m - 1, 1))} className="px-3 py-1.5 rounded-full text-white/60 text-sm border border-white/10">‹</button>
        <span className="text-white text-base" style={{ fontFamily: "'Poiret One', cursive" }}>
          {viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </span>
        <button onClick={() => setViewDate(new Date(y, m + 1, 1))} className="px-3 py-1.5 rounded-full text-white/60 text-sm border border-white/10">›</button>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <span key={i} className="text-center text-white/25 text-[10px] py-1" style={{ fontFamily: 'Poppins, sans-serif' }}>{d}</span>
        ))}
        {Array.from({ length: firstDay }).map((_, i) => <span key={`e${i}`} />)}
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
          const ds = fmt(day);
          const kind = markMap[ds];
          const st = kind ? KIND_STYLES[kind] : null;
          return (
            <div key={day}
              className="aspect-square rounded-lg flex items-center justify-center text-sm"
              style={{
                background: st ? st.bg : 'transparent',
                color: ds === todayStr ? '#fff' : '#d4d4e0',
                fontFamily: 'Poppins, sans-serif',
                border: ds === todayStr ? '1px solid rgba(255,255,255,0.4)' : '1px solid transparent',
                fontWeight: kind === 'ovulation' ? '700' : '400'
              }}>
              {day}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-3 mt-4">
        {Object.entries(KIND_STYLES).map(([k, st]) => (
          <span key={k} className="flex items-center gap-1.5 text-white/50 text-[10px]" style={{ fontFamily: 'Poppins, sans-serif' }}>
            <span className="w-3 h-3 rounded" style={{ background: st.bg }} />
            {st.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function PartnerHubPage() {
  const { token, user } = useAuth();
  const { isPro, loading: rcLoading } = usePremium();
  const [status, setStatus] = useState(null);
  const [calData, setCalData] = useState(null);
  const [tab, setTab] = useState('cycle');
  const [inviteCode, setInviteCode] = useState('');
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState(null);
  const [unread, setUnread] = useState(0);

  const loadStatus = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/partner/status`, { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 });
      setStatus(res.data);
      if (res.data.is_linked) {
        const c = await axios.get(`${API}/partner/calendar`, { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 });
        setCalData(c.data);
      }
    } catch (err) {
      logger.error('Partner hub load error:', err);
      setStatus({ is_linked: false });
    }
  }, [token]);

  useEffect(() => {
    if (token) loadStatus();
  }, [token, loadStatus]);

  const handleAccept = async () => {
    const code = inviteCode.trim();
    if (!code || accepting) return;
    setAccepting(true);
    setAcceptError(null);
    try {
      await axios.post(`${API}/partner/accept-invite`, { invite_code: code }, { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 });
      setInviteCode('');
      loadStatus();
    } catch (err) {
      setAcceptError(err.response?.data?.detail || 'Could not link with that code.');
    } finally {
      setAccepting(false);
    }
  };

  if (status === null || rcLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0a1a' }}>
        <Loader2 className="w-8 h-8 text-[#f4a7b9] animate-spin" />
      </div>
    );
  }

  // Pro gate for owners: the inviter needs Pro. Partners (role === 'partner') get in free via invite.
  if (status.is_linked && status.role === 'owner' && !isPro) {
    return (
      <div className="min-h-screen pb-20" style={{ background: 'linear-gradient(180deg, #1a1030 0%, #0f0a1a 30%, #0a0a1a 100%)' }} data-testid="partner-locked">
        <div className="max-w-md mx-auto px-5 pt-10 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-4" style={{ border: `1px solid ${GOLD}`, background: 'rgba(212,168,83,0.08)' }}>
            <Lock className="w-3.5 h-3.5" style={{ color: GOLD }} />
            <span className="text-[10px] tracking-widest uppercase" style={{ fontFamily: 'Poppins, sans-serif', color: GOLD }}>HORMOscope Pro</span>
          </div>
          <h1 className="text-4xl text-white mb-3" style={{ fontFamily: "'Poiret One', cursive" }}>Attuned Partner Mode</h1>
          <p className="text-sm leading-relaxed mb-6" style={{ fontFamily: 'Poppins, sans-serif', color: 'rgba(255,255,255,0.7)' }}>
            Let him follow your cycle — ovulation, fertile days, and when to expect your period. He gets his own free account; only you need Pro.
          </p>
          <div className="rounded-xl p-4 mb-6 text-left" style={{ border: '1px solid rgba(212,168,83,0.25)', background: 'rgba(212,168,83,0.04)' }}>
            <p className="text-xs leading-relaxed" style={{ fontFamily: 'Poppins, sans-serif', color: 'rgba(255,255,255,0.8)' }}>
              ✿&nbsp; He sees your calendar and cycle day<br />
              ✿&nbsp; Your intimate journal stays private<br />
              ✿&nbsp; Secret gift shop for period care<br />
              ✿&nbsp; Private notes between you two
            </p>
          </div>
          <Link to="/pro?from=partner" data-testid="partner-locked-cta" className="block w-full py-3.5 rounded-full text-center text-white text-base" style={{ fontFamily: "'Poiret One', cursive", letterSpacing: '0.05em', background: 'linear-gradient(135deg, #D4A853, #c9a030)', boxShadow: '0 0 25px rgba(212,168,83,0.3)' }}>
            Unlock HORMOscope Pro
          </Link>
          <p className="text-[10px] mt-3" style={{ fontFamily: 'Poppins, sans-serif', color: 'rgba(255,255,255,0.4)' }}>
            $6.99/mo or $49.99/yr · Cancel anytime
          </p>
        </div>
      </div>
    );
  }

  // Not linked: invite-code entry
  if (!status.is_linked) {
    return (
      <div className="min-h-screen px-5 py-10 pb-24" style={{ background: '#0a0a1a' }}>
        <div className="max-w-md mx-auto text-center">
          <div className="w-16 h-16 rounded-full bg-[#FF1493]/15 flex items-center justify-center mx-auto mb-5">
            <Link2 className="w-7 h-7 text-[#FF1493]" />
          </div>
          <p className="text-[10px] tracking-widest uppercase mb-2" style={{ fontFamily: 'Poppins, sans-serif', color: '#f4a7b9' }}>
            Attuned Partner Mode
          </p>
          <h1 className="text-2xl text-white mb-3" style={{ fontFamily: "'Poiret One', cursive" }}>Link Your Accounts</h1>
          <p className="text-[#9A8B91] text-sm mb-6 leading-relaxed" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Ask her for the invite code from her Profile, then enter it below. You will be able to follow her cycle —
            ovulation days, fertile window, and when to expect her period.
          </p>
          <input
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value.toUpperCase().slice(0, 8))}
            placeholder="INVITE CODE"
            className="w-full px-5 py-4 rounded-2xl bg-white/[0.04] border border-white/[0.1] text-white text-center text-xl tracking-[0.3em] placeholder-white/20 outline-none mb-3"
            style={{ fontFamily: 'Poppins, sans-serif' }}
            data-testid="invite-code-input"
          />
          {acceptError && (
            <p className="text-red-400 text-xs mb-3" style={{ fontFamily: 'Poppins, sans-serif' }}>{acceptError}</p>
          )}
          <button onClick={handleAccept} disabled={accepting || !inviteCode.trim()}
            className="w-full py-3.5 rounded-full text-white text-sm font-medium disabled:opacity-40"
            style={{ fontFamily: 'Poppins, sans-serif', background: '#FF1493' }}
            data-testid="accept-invite-btn">
            {accepting ? 'Linking...' : 'Link Accounts'}
          </button>
          <p className="text-[#6c6c8a] text-[10px] mt-6 leading-relaxed" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Her journal and private entries are never shared. You only see what she chose to share.
          </p>
        </div>
      </div>
    );
  }

  const phaseColor = PHASE_COLORS[calData?.phase] || '#c9b8f0';
  const tips = calData?.partner_tips;

  return (
    <div className="min-h-screen px-5 py-8 pb-28" style={{ background: '#0a0a1a' }} data-testid="partner-hub">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-6">
          <p className="text-[10px] tracking-widest uppercase mb-2" style={{ fontFamily: 'Poppins, sans-serif', color: '#f4a7b9' }}>
            Attuned Partner Mode
          </p>
          <h1 className="text-2xl text-white mb-1" style={{ fontFamily: "'Poiret One', cursive" }}>
            {calData ? `${calData.name}'s Cycle` : 'Partner Hub'}
          </h1>
          {status.role === 'owner' && (
            <p className="text-[#9A8B91] text-xs" style={{ fontFamily: 'Poppins, sans-serif' }}>
              Linked with {status.partner_name} · this is what he sees
            </p>
          )}
        </div>

        {/* Tabs — Notes sits here quietly, discovered naturally */}
        <div className="flex gap-2 mb-6">
          {[
            { id: 'cycle', label: 'Cycle', icon: Heart },
            { id: 'calendar', label: 'Calendar', icon: CalendarIcon },
            { id: 'notes', label: 'Notes', icon: null },
            { id: 'gifts', label: 'Gifts', icon: Gift, link: '/gift-shop' },
          ].map(t => (
            t.link ? (
              <Link key={t.id} to={t.link}
                className="flex-1 py-2.5 rounded-full text-sm font-medium flex items-center justify-center gap-1.5"
                style={{
                  fontFamily: 'Poppins, sans-serif',
                  background: 'rgba(212,168,83,0.08)',
                  color: GOLD,
                  border: `1px solid ${GOLD}40`
                }}
                data-testid={`hub-tab-${t.id}`}>
                <Gift className="w-4 h-4" />
                {t.label}
              </Link>
            ) : (
              <button key={t.id} onClick={() => setTab(t.id)}
                className="flex-1 py-2.5 rounded-full text-sm font-medium relative"
                style={{
                  fontFamily: 'Poppins, sans-serif',
                  background: tab === t.id ? '#FF1493' : 'rgba(255,255,255,0.04)',
                  color: tab === t.id ? '#fff' : 'rgba(255,255,255,0.5)',
                  border: '1px solid rgba(255,255,255,0.08)'
                }}
                data-testid={`hub-tab-${t.id}`}>
                {t.label}
                {t.id === 'notes' && unread > 0 && (
                  <span className="absolute top-1.5 right-3 w-2 h-2 rounded-full" style={{ background: '#55efc4' }} />
                )}
              </button>
            )
          ))}
        </div>

        {tab === 'cycle' && calData && (
          <div>
            <div className="flex flex-col items-center mb-8">
              <div className="w-32 h-32 rounded-full flex flex-col items-center justify-center"
                style={{ background: `linear-gradient(135deg, ${phaseColor}40, ${phaseColor}20)`, boxShadow: `0 0 40px ${phaseColor}30` }}>
                <span className="text-white/70 text-[10px] tracking-widest uppercase" style={{ fontFamily: 'Poppins, sans-serif' }}>Day</span>
                <span className="text-5xl font-bold text-white">{calData.cycle_day}</span>
              </div>
              <h2 className="mt-4 text-xl" style={{ fontFamily: "'Poiret One', cursive", color: phaseColor }}>
                {PHASE_NAMES[calData.phase] || calData.phase}
              </h2>
              {calData.next_period_date && (
                <p className="text-[#9A8B91] text-xs mt-1" style={{ fontFamily: 'Poppins, sans-serif' }}>
                  Next period {calData.days_until_period === 0 ? 'expected today' : `in ${calData.days_until_period} days`} · {calData.next_period_date}
                </p>
              )}
              {calData.ovulation_date && (
                <p className="text-[#9A8B91] text-xs mt-1" style={{ fontFamily: 'Poppins, sans-serif' }}>
                  Ovulation around {calData.ovulation_date}
                </p>
              )}
            </div>

            {tips && (
              <>
                <div className="rounded-2xl p-5 mb-4 text-center" style={{ background: `${phaseColor}10`, border: `1px solid ${phaseColor}25` }}>
                  <p className="text-white text-base font-medium" style={{ fontFamily: 'Poppins, sans-serif' }}>{tips.headline}</p>
                </div>
                <div className="rounded-2xl p-5 mb-4 border border-white/[0.06] bg-white/[0.03]">
                  <p className="text-[10px] tracking-widest uppercase mb-2" style={{ fontFamily: 'Poppins, sans-serif', color: '#f4a7b9' }}>Conversation</p>
                  <p className="text-white text-sm leading-relaxed" style={{ fontFamily: 'Poppins, sans-serif' }}>{tips.conversation}</p>
                </div>
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
              </>
            )}
            <div className="text-center mt-6">
              <div className="flex items-center justify-center gap-1.5">
                <Shield className="w-3 h-3 text-[#6c6c8a]" />
                <span className="text-[#6c6c8a] text-[10px]" style={{ fontFamily: 'Poppins, sans-serif' }}>Her journal stays private. You only see what she chose to share.</span>
              </div>
            </div>
          </div>
        )}

        {tab === 'cycle' && !calData && (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-[#f4a7b9] animate-spin" /></div>
        )}

        {tab === 'calendar' && <CalendarTab markedDays={calData?.marked_days} />}

        {tab === 'notes' && <NotesTab token={token} currentUserId={user?.id} onUnreadChange={setUnread} />}
      </div>
    </div>
  );
}
