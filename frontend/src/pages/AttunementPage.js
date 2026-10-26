import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

import { Link } from 'react-router-dom';
import { Heart, Loader2, Share2, Copy, Check, Camera } from 'lucide-react';
import axios from 'axios';
import logger from '../utils/logger';
import CycleSync from '../components/CycleSync';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const GOLD = '#C9B8F0';
const PINK = '#f4a7b9';

const poppins = { fontFamily: 'Poppins, sans-serif' };
const script = { fontFamily: "'Poiret One', sans-serif" };

// Attunement Mode home (Angelita, Oct 16-17): its own tab, pictures of both
// kinds of couples, the two invite cards, and one simple share link for
// anyone else she would like (the circle list of relationship types came
// off by her word on Oct 17).
// Built honestly on the existing partner invite flow (POST /partner/invite,
// code accepted in the Partner Hub). The backend links ONE person at a
// time, and invites are free for every user (Oct 18, 2026), whatever the
// partner type.
// v42 (Angelita, Oct 25, 2026): tapping a sync card now opens a setup
// step with the "What your partner can see" checklist (moved here from
// Profile) BEFORE any invite code is created, and a profile picture is
// required before an invite can be created or accepted, so a partner
// always sees the face beside the name.

const VIS_OPTIONS = [
  { id: 'phase', label: 'My phase and cycle day' },
  { id: 'mood_energy', label: 'My mood and energy' },
  { id: 'period_dates', label: 'When my next period is due' },
  { id: 'fertile_window', label: 'My fertile window' },
  { id: 'wishlist', label: 'My wishlist' },
];
const DEFAULT_VIS = { phase: true, mood_energy: true, period_dates: true, fertile_window: false, wishlist: true };

// The face beside a partner's name. Falls back to a neutral initial
// disc for accounts that have no picture (legacy partners).
export function PartnerAvatar({ photo, name, size = 32 }) {
  if (photo) {
    return <img src={photo} alt={name || 'Partner'} className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} />;
  }
  const initial = (name || 'P').trim().charAt(0).toUpperCase() || 'P';
  return (
    <span className="rounded-full flex items-center justify-center shrink-0 text-white font-semibold" aria-hidden="true"
      style={{ width: size, height: size, background: 'linear-gradient(135deg, #FF5C8A, #8B5CF6)', fontFamily: 'Poppins, sans-serif', fontSize: Math.round(size * 0.45) }}>
      {initial}
    </span>
  );
}

// The five share toggles, with app-styled pink checkboxes (the raw
// native white squares from the old Profile form are not used here).
function VisibilityChecklist({ vis, onToggle }) {
  return (
    <div data-testid="partner-visibility">
      <h3 className="text-white text-base mb-1" style={poppins}>What your partner can see</h3>
      {VIS_OPTIONS.map((v) => {
        const on = !!vis[v.id];
        return (
          <button key={v.id} type="button" role="checkbox" aria-checked={on} data-testid={`vis-${v.id}`}
            onClick={() => onToggle(v.id, !on)}
            className="flex items-center gap-3 py-2 w-full text-left">
            <span className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-colors"
              style={{ background: on ? '#FF4F9A' : 'rgba(255,255,255,0.04)', border: `1.5px solid ${on ? '#FF4F9A' : 'rgba(255,255,255,0.35)'}` }}>
              {on && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3.5} />}
            </span>
            <span className="text-sm text-[#F7F4FA]" style={poppins}>{v.label}</span>
          </button>
        );
      })}
      <p className="text-[#E6E0EE] text-xs mt-1" style={poppins}>Your journal and intimacy log are never shared.</p>
    </div>
  );
}

// Shown instead of the sync setup when the user has no profile picture:
// no picture, no invite. The button takes her to Profile to add one.
function PhotoRequiredPrompt() {
  return (
    <div className="card p-5 mb-4 text-center" data-testid="photo-required">
      <div className="w-12 h-12 rounded-full bg-[#FF4F9A]/15 flex items-center justify-center mx-auto mb-3">
        <Camera className="w-5 h-5 text-[#FF4F9A]" />
      </div>
      <h2 className="text-white text-xl mb-2" style={script}>Add your picture first</h2>
      <p className="text-[#b8b8d1] text-sm leading-relaxed mb-4" style={poppins}>
        A profile picture is required to sync your cycle, so your partner can see who they are syncing with. Your face will sit beside your name wherever they see you, like on your wishlist.
      </p>
      <Link to="/profile" className="block w-full py-3 rounded-full text-white text-sm font-medium" style={{ ...poppins, background: '#FF4F9A' }} data-testid="photo-required-btn">
        Add my picture
      </Link>
    </div>
  );
}

