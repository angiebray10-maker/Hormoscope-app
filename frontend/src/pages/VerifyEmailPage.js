import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const { user, fetchUser } = useAuth();
  const [state, setState] = useState({ status: 'working', msg: 'Confirming your email…' });

  useEffect(() => {
    const token = params.get('token');
    if (!token) { setState({ status: 'error', msg: 'This link is missing its code.' }); return; }
    axios.post(`${API}/auth/verify-email`, { token })
      .then(async () => { setState({ status: 'ok', msg: 'Your email is confirmed. Thank you!' }); if (user) await fetchUser?.(); })
      .catch((e) => setState({ status: 'error', msg: typeof e.response?.data?.detail === 'string' ? e.response.data.detail : "We couldn't confirm your email." }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#0B0B1E', fontFamily: 'Poppins, sans-serif' }}>
      <div className="max-w-sm w-full rounded-3xl p-7 border border-white/10 text-center" style={{ background: '#15152B' }} data-testid="verify-email-page">
        <h1 className="text-2xl text-white mb-3" style={{ fontFamily: "'Poiret One', sans-serif" }}>Email confirmation</h1>
        <p className={state.status === 'error' ? 'text-red-200' : 'text-[#E6E0EE]'}>{state.msg}</p>
        <Link to="/" className="inline-block mt-6 px-6 py-2.5 rounded-full text-white" style={{ background: '#FF4F9A' }}>Open HORMOscope</Link>
      </div>
    </div>
  );
}
