import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import DateSelect from '../components/DateSelect';
import VerifyEmailBanner from '../components/VerifyEmailBanner';
import { ChevronRight, ChevronLeft, ChevronDown, Heart, BookOpen, Lock, Gift, Shield, KeyRound } from 'lucide-react';
import axios from 'axios';
import logger from '../utils/logger';
import { BRAND, HEADING_FONT, BODY_FONT } from '../lib/phases';
import { BACKDROP_OVERLAY, ONBOARDING_BG } from '../lib/backdrops';
import FallingFlowers from '../components/FallingFlowers';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Slim onboarding (Angelita, Oct 26, 2026, v50): fewer questions, show
// what the app does, and get her to her cycle day fast. Three steps:
// welcome (what HORMOscope does, her name, the privacy promise in one
// proud line with the full text a tap away, an optional partner code)
// -> last period (approximate is fine, no penalty) -> cycle ("I'm not
// sure" first; the estimate starts at 28 and her logging makes it
// exact). Then she lands on Home on her cycle day.
//
// What moved OUT, by her order: the standalone security step (folded
// into step 1 above), the sharing checklist step (the checklist lives
// ONLY in Attunement now, where it runs before invite creation), and
// the reminders step (Home carries one dismissible reminders card
// instead; the backend fields stay optional and are simply no longer
// collected here). "I no longer have periods" keeps its off-ramp on
// the period step exactly as before. Birthday stays in Profile.
const STEP_BG = { 1: ONBOARDING_BG, 2: ONBOARDING_BG, 3: ONBOARDING_BG };

const WHAT_IT_DOES = [
  { icon: BookOpen, text: 'Your Daily Read, written for your exact cycle day' },
  { icon: Heart, text: 'Attuned Partner Mode: share your cycle, only what you choose' },
  { icon: Lock, text: 'Your private Journal and Vault: your words, yours alone' },
  { icon: Gift, text: 'A gift catalog, so you can build a wishlist your partner can see' },
];

