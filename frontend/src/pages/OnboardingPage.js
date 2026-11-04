import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import DateSelect from '../components/DateSelect';
import { ChevronRight, ChevronLeft, ChevronDown, Heart, BookOpen, Lock, Shield } from 'lucide-react';
import axios from 'axios';
import logger from '../utils/logger';
import { BRAND, HEADING_FONT, BODY_FONT } from '../lib/phases';
import { BACKDROP_OVERLAY, ONBOARDING_BG } from '../lib/backdrops';
import { ensureSignupNotifications } from '../utils/notifications';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// v64 (Angelita, Nov 4, 2026): onboarding cut down to TWO steps and
// only two real questions. She said almost half of it had to go and
// it needs to be really simple. What is left: step 1, her name and
// the privacy promise; step 2, the first day of her last period
// (with "I don't remember exactly" and "I no longer have periods"
// as the two ways out). GONE: the whole "Your situation" step (the
// seven-way list) and the partner invite code block (a partner
// enters her code in the Partner Hub instead). Her situation is
// stored as "unsure": she starts on an honest estimate and her own
// logging teaches the app, exactly as the period step tells her.
// Completing onboarding also sets her twice-a-week 9 AM reminders
// (Angelita, Nov 4, 2026): the system asks permission once, here.
const STEP_BG = { 1: ONBOARDING_BG, 2: ONBOARDING_BG };

const WHAT_IT_DOES = [
  { icon: BookOpen, text: 'Your Daily Read, written for your exact cycle day' },
  { icon: Heart, text: 'Share your cycle with someone close, only what you choose' },
  { icon: Lock, text: 'Your private Journal: your words, yours alone' },
];