export default function AttunementPage() {
  const { token, user, updateUser } = useAuth();

  const [status, setStatus] = useState(null);
  const [inviteCode, setInviteCode] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [inviteError, setInviteError] = useState(null); // 'pro' | string
  const [copied, setCopied] = useState(false);
  const [setupType, setSetupType] = useState(null); // 'man' | 'woman' | 'share'
  const [needPhoto, setNeedPhoto] = useState(false);
  const [vis, setVis] = useState(() => ({ ...DEFAULT_VIS, ...(user?.partner_visibility || {}) }));
  const [visSaving, setVisSaving] = useState(false);
  const [visMsg, setVisMsg] = useState('');

  useEffect(() => {
    if (!token) { setStatus({ is_linked: false }); return; }
    axios.get(`${API}/partner/status`, { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 })
      .then((res) => setStatus(res.data))
      .catch(() => setStatus({ is_linked: false }));
  }, [token]);

  const hasPhoto = !!(user && user.profile_photo);
  const toggleVis = (id, on) => { setVis((prev) => ({ ...prev, [id]: on })); setVisMsg(''); };

  // The checklist saves through the SAME mechanism the Profile form
  // used: PUT /profile with partner_visibility (merged server-side
  // over the defaults). Returns true when the save went through.
  const saveVisibility = async () => {
    const res = await axios.put(`${API}/profile`, { partner_visibility: vis }, { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 });
    updateUser(res.data);
    return true;
  };

  const saveVisSettings = async () => {
    if (visSaving) return;
    setVisSaving(true); setVisMsg('');
    try {
      await saveVisibility();
      setVisMsg('Saved.');
    } catch (err) {
      setVisMsg("Couldn't save. Please try again.");
      logger.error('Visibility save error:', err);
    } finally {
      setVisSaving(false);
    }
  };

  // Tapping a sync card opens the setup step (checklist first). With
  // no profile picture there is no setup: the picture prompt shows.
  const startSetup = (type) => {
    setInviteError(null);
    if (!hasPhoto) {
      setNeedPhoto(true);
      setSetupType(null);
      setTimeout(() => {
        document.querySelector('[data-testid="photo-required"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 60);
      return;
    }
    setNeedPhoto(false);
    setSetupType(type);
  };

  const createInvite = async () => {
    if (generating || !setupType) return;
    setGenerating(true);
    setInviteError(null);
    try {
      // Her share choices are saved as part of creating the invite,
      // before the code exists, so the partner only ever sees what
      // she just picked.
      await saveVisibility();
      const body = setupType === 'share' ? {} : { partner_type: setupType };
      const res = await axios.post(`${API}/partner/invite`, body, { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 });
      setInviteCode(res.data.invite_code);
      setSetupType(null);
    } catch (err) {
      setInviteError(err.response?.data?.detail || 'Could not create an invite just now. Try again in a moment.');
      logger.error('Attunement invite error:', err);
    } finally {
      setGenerating(false);
    }
  };

  const copyCode = () => {
    if (inviteCode) {
      navigator.clipboard?.writeText(inviteCode).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const inviteBlock = (
    <>
      {inviteCode && (
        <div className="rounded-2xl p-4 mb-4 text-center" style={{ border: '1px solid rgba(244,167,185,0.35)', background: 'rgba(244,167,185,0.06)' }}>
          <p className="text-[#CFC3CC] text-xs mb-2" style={poppins}>
            Share this code with your person. They make their own HORMOscope account, open the Attunement tab, and enter it to link with you.
          </p>
          <button onClick={copyCode} className="w-full py-3 rounded-xl text-center" style={{ background: 'rgba(255,79,154,0.08)', border: '1px dashed rgba(255,79,154,0.4)' }}>
            <span className="text-white text-xl font-bold tracking-[0.3em]" style={poppins}>{inviteCode}</span>
            <span className="flex items-center justify-center gap-1 text-[#CFC3CC] text-[10px] mt-1" style={poppins}>
              {copied ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Tap to copy</>}
            </span>
          </button>
        </div>
      )}
      {inviteError && (
        <p className="text-red-400 text-xs text-center mb-4" style={poppins}>{inviteError}</p>
      )}
    </>
  );

  return (
    <div className="relative min-h-screen pb-28 lg:pb-8 lg:pl-64 px-5 pt-8" style={{ background: 'linear-gradient(180deg, #15152B 0%, #0f0a1a 30%, #0B0B1E 100%)' }} data-testid="attunement-page">
      {/* Couples wallpaper (Angelita, Oct 25, 2026: swapped on her
          order): the man-and-woman couple covers the upper part of the
          page, and the two women sit lower, appearing as she scrolls down.
          Each is masked at its inner edge so they blend into each
          other, and a plum veil over both keeps the wording easy to read. */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true" data-testid="attunement-wallpaper">
        <img
          src="/images/attunement-couple.png"
          alt=""
          className="absolute inset-x-0 top-0 w-full object-cover"
          style={{ height: '56%', opacity: 0.28, maskImage: 'linear-gradient(180deg, black 68%, transparent 100%)', WebkitMaskImage: 'linear-gradient(180deg, black 68%, transparent 100%)' }}
        />
        <img
          src="/images/attunement-two-women.webp"
          alt=""
          className="absolute inset-x-0 bottom-0 w-full object-cover"
          style={{ height: '56%', opacity: 0.28, maskImage: 'linear-gradient(180deg, transparent 0%, black 32%)', WebkitMaskImage: 'linear-gradient(180deg, transparent 0%, black 32%)' }}
        />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(26,16,48,0.45) 0%, rgba(15,10,26,0.55) 45%, rgba(10,10,26,0.65) 100%)' }} />
      </div>
      <div className="relative max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-full bg-[#FF4F9A]/15 flex items-center justify-center mx-auto mb-4">
            <Heart className="w-6 h-6 text-[#FF4F9A]" fill="#FF4F9A" />
          </div>
          <p className="text-[10px] tracking-widest uppercase mb-2" style={{ ...poppins, color: PINK }}>Attunement Mode</p>
          <h1 className="text-3xl text-white mb-3" style={script}>Your people, in tune with you</h1>
          <p className="text-[#b8b8d1] text-sm leading-relaxed" style={poppins}>
            Nobody who loves you should have to guess how you feel. Attunement lets your people follow your cycle with you, so care lands right on time and home feels close.
          </p>
        </div>

        {status === null ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 text-[#f4a7b9] animate-spin" /></div>
        ) : status.is_linked ? (
          <>
          <CycleSync token={token} />
          <div className="card p-5 mb-4 text-center">
            <div className="flex items-center justify-center gap-2.5 mb-1">
              <PartnerAvatar photo={status.partner_photo} name={status.partner_name} size={30} />
              <p className="text-white text-base" style={poppins}>
                You are in tune with <span className="font-semibold" style={{ color: PINK }}>{status.partner_name}</span>
              </p>
            </div>
            <p className="text-[#CFC3CC] text-xs mb-4" style={poppins}>
              They can see your cycle calendar and leave you little notes. Your journal always stays private.
            </p>
            <Link to="/partner-hub" className="block w-full py-3 rounded-full text-white text-sm font-medium" style={{ ...poppins, background: '#FF4F9A' }}>
              Open your shared space
            </Link>
          </div>
          {/* The share choices stay changeable after linking, here in
              Attunement where the checklist now lives. */}
          <div className="card p-5 mb-6" data-testid="visibility-settings">
            <VisibilityChecklist vis={vis} onToggle={toggleVis} />
            <button onClick={saveVisSettings} disabled={visSaving}
              className="w-full py-2.5 rounded-full text-white text-sm font-medium disabled:opacity-50 mt-3"
              style={{ ...poppins, background: '#FF4F9A' }} data-testid="vis-save-btn">
              {visSaving ? 'Saving…' : 'Save'}
            </button>
            {visMsg && <p className="text-sm text-center text-[#E6E0EE] mt-2" role="status" style={poppins}>{visMsg}</p>}
          </div>
          </>
        ) : (
          <>
            {needPhoto && <PhotoRequiredPrompt />}

            {/* Choice 1: partner is a man (Angelita, Oct 25, 2026:
                the man choice comes first, headed by what she wants to
                do, not who he is) */}
            <div className="card overflow-hidden mb-4" data-testid="attunement-man">
              <div className="p-5">
                <h2 className="text-white text-xl mb-2" style={script}>Sync my cycle with him</h2>
                <p className="text-[#b8b8d1] text-sm leading-relaxed mb-4" style={poppins}>
                  He follows your cycle, so he knows when to bring tea, when to give you room, and when you are glowing.
                </p>
                <button
                  onClick={() => startSetup('man')}
                  className="w-full py-3 rounded-full text-white text-sm font-medium"
                  style={{ ...poppins, background: '#FF4F9A' }}
                  data-testid="invite-him-btn"
                >
                  Invite him
                </button>
              </div>
            </div>

            {/* Choice 2: partner is a woman */}
            <div className="card overflow-hidden mb-4" data-testid="attunement-woman">
              <div className="p-5">
                <h2 className="text-white text-xl mb-2" style={script}>Sync my cycle with her</h2>
                <p className="text-[#b8b8d1] text-sm leading-relaxed mb-4" style={poppins}>
                  You track side by side, in tune with each other. Send her a sign-up link and she can join you here.
                </p>
                <button
                  onClick={() => startSetup('woman')}
                  className="w-full py-3 rounded-full text-white text-sm font-medium"
                  style={{ ...poppins, background: '#FF4F9A' }}
                  data-testid="invite-her-btn"
                >
                  Invite her
                </button>
                <p className="text-[#B4B0C8] text-[11px] mt-3 leading-relaxed" style={poppins}>
                  Once she joins and you link up, you'll both see each other's phase and day side by side, with the days you're in sync highlighted. You each choose what the other can see.
                </p>
              </div>
            </div>

            <p className="text-center text-[#CFC3CC] text-xs mb-8" style={poppins}>
              Already have an invite code from someone?{' '}
              <Link to="/partner-hub" className="underline" style={{ color: PINK }}>Enter it here</Link>
            </p>
          </>
        )}

        {/* Share with anyone else (Angelita, Oct 17: the circle list of
            relationship types came off; one simple share link instead.
            No partner_type, so the backend's plain Pro gate applies, and
            the shared inviteBlock below shows the code or the reason.) */}
        <div className="card p-5 mb-4" data-testid="attunement-share">
          <div className="flex items-center gap-2 mb-2">
            <Share2 className="w-5 h-5" style={{ color: PINK }} />
            <h2 className="text-white text-xl" style={script}>Share your cycle</h2>
          </div>
          <p className="text-[#b8b8d1] text-sm leading-relaxed mb-4" style={poppins}>
            Share your cycle with anyone else you would like.
          </p>
          <button
            onClick={() => startSetup('share')}
            className="w-full py-3 rounded-full text-white text-sm font-medium mb-3"
            style={{ ...poppins, background: '#FF4F9A' }}
            data-testid="share-cycle-btn"
          >
            Share my cycle
          </button>
          <p className="text-[#B4B0C8] text-[11px] leading-relaxed" style={poppins}>
            Right now HORMOscope links one person at a time, so choose the person you want closest to your cycle.
          </p>
        </div>

        {/* Sync setup (v42): the checklist comes BEFORE the invite
            code exists. Her choices save with the invite creation, so
            the very first thing her partner can see is what she just
            picked here. */}
        {setupType && !inviteCode && (
          <div className="card p-5 mb-4" data-testid="sync-setup">
            <p className="text-[#b8b8d1] text-sm leading-relaxed mb-3" style={poppins}>
              {setupType === 'man' && 'Syncing your cycle with him. First, choose what he can see.'}
              {setupType === 'woman' && 'Syncing your cycle with her. First, choose what she can see.'}
              {setupType === 'share' && 'Sharing your cycle. First, choose what they can see.'}
            </p>
            <VisibilityChecklist vis={vis} onToggle={toggleVis} />
            <button
              onClick={createInvite}
              disabled={generating}
              className="w-full py-3 rounded-full text-white text-sm font-medium disabled:opacity-40 mt-4"
              style={{ ...poppins, background: '#FF4F9A' }}
              data-testid="create-invite-btn"
            >
              {generating ? 'Making your link…' : 'Create my invite code'}
            </button>
            {inviteError && (
              <p className="text-red-400 text-xs text-center mt-3" style={poppins}>{inviteError}</p>
            )}
          </div>
        )}

        {inviteBlock}

        <p className="text-center text-[#B4B0C8] text-[10px] leading-relaxed" style={poppins}>
          Your journal and private entries are never shared. Your people only see what you chose to share.
        </p>
      </div>
    </div>
  );
}
