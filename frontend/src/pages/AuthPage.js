import React, { useState, useRef } from 'react';
import { BACKDROPS, BACKDROP_OVERLAY } from '../lib/backdrops';
import SecurityNotice from '../components/SecurityNotice';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, ChevronDown, Shield, Check, ArrowRight, Heart, Users, Calendar, MessageCircle } from 'lucide-react';

const BRAND_FONT = "'Poiret One', sans-serif";
const HEADING_FONT = "'Poiret One', sans-serif";
const PURPLE = '#7b4fa6';
const PURPLE_LIGHT = '#c9b8f0';
const PINK = '#f4a7b9';
const PINK_SOFT = '#e8dce0';
const PINK_MUTED = '#a0a0b8';

const NEW_LOGO = '/images/logo.png';
const HERO_BG = BACKDROPS[0];
const SCENARIO_BG = BACKDROPS[1];
const SCIENCE_BG = BACKDROPS[2];
const RELATIONSHIP_BG = BACKDROPS[3];
const TRANSFORM_BG = BACKDROPS[4];


const BrandName = ({ className = '', style = {} }) => (
  <span className={className} style={{ fontFamily: BRAND_FONT, fontWeight: 400, whiteSpace: 'nowrap', color: PURPLE_LIGHT, ...style }}>HORMOscope</span>
);

