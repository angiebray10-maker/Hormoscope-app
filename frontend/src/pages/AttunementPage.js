import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

import { Link } from 'react-router-dom';
import { Heart, Loader2, Share2, Copy, Check, Camera } from 'lucide-react';
import axios from 'axios';
import logger from '../utils/logger';
import CycleSync from '../components/CycleSync';
import AttunementGifts from '../components/AttunementGifts';
import { partnerViewUrl, shareInviteText, syncInviteMessage, viewInviteMessage } from '../lib/invite';

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
// v46 (Angelita, Oct 26, 2026): the OWNER picks the invite kind.
// "Sync my cycle with him" always makes a VIEW invite (a read-only
// link page, no account for him). "Sync my cycle with her" first asks
// "Does your partner get a period?": yes makes a SYNC invite (the
// code, two-way, as before); no makes a view invite like his. The
// wishlist left the checklist: it is always part of what a partner
// sees, so there is no wishlist switch anymore (the stored field
// stays, dormant).

const VIS_OPTIONS = [
  { id: 'phase', label: 'My phase and cycle day' },
  { id: 'mood_energy', label: 'My mood and energy' },
  { id: 'period_dates', label: 'When my next period is due' },
  { id: 'fertile_window', label: 'My fertile window' },
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

// The share toggles, with app-styled pink checkboxes (the raw
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
  // The invite she just created: { kind: 'sync' | 'view', code, viewToken }.
  const [invite, setInvite] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [inviteError, setInviteError] = useState(null); // 'pro' | string
  const [copied, setCopied] = useState(false);
  const [setupType, setSetupType] = useState(null); // 'man' | 'woman-sync' | 'woman-view' | 'share'
  const [womanQuestion, setWomanQuestion] = useState(false);
  const [needPhoto, setNeedPhoto] = useState(false);
  const [vis, setVis] = useState(() => ({ ...DEFAULT_VIS, ...(user?.partner_visibility || {}) }));
  const [visSaving, setVisSaving] = useState(false);
  const [visMsg, setVisMsg] = useState('');
  const [shareMsg, setShareMsg] = useState('');
  const [sentInvites, setSentInvites] = useState([]);
  const [revoking, setRevoking] = useState(false);

  const auth = { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 };

  const loadSentInvites = () => {
    if (!token) return;
    axios.get(`${API}/partner/invites/sent`, auth)
      .then((res) => setSentInvites(Array.isArray(res.data) ? res.data : []))
      .catch(() => {});
  };

  useEffect(() => {
    if (!token) { setStatus({ is_linked: false }); return; }
    axios.get(`${API}/partner/status`, { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 })
      .then((res) => setStatus(res.data))
      .catch(() => setStatus({ is_linked: false }));
    loadSentInvites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // An outstanding view link from an earlier visit (still hers to
  // share again or turn off), and the accepted invite behind a link,
  // so she can see which kind of partner she has.
  const pendingView = sentInvites.find((i) => i.status === 'pending' && i.kind === 'view' && i.view_token);
  const acceptedInvite = sentInvites.find((i) => i.status === 'accepted');

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
  // "Sync my cycle with her" detours through one question first:
  // does her partner get a period? (v46: the owner decides the kind.)
  const startSetup = (type) => {
    setInviteError(null);
    if (!hasPhoto) {
      setNeedPhoto(true);
      setSetupType(null);
      setWomanQuestion(false);
      setTimeout(() => {
        document.querySelector('[data-testid="photo-required"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 60);
      return;
    }
    setNeedPhoto(false);
    if (type === 'woman') {
      setSetupType(null);
      setWomanQuestion(true);
      setTimeout(() => {
        document.querySelector('[data-testid="woman-period-question"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 60);
      return;
    }
    setWomanQuestion(false);
    setSetupType(type);
  };

  const chooseWomanPeriods = (getsPeriods) => {
    setWomanQuestion(false);
    setSetupType(getsPeriods ? 'woman-sync' : 'woman-view');
  };

  const createInvite = async () => {
    if (generating || !setupType) return;
    setGenerating(true);
    setInviteError(null);
    try {
      // Her share choices are saved as part of creating the invite,
      // before the code or link exists, so the partner only ever sees
      // what she just picked.
      await saveVisibility();
      const bodies = {
        'man': { partner_type: 'man', kind: 'view' },
        'woman-sync': { partner_type: 'woman', kind: 'sync' },
        'woman-view': { partner_type: 'woman', kind: 'view' },
        'share': { kind: 'view' },
      };
      const res = await axios.post(`${API}/partner/invite`, bodies[setupType] || {}, auth);
      setInvite({ kind: res.data.kind || 'sync', code: res.data.invite_code, viewToken: res.data.view_token || null });
      setSetupType(null);
      setShareMsg('');
      loadSentInvites();
    } catch (err) {
      setInviteError(err.response?.data?.detail || 'Could not create an invite just now. Try again in a moment.');
      logger.error('Attunement invite error:', err);
    } finally {
      setGenerating(false);
    }
  };

  const copyText = (text) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const firstName = (user?.name || '').trim().split(/\s+/)[0] || '';

  const shareSyncInvite = async (code) => {
    const outcome = await shareInviteText(syncInviteMessage(code, firstName));
    setShareMsg(outcome === 'copied' ? 'Copied. Paste it wherever you talk to her.' : outcome === 'failed' ? "Sharing didn't open. Copy the code above and send it to her." : '');
  };

  const shareViewInvite = async (viewToken) => {
    const outcome = await shareInviteText(viewInviteMessage(partnerViewUrl(viewToken), firstName));
    setShareMsg(outcome === 'copied' ? 'Copied. Paste the link wherever you talk to them.' : outcome === 'failed' ? "Sharing didn't open. Copy the link above and send it to them." : '');
  };

  const revokeView = async () => {
    if (revoking) return;
    setRevoking(true);
    try {
      await axios.post(`${API}/partner/view-link/revoke`, {}, auth);
      setInvite(null);
      loadSentInvites();
    } catch (err) {
      logger.error('Revoke view link error:', err);
    } finally {
      setRevoking(false);
    }
  };

  const unlink = async () => {
    try {
      await axios.post(`${API}/partner/unlink`, {}, auth);
      setStatus({ is_linked: false });
      setSentInvites([]);
      loadSentInvites();
    } catch (err) {
      logger.error('Unlink error:', err);
    }
  };

  const viewLinkCard = (viewToken, testid) => (
    <div className="rounded-2xl p-4 mb-4 text-center" style={{ border: '1px solid rgba(244,167,185,0.35)', background: 'rgba(244,167,185,0.06)' }} data-testid={testid}>
      <p className="text-[#CFC3CC] text-xs mb-2" style={poppins}>
        This link opens a simple page with only what you chose to share. No app and no account needed on their side. It stops working the moment you turn it off or make a new one.
      </p>
      <button onClick={() => copyText(partnerViewUrl(viewToken))} className="w-full py-3 px-3 rounded-xl text-center" style={{ background: 'rgba(255,79,154,0.08)', border: '1px dashed rgba(255,79,154,0.4)' }}>
        <span className="text-white text-xs break-all" style={poppins}>{partnerViewUrl(viewToken)}</span>
        <span className="flex items-center justify-center gap-1 text-[#CFC3CC] text-[10px] mt-1" style={poppins}>
          {copied ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Tap to copy the link</>}
        </span>
      </button>
      <button onClick={() => shareViewInvite(viewToken)} className="w-full py-3 rounded-full text-white text-sm font-medium mt-3" style={{ ...poppins, background: '#FF4F9A' }} data-testid="share-view-invite-btn">
        Share invite
      </button>
      <button onClick={revokeView} disabled={revoking} className="w-full py-2.5 rounded-full text-sm mt-2 disabled:opacity-50" style={{ ...poppins, color: '#CFC3CC', border: '1px solid rgba(255,255,255,0.2)' }} data-testid="revoke-view-btn">
        {revoking ? 'Turning it off…' : 'Turn this link off'}
      </button>
    </div>
  );

  const inviteBlock = (
    <>
      {invite && invite.kind === 'sync' && invite.code && (
        <div className="rounded-2xl p-4 mb-4 text-center" style={{ border: '1px solid rgba(244,167,185,0.35)', background: 'rgba(244,167,185,0.06)' }} data-testid="sync-invite-result">
          <p className="text-[#CFC3CC] text-xs mb-2" style={poppins}>
            Share this code with your person. They make their own HORMOscope account, and right in onboarding they can enter it to link with you. The Attunement tab works too.
          </p>
          <button onClick={() => copyText(invite.code)} className="w-full py-3 rounded-xl text-center" style={{ background: 'rgba(255,79,154,0.08)', border: '1px dashed rgba(255,79,154,0.4)' }}>
            <span className="text-white text-xl font-bold tracking-[0.3em]" style={poppins}>{invite.code}</span>
            <span className="flex items-center justify-center gap-1 text-[#CFC3CC] text-[10px] mt-1" style={poppins}>
              {copied ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Tap to copy</>}
            </span>
          </button>
          <button onClick={() => shareSyncInvite(invite.code)} className="w-full py-3 rounded-full text-white text-sm font-medium mt-3" style={{ ...poppins, background: '#FF4F9A' }} data-testid="share-invite-btn">
            Share invite
          </button>
        </div>
      )}
      {invite && invite.kind === 'view' && invite.viewToken && viewLinkCard(invite.viewToken, 'view-invite-result')}
      {!invite && pendingView && viewLinkCard(pendingView.view_token, 'active-view-link')}
      {shareMsg && (
        <p className="text-[#E6E0EE] text-xs text-center mb-4" role="status" style={poppins}>{shareMsg}</p>
      )}
      {inviteError && !setupType && (
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
            Attunement lets your people follow your cycle with you, so care lands right on time and home feels close.
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
            {acceptedInvite && (
              <p className="text-[#B4B0C8] text-[11px] mb-4" style={poppins} data-testid="partner-kind-label">
                {acceptedInvite.partner_type === 'woman'
                  ? 'This is a sync partner: she has the app too, and you follow each other both ways.'
                  : 'This is a sync partner: they have the app, and you follow each other both ways.'}
              </p>
            )}
            <Link to="/partner-hub" className="block w-full py-3 rounded-full text-white text-sm font-medium" style={{ ...poppins, background: '#FF4F9A' }}>
              Open your shared space
            </Link>
            <button onClick={unlink} className="w-full py-2.5 rounded-full text-sm mt-3" style={{ ...poppins, color: '#CFC3CC', border: '1px solid rgba(255,255,255,0.2)' }} data-testid="unlink-btn">
              Unlink
            </button>
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
            relationship types came off; one simple share instead. Since
            v46 this makes a view invite: a read-only link page with
            only what she checked off, no account on their side.) */}
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

        {/* For a woman partner, one question comes before the
            checklist (v46): does she get a period? Yes means the
            two-way sync invite; no means a read-only view link. */}
        {womanQuestion && (
          <div className="card p-5 mb-4" data-testid="woman-period-question">
            <h2 className="text-white text-xl mb-2" style={script}>One quick question</h2>
            <p className="text-[#F7F4FA] text-base mb-2" style={poppins}>Does your partner get a period?</p>
            <p className="text-[#b8b8d1] text-sm leading-relaxed mb-4" style={poppins}>
              If she does, she joins you in the app and you follow each other both ways. If she doesn't, she gets a simple link to a page that shows only what you choose to share. No app, no account for her.
            </p>
            <button
              onClick={() => chooseWomanPeriods(true)}
              className="w-full py-3 rounded-full text-white text-sm font-medium mb-2"
              style={{ ...poppins, background: '#FF4F9A' }}
              data-testid="woman-periods-yes"
            >
              Yes, she does
            </button>
            <button
              onClick={() => chooseWomanPeriods(false)}
              className="w-full py-3 rounded-full text-sm font-medium"
              style={{ ...poppins, color: '#F7F4FA', border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.04)' }}
              data-testid="woman-periods-no"
            >
              No, she doesn't
            </button>
          </div>
        )}

        {/* Invite setup (v42, kinds added v46): the checklist comes
            BEFORE the invite exists. Her choices save with the invite
            creation, so the very first thing her partner can see is
            what she just picked here. */}
        {setupType && !invite && (
          <div className="card p-5 mb-4" data-testid="sync-setup">
            <p className="text-[#b8b8d1] text-sm leading-relaxed mb-3" style={poppins}>
              {setupType === 'man' && 'He gets a link to a simple page, no app and no account for him. First, choose what the page can show.'}
              {setupType === 'woman-sync' && 'Syncing your cycle with her. First, choose what she can see.'}
              {setupType === 'woman-view' && 'She gets a link to a simple page, no app and no account for her. First, choose what the page can show.'}
              {setupType === 'share' && 'They get a link to a simple page, no app and no account for them. First, choose what the page can show.'}
            </p>
            <VisibilityChecklist vis={vis} onToggle={toggleVis} />
            <button
              onClick={createInvite}
              disabled={generating}
              className="w-full py-3 rounded-full text-white text-sm font-medium disabled:opacity-40 mt-4"
              style={{ ...poppins, background: '#FF4F9A' }}
              data-testid="create-invite-btn"
            >
              {generating ? 'Making your invite…' : setupType === 'woman-sync' ? 'Create my invite code' : 'Create my invite link'}
            </button>
            {inviteError && (
              <p className="text-red-400 text-xs text-center mt-3" style={poppins}>{inviteError}</p>
            )}
          </div>
        )}

        {inviteBlock}

        {/* Attuned gifts (Angelita, Oct 25, 2026): her wishlist and
            the Gift Catalog live here in Attunement, in a
            tabbed section under everything else. */}
        <AttunementGifts />

        <p className="text-center text-[#B4B0C8] text-[10px] leading-relaxed" style={poppins}>
          Your journal and private entries are never shared. Your people only see what you chose to share.
        </p>
      </div>
    </div>
  );
}
