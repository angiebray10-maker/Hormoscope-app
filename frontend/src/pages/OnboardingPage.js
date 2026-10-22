import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import DateSelect from '../components/DateSelect';
import { ChevronRight, ChevronLeft, Bell, BellOff, Heart, Users, Clock } from 'lucide-react';
import axios from 'axios';
import logger from '../utils/logger';
import { subscribeToPush } from '../utils/pushNotifications';
import { BRAND, HEADING_FONT, BODY_FONT } from '../lib/phases';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Onboarding redesign (Orio launch fixes): 5 short steps.
// name -> last period -> cycle -> partner -> reminders.
// Birthday moved to Profile (optional). "I don't remember" is stored as
// unknown; we never invent a date.
const STEP_BG = {
  1: '/images/backdrop-couple-1.webp',
  2: '/images/backdrop-couple-2.webp',
  3: '/images/backdrop-couple-3.webp',
  4: '/images/backdrop-couple-1.webp',
  5: '/images/backdrop-couple-2.webp',
};

const SITUATIONS = [
  { id: 'regular', label: 'I get a period', hint: 'Set my usual length below' },
  { id: 'unsure', label: "Not sure how long my cycle is", hint: "We'll start at 28 days and learn as you log" },
  { id: 'hormonal_birth_control', label: "I'm on hormonal birth control", hint: 'Fertility predictions stay off' },
  { id: 'pregnant', label: "I'm pregnant", hint: 'Fertility predictions stay off' },
  { id: 'postpartum', label: 'Postpartum / breastfeeding', hint: 'Fertility predictions stay off' },
  { id: 'menopause', label: 'Perimenopause or menopause', hint: 'Fertility predictions stay off' },
];

const VISIBILITY = [
  { id: 'phase', label: 'My phase and cycle day' },
  { id: 'mood_energy', label: 'My mood and energy' },
  { id: 'period_dates', label: 'When my next period is due' },
  { id: 'fertile_window', label: 'My fertile window' },
  { id: 'wishlist', label: 'My wishlist' },
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
  const [situation, setSituation] = useState('regular');
  const [cycleLength, setCycleLength] = useState(28);
  const [partnerChoice, setPartnerChoice] = useState('later');
  const [visibility, setVisibility] = useState({ phase: true, mood_energy: true, period_dates: true, fertile_window: false, wishlist: true });
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [notificationTime, setNotificationTime] = useState('09:00');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { token, updateUser } = useAuth();
  const navigate = useNavigate();
  const totalSteps = 5;

  const canNext =
    (step === 1 && name.trim().length > 0) ||
    (step === 2 && (dontRemember || !!lastPeriodDate)) ||
    step >= 3;

  const handleComplete = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.post(`${API}/onboarding`, {
        name: name.trim(),
        last_period_date: dontRemember ? null : lastPeriodDate,
        cycle_status: situation,
        cycle_length: situation === 'regular' ? cycleLength : 28,
        partner_choice: partnerChoice,
        partner_visibility: visibility,
        notifications_enabled: notificationsEnabled,
        notification_time: notificationTime,
      }, { headers: { Authorization: `Bearer ${token}` }, timeout: 30000 });
      updateUser(res.data);
      localStorage.setItem('hormoscope-notifications-enabled', notificationsEnabled ? 'true' : 'false');
      localStorage.setItem('hormoscope-notification-time', notificationTime);
      if (notificationsEnabled) {
        try { await subscribeToPush(token); } catch (pushErr) { logger.error('Push subscription failed during onboarding:', pushErr); }
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
        <div className="absolute inset-0" style={{ background: 'rgba(11,11,30,0.84)' }} />
      </div>
      <div className="w-full max-w-md relative">
        <div className="flex items-center justify-center gap-2 mb-8" aria-label={`Step ${step} of ${totalSteps}`}>
          {[1, 2, 3, 4, 5].map((s) => (
            <div key={s} className="h-2 rounded-full transition-all" style={{ width: s <= step ? 36 : 20, background: s <= step ? BRAND.pink : 'rgba(255,255,255,0.15)' }} />
          ))}
        </div>

        <div className="rounded-3xl p-7 border border-white/10" style={{ background: 'rgba(21,21,43,0.92)' }}>
          {step === 1 && (
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
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div>
                <H>Your last period</H>
                <Sub>When did your most recent period start?</Sub>
              </div>
              {!dontRemember && (
                <DateSelect testId="onboarding-date-input" value={lastPeriodDate} onChange={setLastPeriodDate} minYear={new Date().getFullYear() - 1} maxYear={new Date().getFullYear()} />
              )}
              <button data-testid="onboarding-dont-remember" onClick={() => { setDontRemember(!dontRemember); setLastPeriodDate(''); }} className={choiceClass(dontRemember)}>
                {dontRemember ? '✓ ' : ''}I don't remember
                <span className="block text-xs mt-1" style={{ color: BRAND.textMuted }}>No problem. Log your next period when it starts and your predictions will begin then.</span>
              </button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div>
                <H>Your cycle</H>
                <Sub>Pick what's true for you right now.</Sub>
              </div>
              <div className="space-y-2">
                {SITUATIONS.map((o) => (
                  <button key={o.id} data-testid={`onboarding-situation-${o.id}`} onClick={() => setSituation(o.id)} className={choiceClass(situation === o.id)}>
                    {situation === o.id ? '✓ ' : ''}{o.label}
                    <span className="block text-xs mt-0.5" style={{ color: BRAND.textMuted }}>{o.hint}</span>
                  </button>
                ))}
              </div>
              {situation === 'regular' && (
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

          {step === 4 && (
            <div className="space-y-5">
              <div>
                <H>Stay attuned together</H>
                <Sub>Share your cycle with someone you love. They only see what you tick below. Your journal and intimacy log are never shared.</Sub>
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

          {step === 5 && (
            <div className="space-y-5">
              <div>
                <H>Daily reminder</H>
                <Sub>A short note each day about your phase and how you might feel.</Sub>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button data-testid="onboarding-notify-yes" onClick={() => setNotificationsEnabled(true)} className={`${choiceClass(notificationsEnabled)} flex items-center gap-2`}><Bell className="w-5 h-5" /> Yes please</button>
                <button data-testid="onboarding-notify-no" onClick={() => setNotificationsEnabled(false)} className={`${choiceClass(!notificationsEnabled)} flex items-center gap-2`}><BellOff className="w-5 h-5" /> No thanks</button>
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