export default function AuthPage() {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isLogin, setIsLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isAdult, setIsAdult] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const { login, signup } = useAuth();
  const navigate = useNavigate();
  const scienceRef = useRef(null);
  const focusRef = useRef(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const openSignup = () => { setIsLogin(false); setShowAuthModal(true); setError(''); setMobileMenuOpen(false); };
  const openLogin = () => { setIsLogin(true); setShowAuthModal(true); setError(''); setMobileMenuOpen(false); };
  const scrollTo = (ref) => { ref.current?.scrollIntoView({ behavior: 'smooth' }); setMobileMenuOpen(false); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!isLogin) {
      if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
      if (!isAdult) { setError('You must be 18 or older to use HORMOscope.'); return; }
      if (!acceptedTerms) { setError('Please agree to the Terms, Privacy Policy and health-data processing to continue.'); return; }
    }
    setLoading(true);
    try {
      const user = isLogin ? await login(email, password) : await signup(email, password, { is_adult: isAdult, accepted_terms: acceptedTerms });
      navigate(user.onboarding_complete ? '/' : '/onboarding');
    } catch (err) {
      setError(typeof err.response?.data?.detail === 'string' ? err.response.data.detail : (err.response ? 'Something went wrong. Please try again.' : 'Could not reach HORMOscope. Check your connection and try again.'));
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="min-h-screen" style={{ background: '#0B0B1E' }}>

      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-50" style={{ background: 'rgba(10,10,26,0.92)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(201,184,240,0.08)' }}>
        <div className="max-w-5xl mx-auto px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src={NEW_LOGO} alt="HORMOscope" className="w-9 h-9 rounded-full object-cover" />
            <BrandName className="text-xl" />
          </div>
          <div className="hidden sm:flex items-center gap-6">
            <button onClick={() => scrollTo(focusRef)} className="text-sm hover:text-white transition-colors" style={{ color: PINK_MUTED }}>How It Works</button>
            <button onClick={() => scrollTo(scienceRef)} className="text-sm hover:text-white transition-colors" style={{ color: PINK_MUTED }}>The Science</button>
            <button onClick={openLogin} className="text-sm hover:text-white transition-colors" style={{ color: PINK_MUTED }}>Sign In</button>
            <button onClick={openSignup} className="px-5 py-1.5 rounded-full text-white text-sm font-medium transition-all hover:shadow-lg" style={{ background: 'rgba(123,79,166,0.3)', border: '1px solid rgba(201,184,240,0.3)' }} data-testid="nav-signup-btn">Get Started</button>
          </div>
          <div className="flex sm:hidden items-center gap-3">
            <button onClick={openSignup} className="px-4 py-1.5 rounded-full text-white text-xs font-medium" style={{ background: 'rgba(123,79,166,0.3)', border: '1px solid rgba(201,184,240,0.3)' }} data-testid="nav-signup-btn-mobile">Get Started</button>
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} style={{ color: PINK }} className="p-1">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
            </button>
          </div>
        </div>
        {mobileMenuOpen && (
          <div className="sm:hidden px-5 pb-4 space-y-3 border-t border-white/5 pt-3">
            <button onClick={() => scrollTo(focusRef)} className="block text-sm" style={{ color: PINK_MUTED }}>How It Works</button>
            <button onClick={() => scrollTo(scienceRef)} className="block text-sm" style={{ color: PINK_MUTED }}>The Science</button>
            <button onClick={openLogin} className="block text-sm" style={{ color: PINK_MUTED }}>Sign In</button>
          </div>
        )}
      </nav>

      {/* HERO */}
      <section className="relative min-h-screen flex items-center pt-16">
        <div className="absolute inset-0" style={{ backgroundImage: `url(${HERO_BG})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
          <div className="absolute inset-0" style={{ background: BACKDROP_OVERLAY }} />
        </div>
        <div className="pulsating-orb" style={{ width: 190, height: 190, top: '6%', left: '-60px', background: 'radial-gradient(circle, rgba(255,79,154,0.5) 0%, rgba(255,79,154,0) 70%)' }} />
        <div className="pulsating-orb" style={{ width: 150, height: 150, bottom: '10%', right: '-40px', background: 'radial-gradient(circle, rgba(201,184,240,0.5) 0%, rgba(201,184,240,0) 70%)', animationDelay: '1.6s' }} />
        <div className="pulsating-orb" style={{ width: 110, height: 110, top: '46%', right: '12%', background: 'radial-gradient(circle, rgba(201,184,240,0.45) 0%, rgba(201,184,240,0) 70%)', animationDelay: '3.1s' }} />

        <div className="relative z-10 w-full max-w-xl mx-auto px-6 py-20 text-center sm:text-left">
          <h1 className="text-5xl sm:text-6xl text-white leading-tight mb-3" style={{ fontFamily: HEADING_FONT }} data-testid="hero-title">
            Science, not stars
          </h1>
          <p className="text-base sm:text-lg mb-5" style={{ color: PURPLE_LIGHT, fontFamily: 'Poppins, sans-serif' }} data-testid="hero-tagline">
            Not your horoscope. Your hormones.
          </p>
          <p className="text-sm sm:text-base leading-relaxed mb-8 max-w-md" style={{ color: PINK_SOFT, fontFamily: 'Poppins, sans-serif' }}>
            A daily read based on your menstrual cycle: which phase you&apos;re in and how it may shape your mood, energy and focus. Share it with your partner, or sync cycles with your girlfriend.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-3 mb-4">
            <button onClick={openSignup} data-testid="hero-cta-btn" className="w-full sm:w-auto px-8 py-3.5 rounded-full text-white font-medium text-sm tracking-wide transition-all duration-300" style={{ background: 'rgba(123,79,166,0.3)', border: '1px solid rgba(201,184,240,0.3)' }}>
              Get Started
            </button>
            <button onClick={() => scrollTo(focusRef)} className="w-full sm:w-auto px-6 py-3.5 rounded-full text-sm transition-all" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(201,184,240,0.15)', color: PINK }} data-testid="hero-secondary-btn">
              See How It Works
            </button>
          </div>
          {/* Bonus mention, inside the app only (Angelita, Oct 29,
              2026): the logo keeps its ONE tagline, so the partner mode
              rides here on the front page as a small extra line. */}
          <p className="text-xs mb-2 text-center sm:text-left" style={{ color: PURPLE_LIGHT, fontFamily: 'Poppins, sans-serif' }} data-testid="hero-bonus-line">
            Bonus: includes Attuned Partner Mode
          </p>
          <p className="text-xs flex items-center justify-center sm:justify-start gap-1.5" style={{ color: PINK_MUTED, fontFamily: 'Poppins, sans-serif' }}>
            <Shield className="w-3.5 h-3.5" /> HTTPS, hashed passwords, never sold.
          </p>
        </div>
        <button onClick={() => scrollTo(focusRef)} className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce" style={{ color: PINK_MUTED }}>
          <ChevronDown className="w-6 h-6" />
        </button>
      </section>

      {/* AUTHORITY BAR */}
      <section className="py-5 px-6" style={{ borderTop: '1px solid rgba(123,79,166,0.1)', borderBottom: '1px solid rgba(123,79,166,0.1)' }}>
        <div className="max-w-3xl mx-auto flex flex-wrap items-center justify-center gap-6 sm:gap-10">
          {[
            { icon: <Shield className="w-4 h-4" />, text: 'Rooted in biology' },
            { icon: <Users className="w-4 h-4" />, text: 'Built for couples, including same-sex couples' }
          ].map((badge) => (
            <div key={badge.text} className="flex items-center gap-2 text-xs" style={{ fontFamily: 'Poppins, sans-serif' }} data-testid={`authority-badge-${badge.text}`}>
              <span style={{ color: PURPLE_LIGHT }}>{badge.icon}</span>
              <span style={{ color: PINK_MUTED }}>{badge.text}</span>
            </div>
          ))}
        </div>
      </section>

      {/* WHAT IT IS FOR: Attuned Partner Mode, your cycle day by day,
          the private Journal book, security notice. No reviews. */}
      <section ref={focusRef} className="py-20 px-6 relative overflow-hidden">
        <div className="max-w-2xl mx-auto relative z-10 space-y-5">
          <div className="p-6 rounded-2xl" style={{ background: 'rgba(255,79,154,0.07)', border: '1px solid rgba(255,79,154,0.35)' }} data-testid="focus-attuned">
            <p className="text-xs font-medium tracking-widest uppercase mb-2" style={{ color: '#FF4F9A', fontFamily: 'Poppins, sans-serif' }}>Attuned Partner Mode</p>
            <h2 className="text-white text-2xl mb-3" style={{ fontFamily: HEADING_FONT }}>Stay in tune with the one you love</h2>
            <ul className="space-y-2 text-sm leading-relaxed" style={{ color: PINK_SOFT, fontFamily: 'Poppins, sans-serif' }}>
              <li><Check className="w-4 h-4 inline mr-2" style={{ color: '#FF4F9A' }} />Sync cycles with your girlfriend: both your phases side by side, with the days you&apos;re in sync highlighted.</li>
              <li><Check className="w-4 h-4 inline mr-2" style={{ color: '#FF4F9A' }} />Or invite your boyfriend so he knows what each phase may feel like and how to show up.</li>
              <li><Check className="w-4 h-4 inline mr-2" style={{ color: '#FF4F9A' }} />You choose exactly what they see. Your intimacy log is never shared, and your journal only if you choose to share it.</li>
            </ul>
          </div>

          <div className="p-6 rounded-2xl" style={{ background: 'rgba(201,184,240,0.06)', border: '1px solid rgba(201,184,240,0.35)' }} data-testid="focus-cycle">
            <p className="text-xs font-medium tracking-widest uppercase mb-2" style={{ color: PURPLE_LIGHT, fontFamily: 'Poppins, sans-serif' }}>Day by day</p>
            <h2 className="text-white text-2xl mb-3" style={{ fontFamily: HEADING_FONT }}>Your cycle, day by day</h2>
            <p className="text-sm leading-relaxed" style={{ color: PINK_SOFT, fontFamily: 'Poppins, sans-serif' }}>
              Track your cycle on the calendar, read your daily read, log mood and symptoms, and follow phase guides made for where you are in your cycle today.
            </p>
          </div>

          <div className="p-6 rounded-2xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.15)' }} data-testid="focus-journal">
            <p className="text-xs font-medium tracking-widest uppercase mb-2" style={{ color: PURPLE_LIGHT, fontFamily: 'Poppins, sans-serif' }}>Journal</p>
            <h2 className="text-white text-2xl mb-3" style={{ fontFamily: HEADING_FONT }}>A journal that is yours alone</h2>
            <p className="text-sm leading-relaxed mb-3" style={{ color: PINK_SOFT, fontFamily: 'Poppins, sans-serif' }}>
              Write about your day in a private book, one day per page. Your entries save to that day, so you can look back, compare days, and see your patterns over time. Your journal stays private unless you choose to share it with your partner.
            </p>
          </div>

          <SecurityNotice />
        </div>
      </section>

      {/* THE SCIENCE — Demystify How It Works */}
      <section ref={scienceRef} className="py-20 px-6 relative overflow-hidden official-doc">
        <div className="absolute inset-0" style={{ backgroundImage: `url(${SCIENCE_BG})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
          <div className="absolute inset-0" style={{ background: BACKDROP_OVERLAY }} />
        </div>
        <div className="max-w-2xl mx-auto relative z-10">
          <div className="text-center mb-14">
            <p className="text-xs font-medium tracking-widest uppercase mb-4" style={{ color: PURPLE_LIGHT, fontFamily: 'Poppins, sans-serif' }}>The science</p>
            <h2 className="text-3xl sm:text-4xl text-white mb-4" style={{ fontFamily: "'Poppins', sans-serif" }} data-testid="science-heading">
              3 questions, one full cycle of clarity.
            </h2>
            <p className="text-sm leading-relaxed max-w-lg mx-auto" style={{ color: PINK_SOFT, fontFamily: "'Poppins', sans-serif" }}>
              Every woman&apos;s cycle follows the same hormonal blueprint. We just map yours to it.
            </p>
          </div>

          {/* How the prediction works */}
          <div className="space-y-4 mb-10">
            {[
              { num: '1', title: 'Your cycle length anchors the timeline', desc: 'A 28-day cycle means ovulation is around Day 14. A 32-day cycle shifts it to Day 18. Your number tells us your map.' },
              { num: '2', title: 'Your last period date tells us where you are today', desc: 'If your period started 11 days ago, you are likely in the part of the cycle when energy often builds. Knowing where you are helps the hard days make sense.' },
              { num: '3', title: 'Known cycle patterns do the rest', desc: 'Hormones follow a familiar pattern across the cycle, rising and falling in a rhythm researchers know well. HORMOscope uses that pattern, together with what you log, to offer guidance that fits where you are. It works from your dates, so it is thoughtful guidance, never a measurement.' }
            ].map((step) => (
              <div key={step.num} className="p-5 rounded-2xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }} data-testid={`science-step-${step.num}`}>
                <div className="flex items-start gap-4">
                  <span className="text-3xl flex-shrink-0" style={{ color: 'rgba(201,184,240,0.45)', fontFamily: "'Poiret One', sans-serif" }}>{step.num}</span>
                  <div>
                    <h3 className="text-white text-base mb-1.5" style={{ fontFamily: "'Poiret One', sans-serif" }}>{step.title}</h3>
                    <p className="text-sm leading-relaxed" style={{ color: PINK_MUTED, fontFamily: "'Poppins', sans-serif" }}>{step.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center">
            <p className="text-xs leading-relaxed max-w-md mx-auto mb-6" style={{ color: PINK_MUTED, fontFamily: 'Poppins, sans-serif' }}>
              We&apos;re not reading your texts or tracking your behavior. We use your logged cycle dates to help you understand patterns and possibilities. That&apos;s it.
            </p>
            <button onClick={openSignup} className="px-8 py-3.5 rounded-full text-white font-medium text-sm transition-all" style={{ background: 'rgba(123,79,166,0.3)', border: '1px solid rgba(201,184,240,0.3)' }} data-testid="science-cta-btn">
              Try It <ArrowRight className="w-4 h-4 inline ml-1" />
            </button>
          </div>
        </div>
      </section>

      {/* TRANSFORMATION */}
      <section className="py-20 px-6 relative overflow-hidden">
        <div className="absolute inset-0" style={{ backgroundImage: `url(${TRANSFORM_BG})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
          <div className="absolute inset-0" style={{ background: BACKDROP_OVERLAY }} />
        </div>
        <div className="max-w-2xl mx-auto relative z-10">
          <div className="text-center mb-14">
            <p className="text-xs font-medium tracking-widest uppercase mb-4" style={{ color: PURPLE_LIGHT, fontFamily: 'Poppins, sans-serif' }}>The shift</p>
            <h2 className="text-3xl sm:text-4xl text-white" style={{ fontFamily: HEADING_FONT }} data-testid="transformation-heading">
              A little more <span style={{ color: PURPLE_LIGHT }}>clarity.</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="p-6 rounded-2xl border border-red-400/20 bg-black/20" data-testid="before-card">
              <p className="text-red-400 text-xs font-medium tracking-widest uppercase mb-5" style={{ fontFamily: 'Poppins, sans-serif' }}>Without <BrandName style={{ textTransform: 'none', letterSpacing: 'normal' }} /></p>
              <ul className="space-y-3">
                {['Wondering why you feel off some days', 'Beating yourself up over mood swings', 'Googling "why am I so emotional"', 'Checking your horoscope for answers', 'Feeling like something is wrong with you'].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-red-300/70 text-sm" style={{ fontFamily: 'Poppins, sans-serif' }}><span className="text-red-400/60 mt-0.5">-</span> {item}</li>
                ))}
              </ul>
            </div>
            <div className="p-6 rounded-2xl" style={{ border: '1px solid rgba(123,79,166,0.25)', background: 'rgba(123,79,166,0.04)' }} data-testid="after-card">
              <p className="text-xs font-medium tracking-widest uppercase mb-5" style={{ color: PURPLE_LIGHT, fontFamily: 'Poppins, sans-serif' }}>With <BrandName style={{ textTransform: 'none', letterSpacing: 'normal' }} /></p>
              <ul className="space-y-3">
                {['Seeing patterns in how you feel across your cycle', 'Having context for hard days instead of blaming yourself', 'Learning what your body tends to do in each phase', 'A private place to track and reflect', 'Feeling a little less alone in it'].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm" style={{ color: PINK_SOFT, fontFamily: 'Poppins, sans-serif' }}><Check className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: PURPLE_LIGHT }} /> {item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-6 relative overflow-hidden">
        <div className="absolute inset-0" style={{ backgroundImage: `url(${BACKDROPS[0]})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
          <div className="absolute inset-0" style={{ background: BACKDROP_OVERLAY }} />
        </div>
        <div className="max-w-md mx-auto relative z-10 text-center">
          <p className="text-sm tracking-[0.3em] uppercase mb-3" style={{ fontFamily: "'Poiret One', sans-serif", color: '#C9B8F0' }}>Begin</p>
          <h2 className="text-white leading-[1.1] mb-5" style={{ fontFamily: "'Poiret One', sans-serif", fontSize: 'clamp(2rem, 7vw, 3rem)' }}>
            Start tracking <br /><span style={{ color: '#C9B8F0' }}>today.</span>
          </h2>
          <p className="text-xs sm:text-sm leading-relaxed mb-7" style={{ fontFamily: HEADING_FONT, color: PINK_SOFT }}>
            Track your cycle, mood, and intimacy, with daily readings and a private journal written around your body.
          </p>
          <button onClick={openSignup} data-testid="start-cta" className="px-8 py-3.5 rounded-full text-white text-base transition-all" style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '0.05em', background: 'linear-gradient(135deg, #C9B8F0, #B7A3EA)', boxShadow: '0 0 25px rgba(201,184,240,0.3)' }}>
            Get Started
          </button>
        </div>
      </section>

      {/* MEET THE FOUNDER */}
      <section className="py-16 px-6" data-testid="meet-founder">
        <div className="max-w-xl mx-auto flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
          <img src="/founder.webp" alt="Angelita, founder of HORMOscope" width="128" height="128" loading="lazy"
            className="w-32 h-32 rounded-full object-cover flex-shrink-0"
            style={{ objectPosition: '50% 35%', border: '2px solid #FF4F9A', boxShadow: '0 0 28px rgba(255,79,154,0.3)' }} />
          <div>
            <p className="text-xs tracking-[0.2em] uppercase mb-2" style={{ color: '#C9B8F0' }}>Meet the founder</p>
            <p className="text-white text-lg leading-relaxed mb-3">I built HORMOscope after cancer forced me to finally listen to my body. You shouldn&apos;t have to get sick to start listening.</p>
            <a href="/founders-note" className="text-sm font-medium" style={{ color: '#FF4F9A' }} data-testid="founder-note-link">Read my founder&apos;s note &rarr;</a>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-20 px-6 text-center relative overflow-hidden">
        <div className="absolute inset-0" style={{ backgroundImage: `url(${BACKDROPS[1]})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
          <div className="absolute inset-0" style={{ background: BACKDROP_OVERLAY }} />
        </div>
        <div className="pulsating-orb" style={{ width: 190, height: 190, top: '6%', left: '-60px', background: 'radial-gradient(circle, rgba(255,79,154,0.5) 0%, rgba(255,79,154,0) 70%)' }} />
        <div className="pulsating-orb" style={{ width: 150, height: 150, bottom: '10%', right: '-40px', background: 'radial-gradient(circle, rgba(201,184,240,0.5) 0%, rgba(201,184,240,0) 70%)', animationDelay: '1.6s' }} />
        <div className="pulsating-orb" style={{ width: 110, height: 110, top: '46%', right: '12%', background: 'radial-gradient(circle, rgba(201,184,240,0.45) 0%, rgba(201,184,240,0) 70%)', animationDelay: '3.1s' }} />
        <div className="max-w-lg mx-auto relative z-10">
          <h2 className="text-3xl sm:text-4xl mb-4 text-white" style={{ fontFamily: HEADING_FONT }} data-testid="final-cta-heading">
            You&apos;re not crazy,<br />
            <span style={{ color: PURPLE_LIGHT, fontSize: '1.15em' }}>you&apos;re just on day 24.</span>
          </h2>
          <p className="text-sm mb-8 leading-relaxed" style={{ color: PINK_SOFT, fontFamily: HEADING_FONT }}>
            Finally know why you feel the way you feel, not because the stars said so, but because your hormones did.
          </p>
          <button onClick={openSignup} data-testid="final-cta-btn" className="px-10 py-4 rounded-full text-white font-medium text-sm tracking-wide transition-all duration-300" style={{ background: 'rgba(123,79,166,0.3)', border: '1px solid rgba(201,184,240,0.3)' }}>
            Get Started
          </button>
          <p className="text-xs mt-4 flex items-center justify-center gap-1.5" style={{ color: PINK_MUTED, fontFamily: 'Poppins, sans-serif' }}>
            <Shield className="w-3.5 h-3.5" /> HTTPS, hashed passwords, never sold.
          </p>
        </div>
      </section>

      <footer className="py-8 px-6 border-t border-white/10 text-center">
        <p className="text-xs" style={{ color: PINK_MUTED, fontFamily: 'Poppins, sans-serif' }}>&copy; {new Date().getFullYear()} <BrandName />. All rights reserved.</p>
      </footer>

      {/* AUTH MODAL */}
      {showAuthModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={() => setShowAuthModal(false)}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div className="relative w-full max-w-sm p-7 rounded-3xl border border-white/10" style={{ background: 'linear-gradient(180deg, #15152B 0%, #0B0B1E 100%)' }} onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowAuthModal(false)} className="absolute top-4 right-4 hover:text-white transition-colors text-xl" style={{ color: PINK_MUTED }} data-testid="auth-close-btn">&times;</button>
            <div className="text-center mb-6">
              <img src={NEW_LOGO} alt="HORMOscope" className="w-14 h-14 rounded-full mx-auto mb-3 object-cover" style={{ border: '1px solid rgba(139,92,246,0.2)' }} />
              <h2 className="text-2xl text-white" style={{ fontFamily: HEADING_FONT }}>{isLogin ? 'Welcome Back' : 'Get Started'}</h2>
              <p className="text-sm" style={{ color: PINK_MUTED, fontFamily: 'Poppins, sans-serif' }}>{isLogin ? 'Sign in to continue' : 'Create your account'}</p>
            </div>
            {error && <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-4 text-red-400 text-sm text-center" style={{ fontFamily: 'Poppins, sans-serif' }} data-testid="auth-error">{error}</div>}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs tracking-wider uppercase block mb-2" style={{ color: PINK_MUTED, fontFamily: 'Poppins, sans-serif' }}>Email</label>
                <input data-testid="auth-email-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" className="w-full rounded-xl px-4 py-3 text-sm text-white focus:outline-none transition-colors" style={{ background: 'rgba(123,79,166,0.08)', border: '1px solid rgba(123,79,166,0.2)', fontFamily: 'Poppins, sans-serif' }} required autoFocus />
              </div>
              <div>
                <label className="text-xs tracking-wider uppercase block mb-2" style={{ color: PINK_MUTED, fontFamily: 'Poppins, sans-serif' }}>Password</label>
                <div className="relative">
                  <input data-testid="auth-password-input" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={isLogin ? 'Your password' : 'Create a password (8+ characters)'} className="w-full rounded-xl px-4 py-3 text-sm text-white focus:outline-none pr-12 transition-colors" style={{ background: 'rgba(123,79,166,0.08)', border: '1px solid rgba(123,79,166,0.2)', fontFamily: 'Poppins, sans-serif' }} required />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 hover:text-white transition-colors" style={{ color: PINK_MUTED }}>
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {!isLogin && (
                <div className="space-y-3 text-left" style={{ fontFamily: 'Poppins, sans-serif' }}>
                  <p className="text-xs" style={{ color: PINK_MUTED }}>At least 8 characters.</p>
                  <label className="flex items-start gap-3 text-sm text-white/85 cursor-pointer">
                    <input data-testid="auth-adult-checkbox" type="checkbox" checked={isAdult} onChange={(e) => setIsAdult(e.target.checked)} className="mt-1 w-4 h-4 accent-[#FF4F9A]" />
                    <span>I am 18 or older.</span>
                  </label>
                  <label className="flex items-start gap-3 text-sm text-white/85 cursor-pointer">
                    <input data-testid="auth-consent-checkbox" type="checkbox" checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} className="mt-1 w-4 h-4 accent-[#FF4F9A]" />
                    <span>I agree to the <a href="/terms" target="_blank" rel="noreferrer" className="underline" style={{ color: PINK }}>Terms</a> and <a href="/privacy" target="_blank" rel="noreferrer" className="underline" style={{ color: PINK }}>Privacy Policy</a>, and I consent to HORMOscope processing my cycle and health data to run the app.</span>
                  </label>
                </div>
              )}
              {!isLogin && <SecurityNotice compact />}
              <button data-testid="auth-submit-btn" type="submit" disabled={loading} className="w-full py-3 rounded-full text-white font-medium text-sm tracking-wide transition-all duration-300" style={{ background: 'rgba(123,79,166,0.3)', border: '1px solid rgba(201,184,240,0.3)', fontFamily: 'Poppins, sans-serif' }}>
                {loading ? 'Please wait...' : (isLogin ? 'Sign In' : 'Create Account')}
              </button>
            </form>
            <p className="text-center text-sm mt-5" style={{ color: PINK_MUTED, fontFamily: 'Poppins, sans-serif' }}>
              {isLogin ? "Don't have an account? " : 'Already have an account? '}
              <button data-testid="auth-toggle-btn" onClick={() => { setIsLogin(!isLogin); setError(''); }} className="hover:underline font-medium" style={{ color: PINK }}>
                {isLogin ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
