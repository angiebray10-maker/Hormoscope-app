import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, ChevronDown, Shield, Check, ArrowRight, Star, Heart, Users, Award, Zap, Calendar, MessageCircle } from 'lucide-react';

const BRAND_FONT = "'Poiret One', cursive";
const HEADING_FONT = "'Poiret One', cursive";
const PURPLE = '#7b4fa6';
const PURPLE_LIGHT = '#c9b8f0';
const PINK = '#f4a7b9';
const PINK_SOFT = '#e8dce0';
const PINK_MUTED = '#a0a0b8';

const NEW_LOGO = '/images/logo.png';
const HERO_BG = '/images/hero-bg.png';
const SCENARIO_BG = '/images/scenario-bg.jpeg';
const SCIENCE_BG = '/images/science-bg.jpeg';
const RELATIONSHIP_BG = '/images/relationship-bg.jpeg';
const TRANSFORM_BG = '/images/transform-bg.jpeg';
const TESTIMONIAL_BG = '/images/testimonial-bg.jpeg';

const COUPLE_IMG = '/images/couple.jpg';
const REVIEWER_1_IMG = 'https://images.unsplash.com/photo-1548544507-7de0e7a931d6?w=200&h=200&fit=crop&crop=face';
const REVIEWER_2_IMG = 'https://images.unsplash.com/photo-1768651925930-1680767d92df?w=200&h=200&fit=crop&crop=face';
const REVIEWER_3_IMG = 'https://images.unsplash.com/photo-1765648684671-db09402b2d48?w=200&h=200&fit=crop&crop=face';

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
  const { login, signup } = useAuth();
  const navigate = useNavigate();
  const scienceRef = useRef(null);
  const scenariosRef = useRef(null);
  const testimonialsRef = useRef(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const openSignup = () => { setIsLogin(false); setShowAuthModal(true); setError(''); setMobileMenuOpen(false); };
  const openLogin = () => { setIsLogin(true); setShowAuthModal(true); setError(''); setMobileMenuOpen(false); };
  const scrollTo = (ref) => { ref.current?.scrollIntoView({ behavior: 'smooth' }); setMobileMenuOpen(false); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = isLogin ? await login(email, password) : await signup(email, password);
      navigate(user.onboarding_complete ? '/' : '/onboarding');
    } catch (err) {
      setError(err.response?.data?.detail || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const testimonials = [
    { name: 'Jessica & Marcus', quote: "I love the calendar tab where you can put a heart on the days you have been intimate and it also shows you in green the days you are most fertile (ovulation) and when your next period is coming. It's been so easy now to know when to plan for our date nights and I know when to buy some new lingerie! It's so cool how on point and accurate it is, my god. Everyone should download this app. It's just amazing. Well done. Thank you so much.", stars: 5, img: COUPLE_IMG },
    { name: 'Mia T.', quote: "Honestly I downloaded this not expecting much but I'm kind of obsessed now? It told me I'd have low energy on Thursday and I literally couldn't get off the couch. Now I plan my busy days around my high energy phases and it's made such a difference.", stars: 5, img: REVIEWER_1_IMG },
    { name: 'Daniella R.', quote: "My partner kept asking me why I was so moody and I never had an answer. Now I can literally show him what phase I'm in and he actually gets it. Our arguments have gone way down. This app gave us a whole new way to communicate.", stars: 5, img: REVIEWER_2_IMG },
    { name: 'Priya K.', quote: "I used to have no idea why some weeks I felt unstoppable and other weeks I could barely function. Now I check the app every morning and plan my whole week around it. This app actually gives useful advice too, not just generic stuff. This app gets it.", stars: 5, img: REVIEWER_3_IMG }
  ];

  return (
    <div className="min-h-screen" style={{ background: '#0a0a1a' }}>

      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-50" style={{ background: 'rgba(10,10,26,0.92)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(201,184,240,0.08)' }}>
        <div className="max-w-5xl mx-auto px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src={NEW_LOGO} alt="HORMOscope" className="w-9 h-9 rounded-full object-cover" />
            <BrandName className="text-xl" />
          </div>
          <div className="hidden sm:flex items-center gap-6">
            <button onClick={() => scrollTo(scenariosRef)} className="text-sm hover:text-white transition-colors" style={{ color: PINK_MUTED }}>How It Works</button>
            <button onClick={() => scrollTo(scienceRef)} className="text-sm hover:text-white transition-colors" style={{ color: PINK_MUTED }}>The Science</button>
            <button onClick={() => scrollTo(testimonialsRef)} className="text-sm hover:text-white transition-colors" style={{ color: PINK_MUTED }}>Stories</button>
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
            <button onClick={() => scrollTo(scenariosRef)} className="block text-sm" style={{ color: PINK_MUTED }}>How It Works</button>
            <button onClick={() => scrollTo(scienceRef)} className="block text-sm" style={{ color: PINK_MUTED }}>The Science</button>
            <button onClick={() => scrollTo(testimonialsRef)} className="block text-sm" style={{ color: PINK_MUTED }}>Stories</button>
            <button onClick={openLogin} className="block text-sm" style={{ color: PINK_MUTED }}>Sign In</button>
          </div>
        )}
      </nav>

      {/* HERO */}
      <section className="relative min-h-screen flex items-center pt-16">
        <div className="absolute inset-0" style={{ backgroundImage: `url(${HERO_BG})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
          <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(10,10,26,0.6) 0%, rgba(10,10,26,0.45) 40%, rgba(10,10,26,0.75) 100%)' }} />
        </div>
        <div className="relative z-10 w-full max-w-xl mx-auto px-6 py-20 text-center sm:text-left">
          <p className="text-xs font-medium tracking-widest uppercase mb-4" style={{ color: PURPLE_LIGHT }} data-testid="hero-eyebrow">Science, Not Stars</p>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl text-white leading-tight mb-5" style={{ fontFamily: HEADING_FONT }} data-testid="hero-title">
            Not your horoscope. <span style={{ color: PURPLE_LIGHT }}>Your hormones.</span>
          </h1>
          <p className="text-sm sm:text-base leading-relaxed mb-8 max-w-md" style={{ color: PINK_SOFT, fontFamily: HEADING_FONT }}>
            Daily personalized hormonal readings rooted in science — not astrology. See exactly what your body is doing today, which of the 4 phases you&apos;re in, and how it&apos;s shaping your mood, energy and focus.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-3 mb-4">
            <button onClick={openSignup} data-testid="hero-cta-btn" className="w-full sm:w-auto px-8 py-3.5 rounded-full text-white font-medium text-sm tracking-wide transition-all duration-300" style={{ background: 'rgba(123,79,166,0.3)', border: '1px solid rgba(201,184,240,0.3)' }}>
              Get Started Free
            </button>
            <button onClick={() => scrollTo(scenariosRef)} className="w-full sm:w-auto px-6 py-3.5 rounded-full text-sm transition-all" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(201,184,240,0.15)', color: PINK }} data-testid="hero-secondary-btn">
              See How It Works
            </button>
          </div>
          <p className="text-xs flex items-center justify-center sm:justify-start gap-1.5" style={{ color: PINK_MUTED, fontFamily: 'Poppins, sans-serif' }}>
            <Shield className="w-3.5 h-3.5" /> One full cycle free. No credit card needed.
          </p>
        </div>
        <button onClick={() => scrollTo(scenariosRef)} className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce" style={{ color: PINK_MUTED }}>
          <ChevronDown className="w-6 h-6" />
        </button>
      </section>

      {/* AUTHORITY BAR */}
      <section className="py-5 px-6" style={{ borderTop: '1px solid rgba(123,79,166,0.1)', borderBottom: '1px solid rgba(123,79,166,0.1)' }}>
        <div className="max-w-3xl mx-auto flex flex-wrap items-center justify-center gap-6 sm:gap-10">
          {[
            { icon: <Zap className="w-4 h-4" />, text: 'Daily mood forecasts' },
            { icon: <Shield className="w-4 h-4" />, text: 'Rooted in biology' },
            { icon: <Users className="w-4 h-4" />, text: 'For all women' },
            { icon: <Award className="w-4 h-4" />, text: 'Science, not stars' }
          ].map((badge) => (
            <div key={badge.text} className="flex items-center gap-2 text-xs" style={{ fontFamily: 'Poppins, sans-serif' }} data-testid={`authority-badge-${badge.text}`}>
              <span style={{ color: PURPLE_LIGHT }}>{badge.icon}</span>
              <span style={{ color: PINK_MUTED }}>{badge.text}</span>
            </div>
          ))}
        </div>
      </section>

      {/* DAY 24 SCENARIOS — Show, Don't Tell */}
      <section ref={scenariosRef} className="py-20 px-6 relative overflow-hidden">
        <div className="absolute inset-0" style={{ backgroundImage: `url(${SCENARIO_BG})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
          <div className="absolute inset-0" style={{ background: 'rgba(10,10,26,0.85)' }} />
        </div>
        <div className="max-w-2xl mx-auto relative z-10">
          <div className="text-center mb-14">
            <p className="text-xs font-medium tracking-widest uppercase mb-4" style={{ color: PURPLE_LIGHT, fontFamily: 'Poppins, sans-serif' }}>How It Works</p>
            <h2 className="text-3xl sm:text-4xl text-white mb-4" style={{ fontFamily: HEADING_FONT }} data-testid="scenarios-heading">
              Your daily reading.<br />
              <span style={{ color: PURPLE_LIGHT }}>Based on biology, not the stars.</span>
            </h2>
          </div>

          {/* Scenario Cards — showing the "aha" moment */}
          <div className="space-y-4">
            {[
              {
                before: 'Someone makes a small comment and you replay it 47 times, convinced they meant it in the worst way possible.',
                after: 'Your progesterone is crashing. You\'re on Day 24. Your sensitivity is spiking. This is textbook biology, not a personality flaw.',
                day: '24'
              },
              {
                before: 'You snap at your partner over nothing and spend the rest of the night feeling guilty.',
                after: 'Your estrogen just dropped to its lowest point this cycle. You\'re not mean. You\'re on Day 3.',
                day: '3'
              },
              {
                before: 'Some weeks you feel unstoppable. Other weeks you can barely get off the couch.',
                after: 'Day 13: estrogen is peaking. That\'s your energy window. HORMOscope shows you when it\'s coming.',
                day: '13'
              }
            ].map((s) => (
              <div key={`scenario-${s.day}`} className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(123,79,166,0.15)' }} data-testid={`scenario-${s.day}`}>
                <div className="p-5" style={{ background: 'rgba(255,70,70,0.04)' }}>
                  <p className="text-xs tracking-wider uppercase mb-2" style={{ color: '#ff6b6b', fontFamily: 'Poppins, sans-serif' }}>What you think</p>
                  <p className="text-white text-sm leading-relaxed" style={{ fontFamily: HEADING_FONT }}>&ldquo;{s.before}&rdquo;</p>
                </div>
                <div className="p-5" style={{ background: 'rgba(123,79,166,0.06)' }}>
                  <p className="text-xs tracking-wider uppercase mb-2" style={{ color: PURPLE_LIGHT, fontFamily: 'Poppins, sans-serif' }}>What HORMOscope shows you</p>
                  <p className="text-sm leading-relaxed" style={{ color: PINK_SOFT, fontFamily: HEADING_FONT }}>{s.after}</p>
                  <span className="inline-block mt-2 px-3 py-1 rounded-full text-xs font-medium" style={{ background: 'rgba(123,79,166,0.2)', color: PURPLE_LIGHT, fontFamily: 'Poppins, sans-serif' }}>Day {s.day}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* THE SCIENCE — Demystify How It Works */}
      <section ref={scienceRef} className="py-20 px-6 relative overflow-hidden">
        <div className="absolute inset-0" style={{ backgroundImage: `url(${SCIENCE_BG})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
          <div className="absolute inset-0" style={{ background: 'rgba(10,10,26,0.88)' }} />
        </div>
        <div className="max-w-2xl mx-auto relative z-10">
          <div className="text-center mb-14">
            <p className="text-xs font-medium tracking-widest uppercase mb-4" style={{ color: PURPLE_LIGHT, fontFamily: 'Poppins, sans-serif' }}>The science</p>
            <h2 className="text-3xl sm:text-4xl text-white mb-4" style={{ fontFamily: HEADING_FONT }} data-testid="science-heading">
              3 questions, one full cycle of clarity.
            </h2>
            <p className="text-sm leading-relaxed max-w-lg mx-auto" style={{ color: PINK_SOFT, fontFamily: HEADING_FONT }}>
              Every woman&apos;s cycle follows the same hormonal blueprint. We just map yours to it.
            </p>
          </div>

          {/* How the prediction works */}
          <div className="space-y-4 mb-10">
            {[
              { num: '1', title: 'Your cycle length anchors the timeline', desc: 'A 28-day cycle means ovulation is around Day 14. A 32-day cycle shifts it to Day 18. Your number tells us your map.' },
              { num: '2', title: 'Your last period date tells us where you are today', desc: 'If your period started 11 days ago, we know estrogen is rising. Your energy is building. Your mood is lifting. That\'s not a guess. That\'s endocrinology.' },
              { num: '3', title: 'Universal hormonal patterns do the rest', desc: 'Estrogen, progesterone, and LH follow the same pattern in every cycle. We know when they spike, when they crash, and exactly how that affects your mood, energy, focus, and pain tolerance.' }
            ].map((step) => (
              <div key={step.num} className="p-5 rounded-2xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }} data-testid={`science-step-${step.num}`}>
                <div className="flex items-start gap-4">
                  <span className="text-3xl flex-shrink-0" style={{ color: 'rgba(212,168,83,0.45)', fontFamily: "'Poiret One', cursive" }}>{step.num}</span>
                  <div>
                    <h3 className="text-white text-base mb-1.5" style={{ fontFamily: "'Poiret One', cursive" }}>{step.title}</h3>
                    <p className="text-sm leading-relaxed" style={{ color: PINK_MUTED, fontFamily: HEADING_FONT }}>{step.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center">
            <p className="text-xs leading-relaxed max-w-md mx-auto mb-6" style={{ color: PINK_MUTED, fontFamily: 'Poppins, sans-serif' }}>
              We&apos;re not reading your texts or tracking your behavior. We&apos;re doing the math on your endocrine system. That&apos;s it.
            </p>
            <button onClick={openSignup} className="px-8 py-3.5 rounded-full text-white font-medium text-sm transition-all" style={{ background: 'rgba(123,79,166,0.3)', border: '1px solid rgba(201,184,240,0.3)' }} data-testid="science-cta-btn">
              Try It Free <ArrowRight className="w-4 h-4 inline ml-1" />
            </button>
          </div>
        </div>
      </section>

      {/* RELATIONSHIP TRANSLATOR — Elevated from buried testimonials */}
      <section className="py-20 px-6 relative overflow-hidden">
        <div className="absolute inset-0" style={{ backgroundImage: `url(${RELATIONSHIP_BG})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
          <div className="absolute inset-0" style={{ background: 'rgba(10,10,26,0.87)' }} />
        </div>
        <div className="max-w-2xl mx-auto relative z-10">
          <div className="text-center mb-14">
            <p className="text-xs font-medium tracking-widest uppercase mb-4" style={{ color: PURPLE_LIGHT, fontFamily: 'Poppins, sans-serif' }}>Beyond just you</p>
            <h2 className="text-3xl sm:text-4xl text-white mb-4" style={{ fontFamily: HEADING_FONT }} data-testid="relationship-heading">
              Your cycle data is a<br /><span style={{ color: PURPLE_LIGHT }}>relationship translator.</span>
            </h2>
            <p className="text-sm leading-relaxed max-w-lg mx-auto" style={{ color: PINK_SOFT, fontFamily: HEADING_FONT }}>
              When you understand your biology, you can communicate it. No more unexplained mood swings. No more guilt. Just clarity — for both of you.
            </p>
          </div>

          <div className="space-y-4">
            <div className="p-5 rounded-2xl" style={{ background: 'rgba(123,79,166,0.06)', border: '1px solid rgba(123,79,166,0.15)' }} data-testid="relationship-scenario-1">
              <div className="flex items-start gap-3 mb-3">
                <MessageCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: PURPLE_LIGHT }} />
                <p className="text-white text-sm leading-relaxed" style={{ fontFamily: 'Poppins, sans-serif' }}>&ldquo;We need to talk about the budget.&rdquo;</p>
              </div>
              <div className="ml-8 p-3 rounded-xl" style={{ background: 'rgba(123,79,166,0.1)' }}>
                <p className="text-sm leading-relaxed" style={{ color: PINK_SOFT, fontFamily: HEADING_FONT }}>
                  HORMOscope says you&apos;re in a high-cortisol, low-resilience phase. <strong className="text-white">You reschedule to Thursday — a high-estrogen day</strong> when you&apos;ll be more receptive and articulate. Argument avoided. Problem still solved.
                </p>
              </div>
            </div>

            <div className="p-5 rounded-2xl" style={{ background: 'rgba(123,79,166,0.06)', border: '1px solid rgba(123,79,166,0.15)' }} data-testid="relationship-scenario-2">
              <div className="flex items-start gap-3 mb-3">
                <Heart className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: PINK }} />
                <p className="text-white text-sm leading-relaxed" style={{ fontFamily: 'Poppins, sans-serif' }}>&ldquo;Why are you being so distant?&rdquo;</p>
              </div>
              <div className="ml-8 p-3 rounded-xl" style={{ background: 'rgba(123,79,166,0.1)' }}>
                <p className="text-sm leading-relaxed" style={{ color: PINK_SOFT, fontFamily: HEADING_FONT }}>
                  Instead of spiraling into guilt, you show your partner: <strong className="text-white">&ldquo;I&apos;m on Day 26. My progesterone is peaking. I need quiet tonight.&rdquo;</strong> They get it. You both feel better.
                </p>
              </div>
            </div>
          </div>

          <p className="text-center text-xs mt-8" style={{ color: PINK_MUTED, fontFamily: 'Poppins, sans-serif' }}>
            You&apos;re not giving someone a manual on how to handle you. You&apos;re using your data to set boundaries and advocate for yourself.
          </p>
        </div>
      </section>

      {/* TRANSFORMATION */}
      <section className="py-20 px-6 relative overflow-hidden">
        <div className="absolute inset-0" style={{ backgroundImage: `url(${TRANSFORM_BG})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
          <div className="absolute inset-0" style={{ background: 'rgba(10,10,26,0.85)' }} />
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

      {/* CTA — Start Free */}
      <section className="py-16 px-6 relative overflow-hidden">
        <div className="absolute inset-0" style={{ backgroundImage: `url(/images/img-0551.jpeg)`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
          <div className="absolute inset-0" style={{ background: 'rgba(10,10,26,0.88)' }} />
        </div>
        <div className="max-w-md mx-auto relative z-10 text-center">
          <p className="text-sm tracking-[0.3em] uppercase mb-3" style={{ fontFamily: "'Poiret One', cursive", color: '#D4A853' }}>Begin</p>
          <h2 className="text-white leading-[1.1] mb-5" style={{ fontFamily: "'Poiret One', cursive", fontSize: 'clamp(2rem, 7vw, 3rem)' }}>
            Start tracking <br /><span style={{ color: '#D4A853' }}>for free.</span>
          </h2>
          <p className="text-xs sm:text-sm leading-relaxed mb-7" style={{ fontFamily: HEADING_FONT, color: PINK_SOFT }}>
            Track your cycle, mood, and intimacy. No credit card needed. Upgrade anytime for personalized daily readings, hormone maps, and your private journal.
          </p>
          <button onClick={openSignup} data-testid="start-free-cta" className="px-8 py-3.5 rounded-full text-white text-base transition-all" style={{ fontFamily: "'Poiret One', cursive", letterSpacing: '0.05em', background: 'linear-gradient(135deg, #D4A853, #c9a030)', boxShadow: '0 0 25px rgba(212,168,83,0.3)' }}>
            Get Started Free
          </button>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section ref={testimonialsRef} className="py-20 px-6 relative overflow-hidden">
        <div className="absolute inset-0" style={{ backgroundImage: `url(${TESTIMONIAL_BG})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
          <div className="absolute inset-0" style={{ background: 'rgba(10,10,26,0.85)' }} />
        </div>
        <div className="max-w-3xl mx-auto relative z-10">
          <div className="text-center mb-14">
            <p className="text-xs font-medium tracking-widest uppercase mb-4" style={{ color: PURPLE_LIGHT, fontFamily: 'Poppins, sans-serif' }}>Real stories</p>
            <h2 className="text-3xl sm:text-4xl text-white" style={{ fontFamily: HEADING_FONT }} data-testid="testimonials-heading">
              Women who <span style={{ color: PURPLE_LIGHT }}>finally get it.</span>
            </h2>
          </div>
          <div className="space-y-6">
            {testimonials.map((t) => (
              <div key={t.name} className="p-6 rounded-2xl border border-white/10 bg-black/30 backdrop-blur-md" data-testid={`testimonial-${t.name}`}>
                <div className="flex gap-0.5 mb-3">
                  {Array.from({ length: t.stars }).map((_, j) => (
                    <Star key={`${t.name}-star-${j}`} className="w-3.5 h-3.5" style={{ fill: PURPLE_LIGHT, color: PURPLE_LIGHT }} />
                  ))}
                </div>
                <p className="text-sm sm:text-base leading-relaxed mb-4 italic" style={{ color: PINK_SOFT, fontFamily: HEADING_FONT }}>&ldquo;{t.quote}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <img src={t.img} alt={t.name} className="w-11 h-11 rounded-full object-cover border-2" style={{ borderColor: 'rgba(123,79,166,0.4)' }} />
                  <p className="text-white text-sm font-medium" style={{ fontFamily: 'Poppins, sans-serif' }}>{t.name}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-20 px-6 text-center relative overflow-hidden">
        <div className="absolute inset-0" style={{ backgroundImage: `url(/images/img-0546-alt.jpeg)`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
          <div className="absolute inset-0" style={{ background: 'rgba(10,10,26,0.82)' }} />
        </div>
        <div className="max-w-lg mx-auto relative z-10">
          <h2 className="text-3xl sm:text-4xl mb-4 text-white" style={{ fontFamily: HEADING_FONT }} data-testid="final-cta-heading">
            You&apos;re not crazy,<br />
            <span style={{ color: PURPLE_LIGHT, fontSize: '1.15em' }}>you&apos;re just on day 24.</span>
          </h2>
          <p className="text-sm mb-8 leading-relaxed" style={{ color: PINK_SOFT, fontFamily: HEADING_FONT }}>
            Finally know why you feel the way you feel, not because the stars said so, but because your hormones did.
          </p>
          <button onClick={openSignup} data-testid="final-cta-btn" className="px-10 py-4 rounded-full text-white font-medium text-sm tracking-wide transition-all duration-300" style={{ background: 'rgba(123,79,166,0.3)', border: '1px solid rgba(201,184,240,0.3)' }}>
            Get Started Free
          </button>
          <p className="text-xs mt-4 flex items-center justify-center gap-1.5" style={{ color: PINK_MUTED, fontFamily: 'Poppins, sans-serif' }}>
            <Shield className="w-3.5 h-3.5" /> Private & secure. No credit card required.
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
          <div className="relative w-full max-w-sm p-7 rounded-3xl border border-white/10" style={{ background: 'linear-gradient(180deg, #1a1030 0%, #0a0a1a 100%)' }} onClick={(e) => e.stopPropagation()}>
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
                  <input data-testid="auth-password-input" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={isLogin ? 'Your password' : 'Create a password'} className="w-full rounded-xl px-4 py-3 text-sm text-white focus:outline-none pr-12 transition-colors" style={{ background: 'rgba(123,79,166,0.08)', border: '1px solid rgba(123,79,166,0.2)', fontFamily: 'Poppins, sans-serif' }} required />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 hover:text-white transition-colors" style={{ color: PINK_MUTED }}>
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
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