// "I'm not sure" sits FIRST and equal (Angelita, Oct 26, 2026): she
// starts on a 28 day estimate and the app gets exact from her logging.
// The other situations still switch fertility predictions off, exactly
// as before.
const SITUATIONS = [
  { id: 'unsure', label: "I'm not sure", hint: "We'll start with a 28 day estimate, and your logging makes it exact" },
  { id: 'regular', label: 'I get a period', hint: 'Set my usual length below' },
  { id: 'hormonal_birth_control', label: "I'm on hormonal birth control", hint: 'Fertility predictions stay off' },
  { id: 'pregnant', label: "I'm pregnant", hint: 'Fertility predictions stay off' },
  { id: 'postpartum', label: 'Postpartum / breastfeeding', hint: 'Fertility predictions stay off' },
  { id: 'menopause', label: 'Perimenopause or menopause', hint: 'Fertility predictions stay off' },
  { id: 'no_periods', label: 'I no longer have periods', hint: 'Your days are built from what you log' },
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
  const [situation, setSituation] = useState('unsure');
  const [cycleLength, setCycleLength] = useState(28);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Optional partner code on the welcome step (v50): closed unless
  // she opens it; a successful accept records who she linked with.
  const [showCode, setShowCode] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteLinked, setInviteLinked] = useState(null); // partner name
  const { token, user, updateUser } = useAuth();
  const navigate = useNavigate();
  const totalSteps = 3;

  const effSituation = noPeriods ? 'no_periods' : situation;
  const pickSituation = (id) => {
    if (id === 'no_periods') { setNoPeriods(true); return; }
    setNoPeriods(false);
    setSituation(id);
  };

  // Already linked? Nothing to ask her: the welcome step simply shows
  // who she is linked with.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    axios.get(`${API}/partner/status`, { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 })
      .then((res) => {
        if (!cancelled && res.data?.is_linked) {
          setInviteLinked(res.data.partner_name || 'your partner');
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const acceptInvite = async () => {
    const code = inviteCode.trim().toUpperCase();
    if (!code || inviteBusy) return;
    setInviteBusy(true);
    setInviteError('');
    try {
      const res = await axios.post(`${API}/partner/accept-invite`, { invite_code: code }, { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 });
      setInviteLinked(res.data.linked_to || 'your partner');
    } catch (err) {
      setInviteError(err.response?.data?.detail || "That code didn't work. Check it and try again, or continue without linking.");
      logger.error('Onboarding invite accept error:', err);
    } finally {
      setInviteBusy(false);
    }
  };

  // The verification gate (v42) also catches EXISTING accounts that
  // finished onboarding long ago but never verified (ProtectedRoute
  // sends them here). Remember whether this user ARRIVED already
  // complete: once she verifies, she goes straight home instead of
  // being walked through onboarding again. A new user arrives with
  // onboarding_complete false, so this never fires mid-onboarding.
  const arrivedComplete = useRef(null);
  useEffect(() => {
    if (user && arrivedComplete.current === null) {
      arrivedComplete.current = !!user.onboarding_complete;
    }
  }, [user]);
  useEffect(() => {
    if (user && user.email_verified !== false && arrivedComplete.current && user.onboarding_complete) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  const canNext =
    (step === 1 && name.trim().length > 0) ||
    (step === 2 && (noPeriods || dontRemember || !!lastPeriodDate)) ||
    step >= 3;

  const handleComplete = async () => {
    setLoading(true);
    setError('');
    try {
      // Only the essentials are sent. partner_visibility and the
      // notification fields stay OPTIONAL in the backend contract:
      // the checklist lives in Attunement, and reminders are set from
      // the Home card or Profile, so nothing is collected here.
      const res = await axios.post(`${API}/onboarding`, {
        name: name.trim(),
        last_period_date: noPeriods || dontRemember ? null : lastPeriodDate,
        cycle_status: effSituation,
        no_periods: effSituation === 'no_periods',
        cycle_length: effSituation === 'regular' ? cycleLength : 28,
        partner_choice: 'later',
      }, { headers: { Authorization: `Bearer ${token}` }, timeout: 30000 });
      updateUser(res.data);
      localStorage.setItem('hormoscope-show-welcome', 'true');
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

  // HARD GATE (v42 correction, Angelita, Oct 25, 2026): an unverified
  // user sees ONLY this panel. Code entry, Verify, and Resend email;
  // no Later, no skip, no steps, no way forward until the email is
  // verified. The banner's Verify calls fetchUser, so the moment the
  // account verifies, this gate lifts on its own: a new user lands on
  // step 1 below, and an existing user is sent home by the effect
  // above. Once verified it never shows again.
  if (user && user.email_verified === false) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden" style={{ background: BRAND.bg, fontFamily: BODY_FONT }}>
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true" data-testid="onboarding-bg">
          <img src={STEP_BG[1]} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: BACKDROP_OVERLAY }} />
        </div>
        <FallingFlowers />
        <div className="w-full max-w-md relative">
          <div className="rounded-3xl p-7 border border-white/10" style={{ background: 'rgba(21,21,43,0.92)' }} data-testid="verify-gate">
            <div className="text-center mb-2">
              <div className="mx-auto mb-5 w-24 h-24 rounded-full overflow-hidden flex items-center justify-center" style={{ background: '#000', border: '1px solid rgba(255,79,154,0.5)' }}>
                <img src="/images/logo.png" alt="HORMOscope" className="w-full h-full object-contain" style={{ padding: 10 }} />
              </div>
              <h1 className="text-2xl text-white" style={{ fontFamily: HEADING_FONT }}>Confirm your email</h1>
              <p className="text-center mt-2 text-[15px] leading-relaxed" style={{ color: BRAND.textMuted }}>
                One quick step before you start. Enter the 6-digit code we sent you, and you are in.
              </p>
            </div>
            <div className="-mx-4 empty:hidden">
              <VerifyEmailBanner hardGate />
            </div>
          </div>
        </div>
      </div>
    );
  }

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
      <FallingFlowers />
      <div className="w-full max-w-md relative">
        <div className="flex items-center justify-center gap-2 mb-8" aria-label={`Step ${step} of ${totalSteps}`}>
          {[1, 2, 3].map((s) => (
            <div key={s} className="h-2 rounded-full transition-all" style={{ width: s <= step ? 36 : 20, background: s <= step ? BRAND.pink : 'rgba(255,255,255,0.15)' }} />
          ))}
        </div>

        <div className="rounded-3xl p-7 border border-white/10" style={{ background: 'rgba(21,21,43,0.92)' }}>
          {step === 1 && (
            <div className="space-y-6" data-testid="onboarding-welcome-step">
              <div className="text-center">
                <div className="mx-auto mb-5 w-24 h-24 rounded-full overflow-hidden flex items-center justify-center" style={{ background: '#000', border: '1px solid rgba(255,79,154,0.5)' }} data-testid="onboarding-logo">
                  <img src="/images/logo.png" alt="HORMOscope" className="w-full h-full object-contain" style={{ padding: 10 }} />
                </div>
                <h1 className="text-[28px] leading-tight font-semibold" data-testid="onboarding-welcome"
                  style={{ fontFamily: BODY_FONT, color: 'rgba(255,79,154,0.12)', WebkitTextStroke: '1.4px #FF4F9A', textShadow: '0 0 18px rgba(255,79,154,0.45)' }}>
                  Welcome to your true HORMOscope
                </h1>
                <Sub>Science, not stars. Your day, read from your own cycle.</Sub>
              </div>

              {/* What HORMOscope does: the glimpse comes before the
                  questions (Angelita, Oct 26, 2026). */}
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

              {/* Privacy is the number one promise (Angelita, Oct 26,
                  2026): ONE proud line up front, the full five points
                  a single tap away. */}
              <div>
                <p className="flex items-start gap-2 text-[13px] leading-relaxed text-[#E6E0EE]" data-testid="onboarding-privacy-line">
                  <Shield className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: BRAND.pink }} />
                  Your data is encrypted, never sold, never shared, not even with a partner. Your journal is yours.
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
                      <li>Your information is never sold and never shared. Not with advertisers, not with anyone, not even with a partner you link.</li>
                      <li>Your password is stored scrambled, so it cannot be read in plain form, not even by us.</li>
                      <li>Your journal stays private unless you choose to share it with your partner.</li>
                    </ul>
                  </div>
                )}
              </div>

              {/* Optional partner code: there if she was invited,
                  invisible pressure if she was not. */}
              {inviteLinked ? (
                <div className="rounded-xl p-4 border border-[#FF4F9A]/40 text-center" style={{ background: 'rgba(255,79,154,0.08)' }} data-testid="onboarding-invite-linked">
                  <p className="text-white text-[15px]">You're linked with {inviteLinked}.</p>
                  <p className="text-xs mt-1" style={{ color: BRAND.textMuted }}>Now let's set up your own side.</p>
                </div>
              ) : showCode ? (
                <div className="space-y-3" data-testid="onboarding-invite-block">
                  <div>
                    <label className="block mb-2 text-sm text-white" htmlFor="ob-invite-code">Her invite code</label>
                    <Input id="ob-invite-code" data-testid="onboarding-invite-code" type="text" value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value.toUpperCase().slice(0, 8))}
                      placeholder="8 characters" className="input-dark text-lg uppercase" autoFocus />
                  </div>
                  <Button data-testid="onboarding-invite-accept" onClick={acceptInvite} disabled={inviteBusy || inviteCode.trim().length < 4} className="w-full rounded-full text-white" style={{ background: BRAND.pink }}>
                    {inviteBusy ? 'Linking…' : 'Link us'}
                  </Button>
                  {inviteError && (
                    <div role="alert" data-testid="onboarding-invite-error" className="rounded-xl p-3 text-sm border border-red-400/40 bg-red-500/10 text-red-200">
                      {inviteError}
                    </div>
                  )}
                  <button data-testid="onboarding-invite-skip" onClick={() => { setShowCode(false); setInviteError(''); }} className="w-full text-center text-sm underline" style={{ color: BRAND.textMuted }}>
                    Continue without linking
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowCode(true)}
                  className="w-full inline-flex items-center justify-center gap-2 text-[13px]"
                  style={{ color: BRAND.textMuted }}
                  data-testid="onboarding-invite-open"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span className="underline">I have a partner invite code</span>
                </button>
              )}
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
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5" data-testid="onboarding-cycle-step">
              <div>
                <H>Your cycle</H>
                <Sub>Pick what's true for you right now. Not knowing is a perfectly good answer here.</Sub>
              </div>
              <div className="space-y-2">
                {SITUATIONS.map((o) => (
                  <button key={o.id} data-testid={`onboarding-situation-${o.id}`} onClick={() => pickSituation(o.id)} className={choiceClass(effSituation === o.id)}>
                    {effSituation === o.id ? '✓ ' : ''}{o.label}
                    <span className="block text-xs mt-0.5" style={{ color: BRAND.textMuted }}>{o.hint}</span>
                  </button>
                ))}
              </div>
              {effSituation === 'regular' && (
                <div className="pt-2">
                  <label htmlFor="ob-cycle" className="flex justify-between text-sm text-white mb-2">
                    <span>About how long is your cycle?</span>
                    <span data-testid="onboarding-cycle-value" style={{ color: BRAND.pink }}>{cycleLength} days</span>
                  </label>
                  <input id="ob-cycle" data-testid="onboarding-cycle-slider" type="range" min={21} max={40} step={1} value={cycleLength} onChange={(e) => setCycleLength(Number(e.target.value))} className="w-full accent-[#FF4F9A]" />
                  <div className="flex justify-between text-xs" style={{ color: BRAND.textMuted }}><span>21</span><span>40</span></div>
                  <p className="text-xs mt-2" style={{ color: BRAND.textMuted }}>From the first day of one period to the day before the next. Most are 24 to 35 days.</p>
                </div>
              )}
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
              <Button data-testid="onboarding-next-btn" onClick={() => setStep(step + 1)} disabled={!canNext} className="rounded-full px-6 text-white" style={{ background: BRAND.pink }}>
                Next <ChevronRight className="w-5 h-5" />
              </Button>
            ) : (
              <Button data-testid="onboarding-complete-btn" onClick={handleComplete} disabled={loading} className="rounded-full px-6 text-white" style={{ background: BRAND.pink }}>
                {loading ? 'Saving…' : error ? 'Try again' : 'Start'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
