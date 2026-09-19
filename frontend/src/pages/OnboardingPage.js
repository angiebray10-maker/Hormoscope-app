import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Calendar, Moon, Sparkles, ChevronRight, ChevronLeft, Cake, Bell, BellOff, Clock } from 'lucide-react';
import axios from 'axios';
import logger from '../utils/logger';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const LOGO_URL = "/logo192.png";

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [birthday, setBirthday] = useState('');
  const [cycleLength, setCycleLength] = useState(28);
  const [lastPeriodDate, setLastPeriodDate] = useState('');
  const [notSure, setNotSure] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [notificationTime, setNotificationTime] = useState('09:00');
  const [loading, setLoading] = useState(false);
  const { token, updateUser } = useAuth();
  const navigate = useNavigate();

  const handleComplete = async () => {
    setLoading(true);
    try {
      const res = await axios.post(`${API}/onboarding`, {
        name,
        birthday,
        cycle_length: notSure ? 28 : cycleLength,
        last_period_date: lastPeriodDate
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      updateUser(res.data);
      navigate('/');
    } catch (err) {
      logger.error('Onboarding error:', err);
    } finally {
      setLoading(false);
    }
  };

  const totalSteps = 4;

  return (
    <div className="min-h-screen bg-[#05050A] stars-bg flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-10">
          {[1, 2, 3, 4, 5].map((s) => (
            <div
              key={s}
              className={`h-2 rounded-full transition-all duration-300 ${
                s <= step ? 'w-10 bg-gradient-to-r from-[#ff8fab] to-[#ffc2d1]' : 'w-6 bg-[#12121A]'
              }`}
            />
          ))}
        </div>

        {/* Step Content */}
        <div className="glass-card p-8">
          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-[#1a1a2e] mb-4">
                  <img src={LOGO_URL} alt="horMoscope" className="w-16 h-16 object-contain" />
                </div>
                <h2 className="text-2xl font-semibold text-[#F5F5F5]" >
                  What&apos;s your name?
                </h2>
                <p className="text-[#A0A0A0] mt-2">Let&apos;s personalize your experience</p>
              </div>
              <div>
                <Label className="text-[#A0A0A0] mb-2 block">Your Name</Label>
                <Input
                  data-testid="onboarding-name-input"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                  className="input-dark text-center text-lg"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#12121A] border border-[#ff8fab]/30 mb-4">
                  <Cake className="w-8 h-8 text-[#ff8fab]" />
                </div>
                <h2 className="text-2xl font-semibold text-[#F5F5F5]" >
                  When&apos;s your birthday?
                </h2>
                <p className="text-[#A0A0A0] mt-2">We&apos;ll celebrate with you!</p>
              </div>
              <div>
                <Label className="text-[#A0A0A0] mb-2 block">Birthday</Label>
                <Input
                  data-testid="onboarding-birthday-input"
                  type="date"
                  value={birthday}
                  onChange={(e) => setBirthday(e.target.value)}
                  className="input-dark"
                  max={new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#12121A] border border-[#ff8fab]/30 mb-4">
                  <Calendar className="w-8 h-8 text-[#ff8fab]" />
                </div>
                <h2 className="text-2xl font-semibold text-[#F5F5F5]" >
                  Your Cycle Length
                </h2>
                <p className="text-[#A0A0A0] mt-2">Average is 28 days</p>
              </div>
              <div>
                <Label className="text-[#A0A0A0] mb-2 block">Days in your cycle</Label>
                {!notSure ? (
                  <>
                    <div className="flex items-center justify-center gap-4">
                      <button
                        onClick={() => setCycleLength(Math.max(21, cycleLength - 1))}
                        className="w-12 h-12 rounded-full bg-[#12121A] border border-[#ff8fab]/30 text-[#ff8fab] hover:bg-[#ff8fab]/10"
                      >
                        -
                      </button>
                      <span className="text-4xl font-bold text-[#F5F5F5] w-20 text-center">{cycleLength}</span>
                      <button
                        onClick={() => setCycleLength(Math.min(35, cycleLength + 1))}
                        className="w-12 h-12 rounded-full bg-[#12121A] border border-[#ff8fab]/30 text-[#ff8fab] hover:bg-[#ff8fab]/10"
                      >
                        +
                      </button>
                    </div>
                    <p className="text-center text-[#505050] text-sm mt-4">Normal range: 21-35 days</p>
                  </>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-[#ff8fab] text-lg">We'll use 28 days as default</p>
                    <p className="text-[#505050] text-sm mt-2">This is average - you can update anytime</p>
                  </div>
                )}
                <button
                  onClick={() => setNotSure(!notSure)}
                  className={`w-full mt-4 py-3 rounded-lg border transition-colors ${
                    notSure 
                      ? 'border-[#ff8fab] bg-[#ff8fab]/10 text-[#ff8fab]' 
                      : 'border-[#12121A] text-[#A0A0A0] hover:border-[#ff8fab]/50'
                  }`}
                >
                  {notSure ? "✓ I'm not sure" : "I'm not sure"}
                </button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#12121A] border border-[#7B1E30]/50 mb-4">
                  <Moon className="w-8 h-8 text-[#7B1E30]" />
                </div>
                <h2 className="text-2xl font-semibold text-[#F5F5F5]" >
                  Last Period Start
                </h2>
                <p className="text-[#A0A0A0] mt-2">When did your last period begin?</p>
              </div>
              <div>
                <Label className="text-[#A0A0A0] mb-2 block">Date</Label>
                <Input
                  data-testid="onboarding-date-input"
                  type="date"
                  value={lastPeriodDate}
                  onChange={(e) => setLastPeriodDate(e.target.value)}
                  className="input-dark"
                  max={new Date().toISOString().split('T')[0]}
                />
                <button
                  onClick={() => {
                    // Set to approximately 2 weeks ago as estimate
                    const twoWeeksAgo = new Date();
                    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
                    setLastPeriodDate(twoWeeksAgo.toISOString().split('T')[0]);
                  }}
                  className="w-full mt-4 py-3 rounded-lg border border-[#12121A] text-[#A0A0A0] hover:border-[#ff8fab]/50 hover:text-[#ff8fab] transition-colors"
                >
                  I'm not sure - estimate for me
                </button>
                {lastPeriodDate && (
                  <p className="text-center text-[#505050] text-sm mt-3">
                    You can always update this later
                  </p>
                )}
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#12121A] border border-[#ff8fab]/30 mb-4">
                  <Bell className="w-8 h-8 text-[#ff8fab]" />
                </div>
                <h2 className="text-2xl font-semibold text-[#F5F5F5]">
                  Daily Check-ins
                </h2>
                <p className="text-[#A0A0A0] mt-2">
                  Want us to send you a quick daily update about how you're feeling and what's going on in your body?
                </p>
              </div>

              {/* Enable/Disable Toggle */}
              <div className="space-y-4">
                <button
                  onClick={() => setNotificationsEnabled(true)}
                  className={`w-full p-4 rounded-xl border transition-all flex items-center gap-4 ${
                    notificationsEnabled
                      ? 'border-[#ff8fab] bg-[#ff8fab]/10'
                      : 'border-[#12121A] hover:border-[#ff8fab]/50'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    notificationsEnabled ? 'bg-[#ff8fab]/20' : 'bg-[#12121A]'
                  }`}>
                    <Bell className={`w-6 h-6 ${notificationsEnabled ? 'text-[#ff8fab]' : 'text-[#A0A0A0]'}`} />
                  </div>
                  <div className="text-left flex-1">
                    <p className={`font-medium ${notificationsEnabled ? 'text-[#ff8fab]' : 'text-[#F5F5F5]'}`}>
                      Yes, keep me updated!
                    </p>
                    <p className="text-[#A0A0A0] text-sm">Get daily insights about your cycle</p>
                  </div>
                  {notificationsEnabled && (
                    <div className="w-6 h-6 rounded-full bg-[#ff8fab] flex items-center justify-center">
                      <span className="text-white text-sm">✓</span>
                    </div>
                  )}
                </button>

                <button
                  onClick={() => setNotificationsEnabled(false)}
                  className={`w-full p-4 rounded-xl border transition-all flex items-center gap-4 ${
                    !notificationsEnabled
                      ? 'border-[#A0A0A0] bg-[#12121A]'
                      : 'border-[#12121A] hover:border-[#A0A0A0]/50'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    !notificationsEnabled ? 'bg-[#A0A0A0]/20' : 'bg-[#12121A]'
                  }`}>
                    <BellOff className={`w-6 h-6 ${!notificationsEnabled ? 'text-[#A0A0A0]' : 'text-[#505050]'}`} />
                  </div>
                  <div className="text-left flex-1">
                    <p className={`font-medium ${!notificationsEnabled ? 'text-[#A0A0A0]' : 'text-[#F5F5F5]'}`}>
                      No thanks
                    </p>
                    <p className="text-[#505050] text-sm">I'll check the app when I want</p>
                  </div>
                  {!notificationsEnabled && (
                    <div className="w-6 h-6 rounded-full bg-[#A0A0A0] flex items-center justify-center">
                      <span className="text-white text-sm">✓</span>
                    </div>
                  )}
                </button>
              </div>

              {/* Time Picker - only show if notifications enabled */}
              {notificationsEnabled && (
                <div className="mt-6 p-4 rounded-xl bg-[#12121A] border border-[#ff8fab]/20">
                  <div className="flex items-center gap-3 mb-3">
                    <Clock className="w-5 h-5 text-[#ff8fab]" />
                    <p className="text-[#F5F5F5] font-medium">What time works best?</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { time: '07:00', label: '7 AM' },
                      { time: '09:00', label: '9 AM' },
                      { time: '12:00', label: '12 PM' },
                      { time: '18:00', label: '6 PM' },
                      { time: '20:00', label: '8 PM' },
                      { time: '22:00', label: '10 PM' },
                    ].map(({ time, label }) => (
                      <button
                        key={time}
                        onClick={() => setNotificationTime(time)}
                        className={`py-2 px-3 rounded-lg text-sm transition-all ${
                          notificationTime === time
                            ? 'bg-[#ff8fab] text-white'
                            : 'bg-[#1a1a2e] text-[#A0A0A0] hover:bg-[#ff8fab]/20 hover:text-[#ff8fab]'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[#505050] text-xs mt-3 text-center">
                    You can change this anytime in settings
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-[#12121A]">
            {step > 1 ? (
              <button
                onClick={() => setStep(step - 1)}
                className="flex items-center gap-2 text-[#A0A0A0] hover:text-[#F5F5F5]"
              >
                <ChevronLeft className="w-5 h-5" /> Back
              </button>
            ) : (
              <div />
            )}
            
            {step < totalSteps ? (
              <Button
                data-testid="onboarding-next-btn"
                onClick={() => setStep(step + 1)}
                disabled={(step === 1 && !name) || (step === 2 && !birthday) || (step === 4 && !lastPeriodDate)}
                className="btn-gold flex items-center gap-2"
              >
                Next <ChevronRight className="w-5 h-5" />
              </Button>
            ) : (
              <Button
                data-testid="onboarding-complete-btn"
                onClick={handleComplete}
                disabled={loading}
                className="btn-gold"
              >
                {loading ? 'Setting up...' : 'Start Tracking'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
