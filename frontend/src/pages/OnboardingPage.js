import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import DateSelect from '../components/DateSelect';
import VerifyEmailBanner from '../components/VerifyEmailBanner';
import { ChevronRight, ChevronLeft, Bell, BellOff, Heart, Users, Clock, Shield } from 'lucide-react';
import axios from 'axios';
import logger from '../utils/logger';
import { syncLocalNotifications } from '../utils/localNotifications';
import { BRAND, HEADING_FONT, BODY_FONT } from '../lib/phases';
import { BACKDROPS, BACKDROP_OVERLAY } from '../lib/backdrops';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Onboarding redesign (Orio launch fixes), extended in v46: 6 steps.
// invite -> name -> last period -> cycle -> partner -> reminders.
// The invite step is new in v46 (Angelita, Oct 26, 2026): a woman who
// was invited by her partner enters the sync code here and links
// before her own questions begin. View invites are links, not codes,
// and never reach this step.
// Birthday moved to Profile (optional). "I don't remember" is stored as
// unknown; we never invent a date. "I no longer have periods" (Feature
// B) stores the no_periods flag and skips every cycle estimate.
// Backdrop rotation (Angelita's set, Oct 26, 2026): at-home couple first
// and again at step 4, then hallway, laughing couple, sunset, bed + dog.
const STEP_BG = { 1: BACKDROPS[0], 2: BACKDROPS[1], 3: BACKDROPS[2], 4: BACKDROPS[0], 5: BACKDROPS[3], 6: BACKDROPS[4] };

const SITUATIONS = [
  { id: 'regular', label: 'I get a period', hint: 'Set my usual length below' },
  { id: 'unsure', label: "Not sure how long my cycle is", hint: "We'll start at 28 days and learn as you log" },
  { id: 'hormonal_birth_control', label: "I'm on hormonal birth control", hint: 'Fertility predictions stay off' },
  { id: 'pregnant', label: "I'm pregnant", hint: 'Fertility predictions stay off' },
  { id: 'postpartum', label: 'Postpartum / breastfeeding', hint: 'Fertility predictions stay off' },
  { id: 'menopause', label: 'Perimenopause or menopause', hint: 'Fertility predictions stay off' },
  { id: 'no_periods', label: 'I no longer have periods', hint: 'Your days are built from what you log' },
];

const VISIBILITY = [
  { id: 'phase', label: 'My phase and cycle day' },
  { id: 'mood_energy', label: 'My mood and energy' },
  { id: 'period_dates', label: 'When my next period is due' },
  { id: 'fertile_window', label: 'My fertile window' },
  // v49 (Angelita, Oct 26, 2026): journal sharing by choice, off
  // unless she ticks it, linked partners in the app only.
  { id: 'share_journal', label: 'My journal entries' },
];

const TIMES = [
  { time: '07:00', label: '7 AM' }, { time: '09:00', label: '9 AM' }, { time: '12:00', label: '12 PM' },
  { time: '18:00', label: '6 PM' }, { time: '20:00', label: '8 PM' }, { time: '22:00', label: '10 PM' },
];

