import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useLocation } from 'react-router-dom';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Email verification card. Two modes:
// - default: a soft reminder (code entry, Verify, Resend, Later).
// - hardGate (v42 correction, Angelita, Oct 25, 2026): NO Later, no
//   skip. Onboarding renders this as a hard gate and the app routes
//   every signed-in unverified user to it before anything else.
export default function VerifyEmailBanner({ hardGate = false } = {}) {
  const { user, token, fetchUser } = useAuth();
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [hidden, setHidden] = useState(false);
  const { pathname } = useLocation();
  // v42: the banner now lives at the START of onboarding (Angelita,
  // Oct 25, 2026: verification belongs where the email is first given,
  // not on the Profile tab), so /onboarding no longer hides it. It is
  // rendered by OnboardingPage itself; /verify-email keeps its own page.
  if (!user || user.email_verified !== false || hidden || pathname === '/verify-email') return null;

  const H = { headers: { Authorization: `Bearer ${token}` } };
  const detail = (e, fb) => (typeof e.response?.data?.detail === 'string' ? e.response.data.detail : fb);
  const resend = async () => {
    setBusy(true); setMsg('');
    try { await axios.post(`${API}/auth/resend-verification`, {}, H); setMsg('Sent. Check your inbox (and spam).'); }
    catch (e) { setMsg(detail(e, "Couldn't send right now. Try again soon.")); }
    finally { setBusy(false); }
  };
  const submit = async () => {
    setBusy(true); setMsg('');
    try { await axios.post(`${API}/auth/verify-code`, { code }, H); await fetchUser?.(); setMsg('Email verified. Thank you!'); setTimeout(() => setHidden(true), 1500); }
    catch (e) { setMsg(detail(e, "That didn't work. Try again.")); }
    finally { setBusy(false); }
  };

  return (
    <div className="mx-4 mt-3 mb-1 rounded-2xl border border-[#FF4F9A]/40 p-3 text-sm relative z-[2]" style={{ background: 'rgba(255,79,154,0.08)', fontFamily: 'Poppins, sans-serif' }} data-testid="verify-email-banner" role="status">
      <p className="text-white">Please confirm your email. We sent a link and a 6-digit code to <span className="break-all">{user.email}</span>.</p>
      <div className="flex gap-2 mt-2">
        <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" placeholder="6-digit code"
          className="flex-1 min-w-0 rounded-full px-3 py-1.5 bg-white/10 text-white placeholder-white/50 outline-none" data-testid="verify-code-input" />
        <button onClick={submit} disabled={busy || code.length !== 6} className="px-4 py-1.5 rounded-full text-white disabled:opacity-50" style={{ background: '#FF4F9A' }} data-testid="verify-code-btn">Verify</button>
      </div>
      <div className="flex justify-between mt-2 text-xs">
        <button onClick={resend} disabled={busy} className="underline text-[#E6E0EE]" data-testid="verify-resend-btn">Resend email</button>
        {!hardGate && <button onClick={() => setHidden(true)} className="text-[#E6E0EE]">Later</button>}
      </div>
      {msg && <p className="text-xs mt-2 text-[#E6E0EE]">{msg}</p>}
    </div>
  );
}
