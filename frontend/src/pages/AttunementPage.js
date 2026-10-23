import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

import { Link } from 'react-router-dom';
import { Heart, Loader2, Share2, Copy, Check } from 'lucide-react';
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
// code accepted in the Partner Hub). The backend today links ONE person at
// a time; a woman invite is free, while a man invite and a no-type share
// invite keep the Pro gate; where her fuller ideas (everyone at once,
// two-cycle sync for a woman partner) go beyond that, the copy below says
// so plainly instead of pretending.
export default function AttunementPage() {
  const { token } = useAuth();

  const [status, setStatus] = useState(null);
  const [inviteCode, setInviteCode] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [inviteError, setInviteError] = useState(null); // 'pro' | string
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!token) { setStatus({ is_linked: false }); return; }
    axios.get(`${API}/partner/status`, { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 })
      .then((res) => setStatus(res.data))
      .catch(() => setStatus({ is_linked: false }));
  }, [token]);

  const handleInvite = async (partnerType) => {
    if (generating) return;
    setGenerating(true);
    setInviteError(null);
    try {
      const res = await axios.post(`${API}/partner/invite`, { partner_type: partnerType }, { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 });
      setInviteCode(res.data.invite_code);
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
      {/* Couples wallpaper (Angelita, Oct 20, 2026: swapped on her
          order): the two women cover the upper part of the page, and the
          man-and-woman couple sits lower, appearing as she scrolls down.
          Each is masked at its inner edge so they blend into each
          other, and a plum veil over both keeps the wording easy to read. */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true" data-testid="attunement-wallpaper">
        <img
          src="/images/attunement-two-women.webp"
          alt=""
          className="absolute inset-x-0 top-0 w-full object-cover"
          style={{ height: '56%', opacity: 0.28, maskImage: 'linear-gradient(180deg, black 68%, transparent 100%)', WebkitMaskImage: 'linear-gradient(180deg, black 68%, transparent 100%)' }}
        />
        <img
          src="/images/attunement-couple.png"
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
          <div className="card p-5 mb-6 text-center">
            <p className="text-white text-base mb-1" style={poppins}>
              You are in tune with <span className="font-semibold" style={{ color: PINK }}>{status.partner_name}</span>
            </p>
            <p className="text-[#CFC3CC] text-xs mb-4" style={poppins}>
              They can see your cycle calendar and leave you little notes. Your journal always stays private.
            </p>
            <Link to="/partner-hub" className="block w-full py-3 rounded-full text-white text-sm font-medium" style={{ ...poppins, background: '#FF4F9A' }}>
              Open your shared space
            </Link>
            <Link to="/partner-wishlist" className="block w-full py-3 mt-2 rounded-full text-white text-sm font-medium border border-white/20" style={poppins} data-testid="partner-wishlist-link">
              See {status.partner_name}'s Wishlist
            </Link>
          </div>
          </>
        ) : (
          <>
            {/* Choice 1: partner is a woman */}
            <div className="card overflow-hidden mb-4" data-testid="attunement-woman">
              <div className="p-5">
                <h2 className="text-white text-xl mb-2" style={script}>My partner is a woman</h2>
                <p className="text-[#b8b8d1] text-sm leading-relaxed mb-4" style={poppins}>
                  You track side by side, in tune with each other. Send her a sign-up link and she can join you here.
                </p>
                <button
                  onClick={() => handleInvite('woman')}
                  disabled={generating}
                  className="w-full py-3 rounded-full text-white text-sm font-medium disabled:opacity-40"
                  style={{ ...poppins, background: '#FF4F9A' }}
                  data-testid="invite-her-btn"
                >
                  {generating ? 'Making your link…' : 'Invite her'}
                </button>
                <p className="text-[#B4B0C8] text-[11px] mt-3 leading-relaxed" style={poppins}>
                  Once she joins and you link up, you'll both see each other's phase and day side by side, with the days you're in sync highlighted. You each choose what the other can see.
                </p>
              </div>
            </div>

            {/* Choice 2: partner is a man */}
            <div className="card overflow-hidden mb-4" data-testid="attunement-man">
              <div className="p-5">
                <h2 className="text-white text-xl mb-2" style={script}>My partner is a man</h2>
                <p className="text-[#b8b8d1] text-sm leading-relaxed mb-4" style={poppins}>
                  He follows your cycle, so he knows when to bring tea, when to give you room, and when you are glowing.
                </p>
                <button
                  onClick={() => handleInvite('man')}
                  disabled={generating}
                  className="w-full py-3 rounded-full text-white text-sm font-medium disabled:opacity-40"
                  style={{ ...poppins, background: '#FF4F9A' }}
                  data-testid="invite-him-btn"
                >
                  {generating ? 'Making your link…' : 'Invite him'}
                </button>
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
            onClick={() => handleInvite()}
            disabled={generating}
            className="w-full py-3 rounded-full text-white text-sm font-medium disabled:opacity-40 mb-3"
            style={{ ...poppins, background: '#FF4F9A' }}
            data-testid="share-cycle-btn"
          >
            {generating ? 'Making your link…' : 'Share my cycle'}
          </button>
          <p className="text-[#B4B0C8] text-[11px] leading-relaxed" style={poppins}>
            Right now HORMOscope links one person at a time, so choose the person you want closest to your cycle.
          </p>
        </div>

        {inviteBlock}

        <p className="text-center text-[#B4B0C8] text-[10px] leading-relaxed" style={poppins}>
          Your journal and private entries are never shared. Your people only see what you chose to share.
        </p>
      </div>
    </div>
  );
}