const choiceClass = (active) =>
  `w-full text-left px-4 py-3 rounded-xl border transition-colors ${
    active ? 'border-[#FF4F9A] bg-[#FF4F9A]/15 text-white' : 'border-white/15 text-[#E6E0EE] hover:border-[#FF4F9A]/60'
  }`;

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [lastPeriodDate, setLastPeriodDate] = useState('');
  const [dontRemember, setDontRemember] = useState(false);
  const [noPeriods, setNoPeriods] = useState(false);
  const [situation, setSituation] = useState('regular');
  const [cycleLength, setCycleLength] = useState(28);
  const [partnerChoice, setPartnerChoice] = useState('later');
  const [visibility, setVisibility] = useState({ phase: true, mood_energy: true, period_dates: true, fertile_window: false, wishlist: true, share_journal: false });
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [notificationTime, setNotificationTime] = useState('09:00');
  // v49: the two cycle alerts are their own choices on the reminders
  // step, not riders on the daily reminder. Both start ticked, shown
  // plainly, and she can untick either. What she chooses is what gets
  // scheduled, nothing else.
  const [periodAlert, setPeriodAlert] = useState(true);
  const [ovulationAlert, setOvulationAlert] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Invite step state (v46): 'yes' opens the code field; a successful
  // accept records who she linked with and unlocks Next.
  const [invitedChoice, setInvitedChoice] = useState(null); // 'yes' | 'no'
  const [inviteCode, setInviteCode] = useState('');
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteLinked, setInviteLinked] = useState(null); // partner name
  const { token, user, updateUser } = useAuth();
  const navigate = useNavigate();
  const totalSteps = 6;

  const effSituation = noPeriods ? 'no_periods' : situation;
  const pickSituation = (id) => {
    if (id === 'no_periods') { setNoPeriods(true); return; }
    setNoPeriods(false);
    setSituation(id);
  };

  // Already linked? The invite step has nothing to ask her: record
  // the link for the confirmation line and move her to the name step.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    axios.get(`${API}/partner/status`, { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 })
      .then((res) => {
        if (!cancelled && res.data?.is_linked) {
          setInviteLinked(res.data.partner_name || 'your partner');
          setInvitedChoice('yes');
          setStep((s) => (s === 1 ? 2 : s));
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
    (step === 1 && (invitedChoice === 'no' || !!inviteLinked)) ||
    (step === 2 && name.trim().length > 0) ||
    (step === 3 && (noPeriods || dontRemember || !!lastPeriodDate)) ||
    step >= 4;

  const handleComplete = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.post(`${API}/onboarding`, {
        name: name.trim(),
        last_period_date: noPeriods || dontRemember ? null : lastPeriodDate,
        cycle_status: effSituation,
        no_periods: effSituation === 'no_periods',
        cycle_length: effSituation === 'regular' ? cycleLength : 28,
        partner_choice: partnerChoice,
        partner_visibility: visibility,
        notifications_enabled: notificationsEnabled,
        notification_time: notificationTime,
        notification_preferences: { period_reminder: periodAlert, ovulation_reminder: ovulationAlert },
      }, { headers: { Authorization: `Bearer ${token}` }, timeout: 30000 });
      updateUser(res.data);
      localStorage.setItem('hormoscope-notifications-enabled', notificationsEnabled ? 'true' : 'false');
      localStorage.setItem('hormoscope-notification-time', notificationTime);
      localStorage.setItem('hormoscope-notifications-period', periodAlert ? 'true' : 'false');
      localStorage.setItem('hormoscope-notifications-ovulation', ovulationAlert ? 'true' : 'false');
      if (notificationsEnabled || periodAlert || ovulationAlert) {
        // v43: on-device local notifications replace the old Web Push
        // subscription (which could never deliver inside the Android
        // WebView). Permission is requested here, in context, right
        // after she chose her reminder time. No-op on web builds.
        try { await syncLocalNotifications({ user: res.data, token, requestPermission: true }); } catch (notifErr) { logger.error('Local notification setup failed during onboarding:', notifErr); }
      }
      localStorage.setItem('hormoscope-show-welcome', 'true');
      navigate(partnerChoice === 'later' ? '/' : '/attunement');
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
      <div className="w-full max-w-md relative">
        <div className="flex items-center justify-center gap-2 mb-8" aria-label={`Step ${step} of ${totalSteps}`}>
          {[1, 2, 3, 4, 5, 6].map((s) => (
            <div key={s} className="h-2 rounded-full transition-all" style={{ width: s <= step ? 36 : 20, background: s <= step ? BRAND.pink : 'rgba(255,255,255,0.15)' }} />
          ))}
        </div>

        <div className="rounded-3xl p-7 border border-white/10" style={{ background: 'rgba(21,21,43,0.92)' }}>
          {step === 1 && (
            <div className="space-y-6" data-testid="onboarding-invite-step">
              <div>
                <H>Were you invited by your partner?</H>
                <Sub>If she sent you an invite code, enter it here and you will be linked before anything else. If nobody sent you one, just say no and continue.</Sub>
              </div>
              {inviteLinked ? (
                <div className="rounded-xl p-4 border border-[#FF4F9A]/40 text-center" style={{ background: 'rgba(255,79,154,0.08)' }} data-testid="onboarding-invite-linked">
                  <p className="text-white text-[15px]">You're linked with {inviteLinked}.</p>
                  <p className="text-xs mt-1" style={{ color: BRAND.textMuted }}>Now let's set up your own side.</p>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <button data-testid="onboarding-invited-yes" onClick={() => { setInvitedChoice('yes'); setInviteError(''); }} className={choiceClass(invitedChoice === 'yes')}>
                      {invitedChoice === 'yes' ? '✓ ' : ''}Yes, I have a code
                    </button>
                    <button data-testid="onboarding-invited-no" onClick={() => { setInvitedChoice('no'); setInviteError(''); }} className={choiceClass(invitedChoice === 'no')}>
                      {invitedChoice === 'no' ? '✓ ' : ''}No, I'm starting on my own
                    </button>
                  </div>
                  {invitedChoice === 'yes' && (
                    <div className="space-y-3">
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
                      <button data-testid="onboarding-invite-skip" onClick={() => { setInvitedChoice('no'); setInviteError(''); }} className="w-full text-center text-sm underline" style={{ color: BRAND.textMuted }}>
                        Continue without linking
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="mx-auto mb-5 w-24 h-24 rounded-full overflow-hidden flex items-center justify-center" style={{ background: '#000', border: '1px solid rgba(255,79,154,0.5)' }} data-testid="onboarding-logo">
                  <img src="/images/logo.png" alt="HORMOscope" className="w-full h-full object-contain" style={{ padding: 10 }} />
                </div>
                <h1 className="text-[28px] leading-tight font-semibold" data-testid="onboarding-welcome"
                  style={{ fontFamily: BODY_FONT, color: 'rgba(255,79,154,0.12)', WebkitTextStroke: '1.4px #FF4F9A', textShadow: '0 0 18px rgba(255,79,154,0.45)' }}>
                  Welcome to your true HORMOscope
                </h1>
                <Sub>Your cycle, decoded daily, and shared only with the people you choose.</Sub>
              </div>
              <div>
                <label className="block mb-2 text-sm text-white" htmlFor="ob-name">What should we call you?</label>
                <Input id="ob-name" data-testid="onboarding-name-input" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your first name" className="input-dark text-lg" autoFocus />
              </div>
              {/* Privacy is the number one promise (Angelita, Oct 26, 2026):
                  onboarding states ALL of the security measures plainly,
                  the same promise the front page makes. */}
              <div className="rounded-2xl p-4 border border-white/10 text-left" style={{ background: 'rgba(255,255,255,0.03)' }} data-testid="onboarding-security">
                <p className="flex items-center gap-2 text-sm text-white mb-2">
                  <Shield className="w-4 h-4 flex-shrink-0" style={{ color: BRAND.pink }} />
                  Your privacy is our first promise
                </p>
                <ul className="space-y-1.5 text-[13px] leading-relaxed" style={{ color: BRAND.textMuted }}>
                  <li>Everything you write and log is encrypted while it travels and while it rests with us.</li>
                  <li>We keep our security updated ahead of the standard, always.</li>
                  <li>Your information is never sold and never shared. Not with advertisers, not with anyone, not even with a partner you link.</li>
                  <li>Your password is stored scrambled, so it cannot be read in plain form, not even by us.</li>
                  <li>Your journal stays private unless you choose to share it with your partner.</li>
                </ul>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div>
                <H>Your last period</H>
                <Sub>When did your most recent period start?</Sub>
              </div>
              {!dontRemember && !noPeriods && (
                <DateSelect testId="onboarding-date-input" value={lastPeriodDate} onChange={setLastPeriodDate} minYear={new Date().getFullYear() - 1} maxYear={new Date().getFullYear()} />
              )}
              <button data-testid="onboarding-dont-remember" onClick={() => { setDontRemember(!dontRemember); setLastPeriodDate(''); setNoPeriods(false); }} className={choiceClass(dontRemember)}>
                {dontRemember ? '✓ ' : ''}I don't remember
                <span className="block text-xs mt-1" style={{ color: BRAND.textMuted }}>No problem. Log your next period when it starts and your predictions will begin then.</span>
              </button>
              <button data-testid="onboarding-noperiods" onClick={() => { setNoPeriods(!noPeriods); setLastPeriodDate(''); setDontRemember(false); }} className={choiceClass(noPeriods)}>
                {noPeriods ? '✓ ' : ''}I no longer have periods
                <span className="block text-xs mt-1" style={{ color: BRAND.textMuted }}>No periods to predict. Your days are built from what you log instead.</span>
              </button>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5">
              <div>
                <H>Your cycle</H>
                <Sub>Pick what's true for you right now.</Sub>
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

          {step === 5 && (
            <div className="space-y-5">
              <div>
                <H>Stay attuned together</H>
                <Sub>Share your cycle with someone you love. They only see what you tick below. Your intimacy log is never shared, and your journal only if you tick it.</Sub>
              </div>
              <div className="space-y-2">
                {[
                  { id: 'invite_partner', icon: Heart, label: 'Invite my partner', hint: 'They follow your cycle and get tips for each phase' },
                  { id: 'sync_girlfriend', icon: Users, label: 'Sync cycles with my girlfriend', hint: 'You both track and see each other side by side' },
                  { id: 'later', icon: ChevronRight, label: 'Maybe later', hint: 'You can do this any time from Profile' },
                ].map(({ id, icon: Icon, label, hint }) => (
                  <button key={id} data-testid={`onboarding-partner-${id}`} onClick={() => setPartnerChoice(id)} className={`${choiceClass(partnerChoice === id)} flex items-start gap-3`}>
                    <Icon className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: BRAND.pink }} />
                    <span>{label}<span className="block text-xs mt-0.5" style={{ color: BRAND.textMuted }}>{hint}</span></span>
                  </button>
                ))}
              </div>
              {partnerChoice !== 'later' && (
                <div className="rounded-xl p-4 border border-white/10" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <p className="text-sm text-white mb-3">What can they see?</p>
                  {VISIBILITY.map((v) => (
                    <label key={v.id} className="flex items-center gap-3 py-1.5 text-sm text-[#E6E0EE] cursor-pointer">
                      <input type="checkbox" data-testid={`onboarding-vis-${v.id}`} checked={!!visibility[v.id]} onChange={(e) => setVisibility({ ...visibility, [v.id]: e.target.checked })} className="w-4 h-4 accent-[#FF4F9A]" />
                      {v.label}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 6 && (
            <div className="space-y-5">
              <div>
                <H>Your reminders</H>
                <Sub>Choose the notes you want from us. Only the ones you tick will ever be sent, and you can change your mind any time in Profile.</Sub>
              </div>
              <div>
                <p className="text-sm text-white mb-2">Your Daily Read reminder</p>
                <div className="grid grid-cols-2 gap-2">
                  <button data-testid="onboarding-notify-yes" onClick={() => setNotificationsEnabled(true)} className={`${choiceClass(notificationsEnabled)} flex items-center gap-2`}><Bell className="w-5 h-5" /> Yes please</button>
                  <button data-testid="onboarding-notify-no" onClick={() => setNotificationsEnabled(false)} className={`${choiceClass(!notificationsEnabled)} flex items-center gap-2`}><BellOff className="w-5 h-5" /> No thanks</button>
                </div>
                <p className="text-xs mt-1.5" style={{ color: BRAND.textMuted }}>A short note each day about your phase and how you might feel.</p>
              </div>
              {notificationsEnabled && (
                <div>
                  <p className="text-sm text-white mb-2 flex items-center gap-2"><Clock className="w-4 h-4" style={{ color: BRAND.pink }} /> What time?</p>
                  <div className="grid grid-cols-3 gap-2">
                    {TIMES.map(({ time, label }) => (
                      <button key={time} onClick={() => setNotificationTime(time)} className="py-2 rounded-lg text-sm" style={notificationTime === time ? { background: BRAND.pink, color: '#fff' } : { background: 'rgba(255,255,255,0.06)', color: BRAND.textMuted }}>{label}</button>
                    ))}
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <label className="flex items-start gap-3 rounded-xl border border-white/15 px-4 py-3 cursor-pointer">
                  <input type="checkbox" data-testid="onboarding-notify-period" checked={periodAlert} onChange={(e) => setPeriodAlert(e.target.checked)} className="w-4 h-4 mt-0.5 accent-[#FF4F9A]" />
                  <span className="text-sm text-[#E6E0EE]">Period coming
                    <span className="block text-xs mt-0.5" style={{ color: BRAND.textMuted }}>A gentle note the evening before your period is estimated to start.</span>
                  </span>
                </label>
                <label className="flex items-start gap-3 rounded-xl border border-white/15 px-4 py-3 cursor-pointer">
                  <input type="checkbox" data-testid="onboarding-notify-ovulation" checked={ovulationAlert} onChange={(e) => setOvulationAlert(e.target.checked)} className="w-4 h-4 mt-0.5 accent-[#FF4F9A]" />
                  <span className="text-sm text-[#E6E0EE]">Ovulation week starting
                    <span className="block text-xs mt-0.5" style={{ color: BRAND.textMuted }}>A note the morning your ovulation week is estimated to begin.</span>
                  </span>
                </label>
              </div>
              <p className="text-xs" style={{ color: BRAND.textMuted }}>You can change any of this later in Profile.</p>
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