const choiceClass = (active) =>
  `w-full text-left px-4 py-3 rounded-xl border transition-colors ${
    active ? 'border-[#FF4F9A] bg-[#FF4F9A]/15 text-white' : 'border-white/15 text-[#E6E0EE] hover:border-[#FF4F9A]/60'
  }`;

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [showSecurity, setShowSecurity] = useState(false);
  const [lastPeriodDate, setLastPeriodDate] = useState('');
  const [dontRemember, setDontRemember] = useState(false);
  const [noPeriods, setNoPeriods] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { token, user, updateUser } = useAuth();
  const navigate = useNavigate();
  const totalSteps = 2;

  // v61: an existing user who already finished onboarding (for
  // example after an app update) is never walked through it again.
  useEffect(() => {
    if (user && user.onboarding_complete) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  // v62: if the account already carries a name (for example an
  // account created before this step existed), start from it instead
  // of asking her to type it again.
  useEffect(() => {
    if (user?.name) setName((prev) => prev || user.name);
  }, [user]);

  const canNext =
    (step === 1 && name.trim().length > 0) ||
    (step === 2 && (noPeriods || dontRemember || !!lastPeriodDate));

  const handleComplete = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.post(`${API}/onboarding`, {
        name: name.trim(),
        last_period_date: noPeriods || dontRemember ? null : lastPeriodDate,
        cycle_status: noPeriods ? 'no_periods' : 'unsure',
        no_periods: noPeriods,
        // v55: no cycle_length is sent, ever. The server stores its
        // silent placeholder estimate and flags it as an estimate
        // until her logged starts teach the app her real length.
        partner_choice: 'later',
      }, { headers: { Authorization: `Bearer ${token}` }, timeout: 30000 });
      updateUser(res.data);
      localStorage.setItem('hormoscope-show-welcome', 'true');
      // Her 9 AM twice-a-week reminders are set at signup (her
      // order, Nov 4, 2026). The system permission prompt appears
      // once, here; a denial never blocks her from entering.
      await ensureSignupNotifications().catch(() => {});
      navigate('/');
    } catch (err) {
      logger.error('Onboarding error:', err);
      const detail = err.response?.data?.detail;
      setError(typeof detail === 'string'
        ? detail
        : err.response ? "We couldn't save your answers. Please try again." : "Couldn't reach HORMOscope. Check your connection and tap Try again.");
    } finally {
      setLoading(false);
    }
  };

  const H = ({ children }) => (
    <h2 className="text-3xl text-white text-center" style={{ fontFamily: HEADING_FONT }}>{children}</h2>
  );
  const Sub = ({ children }) => (
    <p className="text-center mt-2 text-[15px] leading-relaxed" style={{ color: BRAND.textMuted }}>{children}</p>
  );

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden" style={{ background: BRAND.bg, fontFamily: BODY_FONT }}>
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true" data-testid="onboarding-bg">
        <img key={step} src={STEP_BG[step]} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0" style={{ background: BACKDROP_OVERLAY }} />
      </div>
      <div className="w-full max-w-md relative">
        <div className="flex items-center justify-center gap-2 mb-8" aria-label={`Step ${step} of ${totalSteps}`}>
          {[1, 2].map((s) => (
            <div key={s} className="h-2 rounded-full transition-all" style={{ width: s <= step ? 36 : 20, background: s <= step ? BRAND.pink : 'rgba(255,255,255,0.15)' }} />
          ))}
        </div>

        <div className="rounded-3xl p-7 border border-white/10" style={{ background: 'rgba(21,21,43,0.92)' }}>
          {step === 1 && (
            <div className="space-y-6" data-testid="onboarding-welcome-step">
              <div className="text-center">
                <div className="mx-auto mb-5 w-24 h-24 rounded-full overflow-hidden flex items-center justify-center" style={{ background: '#000', border: '1px solid rgba(255,79,154,0.5)' }} data-testid="onboarding-logo">
                  <img src="/images/logo-wordmark.png" alt="HORMOscope" className="w-full h-full object-contain" style={{ padding: 10 }} />
                </div>
                <h1 className="text-[28px] leading-tight font-semibold" data-testid="onboarding-welcome"
                  style={{ fontFamily: BODY_FONT, color: 'rgba(255,79,154,0.12)', WebkitTextStroke: '1.4px #FF4F9A', textShadow: '0 0 18px rgba(255,79,154,0.45)' }}>
                  Welcome to your true HORMOscope
                </h1>
                <Sub>Your day, read from your own cycle.</Sub>
              </div>

              <div className="space-y-2" data-testid="onboarding-what-it-does">
                {WHAT_IT_DOES.map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-center gap-3 rounded-xl px-4 py-2.5 border border-white/10" style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <Icon className="w-4 h-4 flex-shrink-0" style={{ color: BRAND.pink }} />
                    <p className="text-[13px] leading-snug text-[#E6E0EE]">{text}</p>
                  </div>
                ))}
              </div>

              <div>
                <label className="block mb-2 text-sm text-white" htmlFor="ob-name">What should we call you?</label>
                <Input id="ob-name" data-testid="onboarding-name-input" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your first name" className="input-dark text-lg" autoFocus />
              </div>

              {/* Privacy is the number one promise: ONE proud line up
                  front, the full five points a single tap away. */}
              <div>
                <p className="flex items-start gap-2 text-[13px] leading-relaxed text-[#E6E0EE]" data-testid="onboarding-privacy-line">
                  <Shield className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: BRAND.pink }} />
                  Your data is encrypted and never sold. Nothing is shared unless you choose to share it, and only the parts you choose.
                </p>
                <button
                  type="button"
                  onClick={() => setShowSecurity(!showSecurity)}
                  className="mt-2 inline-flex items-center gap-1 text-[13px] underline"
                  style={{ color: BRAND.pink }}
                  data-testid="onboarding-security-toggle"
                  aria-expanded={showSecurity}
                >
                  See how we protect you
                  <ChevronDown className="w-3.5 h-3.5" style={{ transform: showSecurity ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                </button>
                {showSecurity && (
                  <div className="rounded-2xl p-4 border border-white/10 text-left mt-3" style={{ background: 'rgba(255,255,255,0.03)' }} data-testid="onboarding-security">
                    <p className="text-sm text-white mb-2">Your privacy is our first promise</p>
                    <ul className="space-y-1.5 text-[13px] leading-relaxed" style={{ color: BRAND.textMuted }}>
                      <li>Everything you write and log is encrypted while it travels and while it rests with us.</li>
                      <li>We keep our security updated ahead of the standard, always.</li>
                      <li>Your information is never sold. It is shared only where you choose, like with a partner you link, and only the parts you turn on.</li>
                      <li>Your password is stored scrambled, so it cannot be read in plain form, not even by us.</li>
                      <li>Your journal stays private unless you choose to share it with your partner.</li>
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6" data-testid="onboarding-period-step">
              <div>
                <H>Your last period</H>
                <Sub>When did your most recent period start? Your best guess is fine: approximate still starts your cycle, and your logging makes it exact.</Sub>
              </div>
              {!dontRemember && !noPeriods && (
                <DateSelect testId="onboarding-date-input" value={lastPeriodDate} onChange={setLastPeriodDate} minYear={new Date().getFullYear() - 1} maxYear={new Date().getFullYear()} />
              )}
              <button data-testid="onboarding-dont-remember" onClick={() => { setDontRemember(!dontRemember); setLastPeriodDate(''); setNoPeriods(false); }} className={choiceClass(dontRemember)}>
                {dontRemember ? '✓ ' : ''}I don't remember exactly
                <span className="block text-xs mt-1" style={{ color: BRAND.textMuted }}>No penalty either way. A rough guess above works, or choose this and log your next period when it starts: your predictions begin then.</span>
              </button>
              <button data-testid="onboarding-noperiods" onClick={() => { setNoPeriods(!noPeriods); setLastPeriodDate(''); setDontRemember(false); }} className={choiceClass(noPeriods)}>
                {noPeriods ? '✓ ' : ''}I no longer have periods
                <span className="block text-xs mt-1" style={{ color: BRAND.textMuted }}>No periods to predict. Your days are built from what you log instead.</span>
              </button>
              <div className="rounded-2xl p-4 border border-white/10 text-left" style={{ background: 'rgba(255,255,255,0.03)' }} data-testid="onboarding-learning-note">
                <p className="text-[13px] leading-relaxed" style={{ color: BRAND.textMuted }}>
                  That is all we need to start. At first, everything is an estimate. Log the day your period starts and the day it finishes, and HORMOscope learns your real bleeding days and your real cycle length from you, month by month. The more you log, the more accurate your predictions get.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div role="alert" data-testid="onboarding-error" className="mt-6 rounded-xl p-3 text-sm border border-red-400/40 bg-red-500/10 text-red-200">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between mt-7 pt-5 border-t border-white/10">
            {step > 1 ? (
              <button onClick={() => { setError(''); setStep(step - 1); }} className="flex items-center gap-1 text-[#E6E0EE] hover:text-white"><ChevronLeft className="w-5 h-5" /> Back</button>
            ) : <div />}
            {step < totalSteps ? (
              <Button data-testid="onboarding-next-btn" onClick={() => setStep(step + 1)} disabled={!canNext} className="rounded-full px-6 text-white" style={{ background: 'transparent', border: '1.5px solid #FF4F9A' }}>
                Next <ChevronRight className="w-5 h-5" />
              </Button>
            ) : (
              <Button data-testid="onboarding-complete-btn" onClick={handleComplete} disabled={loading || !canNext} className="rounded-full px-6 text-white" style={{ background: 'transparent', border: '1.5px solid #FF4F9A' }}>
                {loading ? 'Saving…' : error ? 'Try again' : 'Start'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
