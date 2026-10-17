import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePremium } from '../context/PremiumContext';
import { Link } from 'react-router-dom';
import { Heart, Loader2, Gift, Users, Copy, Check } from 'lucide-react';
import axios from 'axios';
import logger from '../utils/logger';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const GOLD = '#D4A853';
const PINK = '#f4a7b9';

const poppins = { fontFamily: 'Poppins, sans-serif' };
const script = { fontFamily: "'Poiret One', cursive" };

// Attunement Mode home (Angelita, Oct 16-17): its own tab, pictures of both
// kinds of couples, her circle, and the Secret Gift Shop's home base.
// Built honestly on the existing partner invite flow (POST /partner/invite,
// code accepted in the Partner Hub). The backend today links ONE person at
// a time and the inviter needs Pro to send an invite; where her full spec
// (whole circle at once, two-cycle sync for a woman partner) goes beyond
// that, the copy below says so plainly instead of pretending.
export default function AttunementPage() {
  const { token } = useAuth();
  const { isPro } = usePremium();
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
      if (err.response?.status === 402) setInviteError('pro');
      else setInviteError(err.response?.data?.detail || 'Could not create an invite just now. Try again in a moment.');
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
          <p className="text-[#9A8B91] text-xs mb-2" style={poppins}>
            Share this code with your person. They make their own free HORMOscope account, open the Attunement tab, and enter it to link with you.
          </p>
          <button onClick={copyCode} className="w-full py-3 rounded-xl text-center" style={{ background: 'rgba(255,20,147,0.08)', border: '1px dashed rgba(255,20,147,0.4)' }}>
            <span className="text-white text-xl font-bold tracking-[0.3em]" style={poppins}>{inviteCode}</span>
            <span className="flex items-center justify-center gap-1 text-[#9A8B91] text-[10px] mt-1" style={poppins}>
              {copied ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Tap to copy</>}
            </span>
          </button>
        </div>
      )}
      {inviteError === 'pro' && (
        <div className="rounded-2xl p-4 mb-4 text-center" style={{ border: `1px solid ${GOLD}40`, background: 'rgba(212,168,83,0.05)' }}>
          <p className="text-white/80 text-sm leading-relaxed mb-3" style={poppins}>
            Sending an invite is a Pro perk. Turn on Pro now to link your person right away, or it opens once your first free cycle ends and Pro begins.
          </p>
          <Link to="/pro?from=attunement" className="inline-block px-6 py-2.5 rounded-full text-white text-sm" style={{ ...script, background: 'linear-gradient(135deg, #D4A853, #c9a030)' }}>
            See HORMOscope Pro
          </Link>
        </div>
      )}
      {inviteError && inviteError !== 'pro' && (
        <p className="text-red-400 text-xs text-center mb-4" style={poppins}>{inviteError}</p>
      )}
    </>
  );

  return (
    <div className="min-h-screen pb-28 lg:pb-8 lg:pl-64 px-5 pt-8" style={{ background: 'linear-gradient(180deg, #1a1030 0%, #0f0a1a 30%, #0a0a1a 100%)' }} data-testid="attunement-page">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-full bg-[#FF1493]/15 flex items-center justify-center mx-auto mb-4">
            <Heart className="w-6 h-6 text-[#FF1493]" fill="#FF1493" />
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
          <div className="card p-5 mb-6 text-center">
            <p className="text-white text-base mb-1" style={poppins}>
              You are in tune with <span className="font-semibold" style={{ color: PINK }}>{status.partner_name}</span>
            </p>
            <p className="text-[#9A8B91] text-xs mb-4" style={poppins}>
              They can see your cycle calendar and leave you little notes. Your journal always stays private.
            </p>
            <Link to="/partner-hub" className="block w-full py-3 rounded-full text-white text-sm font-medium" style={{ ...poppins, background: '#FF1493' }}>
              Open your shared space
            </Link>
          </div>
        ) : (
          <>
            {/* Choice 1: partner is a woman */}
            <div className="card overflow-hidden mb-4" data-testid="attunement-woman">
              <img src="/images/attunement-two-women.webp" alt="Two women laughing together, foreheads touching" className="w-full h-44 object-cover" />
              <div className="p-5">
                <h2 className="text-white text-xl mb-2" style={script}>My partner is a woman</h2>
                <p className="text-[#b8b8d1] text-sm leading-relaxed mb-4" style={poppins}>
                  You track side by side, in tune with each other. Send her a sign-up link and her first cycle is free too, just like yours.
                </p>
                <button
                  onClick={() => handleInvite('woman')}
                  disabled={generating}
                  className="w-full py-3 rounded-full text-white text-sm font-medium disabled:opacity-40"
                  style={{ ...poppins, background: '#FF1493' }}
                  data-testid="invite-her-btn"
                >
                  {generating ? 'Making your link…' : 'Invite her'}
                </button>
                <p className="text-[#6c6c8a] text-[11px] mt-3 leading-relaxed" style={poppins}>
                  Today the link shares your cycle view with her. Full two-cycle syncing, where the app follows both of your cycles together, is on its way.
                </p>
              </div>
            </div>

            {/* Choice 2: partner is a man */}
            <div className="card overflow-hidden mb-4" data-testid="attunement-man">
              <img src="/images/attunement-couple.png" alt="A man and woman laughing and dancing together at golden hour" className="w-full h-44 object-cover" />
              <div className="p-5">
                <h2 className="text-white text-xl mb-2" style={script}>My partner is a man</h2>
                <p className="text-[#b8b8d1] text-sm leading-relaxed mb-4" style={poppins}>
                  He follows your cycle, so he knows when to bring tea, when to give you room, and when you are glowing. Linking him is a Pro perk: turn on Pro now to link him right away, or it opens once your first free cycle ends and Pro begins.
                </p>
                {isPro ? (
                  <button
                    onClick={() => handleInvite('man')}
                    disabled={generating}
                    className="w-full py-3 rounded-full text-white text-sm font-medium disabled:opacity-40"
                    style={{ ...poppins, background: '#FF1493' }}
                    data-testid="invite-him-btn"
                  >
                    {generating ? 'Making your link…' : 'Invite him'}
                  </button>
                ) : (
                  <Link
                    to="/pro?from=attunement"
                    className="block w-full py-3 rounded-full text-center text-white text-sm"
                    style={{ ...script, letterSpacing: '0.05em', background: 'linear-gradient(135deg, #D4A853, #c9a030)' }}
                    data-testid="invite-him-pro-btn"
                  >
                    Link him with Pro
                  </Link>
                )}
              </div>
            </div>

            {inviteBlock}

            <p className="text-center text-[#9A8B91] text-xs mb-8" style={poppins}>
              Already have an invite code from someone?{' '}
              <Link to="/partner-hub" className="underline" style={{ color: PINK }}>Enter it here</Link>
            </p>
          </>
        )}

        {/* Her circle */}
        <div className="card p-5 mb-4" data-testid="attunement-circle">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-5 h-5" style={{ color: PINK }} />
            <h2 className="text-white text-xl" style={script}>It is your circle, not just one person</h2>
          </div>
          <p className="text-[#b8b8d1] text-sm leading-relaxed mb-3" style={poppins}>
            Your partner. Your sister or brother. Your mother or father. A caregiver. A dear friend. The people who hold your life with you belong inside your cycle, and you choose every single one of them.
          </p>
          <p className="text-[#6c6c8a] text-[11px] leading-relaxed" style={poppins}>
            Right now HORMOscope links one person at a time while your whole circle is being built. Start with the person who loves you closest.
          </p>
        </div>

        {/* Secret Gift Shop: its home base lives on this tab */}
        <div className="card p-5 mb-4" data-testid="attunement-gift-shop">
          <div className="flex items-center gap-2 mb-2">
            <Gift className="w-5 h-5" style={{ color: GOLD }} />
            <h2 className="text-white text-xl" style={script}>The Secret Gift Shop</h2>
          </div>
          <p className="text-[#b8b8d1] text-sm leading-relaxed mb-4" style={poppins}>
            This is where the gift shop lives. Your people, in tune with your cycle, can send little things that land right: comfort on the hard days, care right on time, love in a box.
          </p>
          <div className="flex flex-wrap gap-2 mb-4">
            {[
              { name: 'Essentials', tagline: 'What she actually needs' },
              { name: 'Comfort', tagline: 'For the hard days' },
              { name: 'Treats', tagline: 'Because she deserves it' },
            ].map((c) => (
              <span key={c.name} className="px-3 py-1.5 rounded-full text-xs" style={{ ...poppins, border: `1px solid ${GOLD}50`, color: '#e8d9ae', background: 'rgba(212,168,83,0.06)' }}>
                {c.name} · {c.tagline}
              </span>
            ))}
          </div>
          <Link
            to="/gift-shop"
            className="block w-full py-3 rounded-full text-center text-white text-sm"
            style={{ ...script, letterSpacing: '0.05em', background: 'linear-gradient(135deg, #D4A853, #c9a030)' }}
            data-testid="open-gift-shop-btn"
          >
            Open the Secret Gift Shop
          </Link>
        </div>

        <p className="text-center text-[#6c6c8a] text-[10px] leading-relaxed" style={poppins}>
          Your journal and private entries are never shared. Your people only see what you chose to share.
        </p>
      </div>
    </div>
  );
}
