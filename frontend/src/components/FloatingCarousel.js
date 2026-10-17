import React, { useState, useRef } from 'react';
import { Heart, Sun, ShieldAlert, Cookie, BedDouble, X, Check } from 'lucide-react';
import axios from 'axios';
import logger from '../utils/logger';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const CYCLE_SECONDS = 26;

const CATEGORIES = [
  { id: 'mood', label: 'Mood', Icon: Heart, color: '#f4a7b9' },
  { id: 'energy', label: 'Energy', Icon: Sun, color: '#c9b8f0' },
  { id: 'symptoms', label: 'Symptoms', Icon: ShieldAlert, color: '#ff6b6b' },
  { id: 'cravings', label: 'Cravings', Icon: Cookie, color: '#ff8fab' },
  { id: 'sleep', label: 'Sleep', Icon: BedDouble, color: '#a29bfe' },
];

const MOOD_OPTIONS = [
  { value: 1, emoji: '😞', label: 'Low' },
  { value: 2, emoji: '😟', label: 'Meh' },
  { value: 3, emoji: '😐', label: 'Okay' },
  { value: 4, emoji: '🙂', label: 'Good' },
  { value: 5, emoji: '😄', label: 'Great' },
];

// The full range of real feelings (Angelita's list, Oct 16). Multi-select.
// Saved through the same quick-log path as `emotion:<name>` symptom tags,
// so the payload shape stays compatible with /cycle-logs.
const EMOTION_OPTIONS = [
  { emoji: '😠', label: 'Anger' },
  { emoji: '😢', label: 'Sad' },
  { emoji: '🌧️', label: 'Melancholy' },
  { emoji: '📷', label: 'Nostalgic' },
  { emoji: '💔', label: 'Hurt' },
  { emoji: '😣', label: 'Pain' },
  { emoji: '😞', label: 'Disappointed' },
  { emoji: '🫥', label: 'Misunderstood' },
  { emoji: '🤢', label: 'Sick' },
  { emoji: '😨', label: 'Scared' },
  { emoji: '🥱', label: 'Bored' },
  { emoji: '😵‍💫', label: 'Dumbfounded' },
  { emoji: '😏', label: 'Horny' },
  { emoji: '😘', label: 'Flirtatious' },
  { emoji: '😒', label: 'Jealous' },
  { emoji: '👀', label: 'Envious' },
];

const SYMPTOM_OPTIONS = [
  'cramps', 'headache', 'bloating', 'fatigue', 'nausea',
  'backache', 'tender breasts', 'acne', 'dizziness', 'spotting',
];

const CRAVING_OPTIONS = [
  'chocolate', 'salty snacks', 'sweets', 'carbs', 'spicy food', 'ice cream', 'fruit',
];

const SLEEP_QUALITY = ['restless', 'okay', 'deep'];

const todayISO = () => new Date().toISOString().split('T')[0];

const colorOf = (id) => (CATEGORIES.find((c) => c.id === id) || {}).color || '#FF1493';

function SectionTitle({ Icon, color, children }) {
  return (
    <div className="flex items-center gap-2 mb-3 mt-6">
      <Icon className="w-4 h-4" style={{ color }} />
      <p className="text-[#9A8B91] text-[10px] tracking-widest uppercase" style={{ fontFamily: 'Poppins, sans-serif' }}>
        {children}
      </p>
    </div>
  );
}

// ONE sheet with everything in it (Angelita, Oct 17): tapping any floaty
// icon opens this, so she never has to wait for the orbiting icons to come
// around. "How do you feel?" (mood faces + the full feelings grid, the
// negative ones included) comes first, then symptoms, cravings, energy and
// sleep, all in the same scrollable sheet. Every control still saves to
// today the moment it is tapped, exactly like the per-category dialogs did.
function QuickLogSheet({ token, onClose, onSaved }) {
  const [mood, setMood] = useState(3);
  const [emotions, setEmotions] = useState([]);
  const [energy, setEnergy] = useState(3);
  const [symptoms, setSymptoms] = useState([]);
  const [cravings, setCravings] = useState([]);
  const [sleepHours, setSleepHours] = useState(7);
  const [sleepQuality, setSleepQuality] = useState('okay');
  const [note, setNote] = useState('');
  // The group she touched most recently. Done uses it for the final save
  // that carries her note, the way the old per-category Done did.
  const [lastKind, setLastKind] = useState('mood');
  // Every tap in here saves right away (Angelita, Oct 17: pushing the
  // icons did nothing and nothing was saved anywhere). saveState drives
  // the visible "Saved to today" confirmation, and a failure is shown,
  // never swallowed silently the way the old Save button did.
  const [saveState, setSaveState] = useState('idle'); // idle | saving | saved | error
  const flashTimer = useRef(null);

  const buildPayload = (kind, ov = {}) => {
    const moodVal = ov.mood !== undefined ? ov.mood : mood;
    const emos = ov.emotions !== undefined ? ov.emotions : emotions;
    const energyVal = ov.energy !== undefined ? ov.energy : energy;
    const syms = ov.symptoms !== undefined ? ov.symptoms : symptoms;
    const cravs = ov.cravings !== undefined ? ov.cravings : cravings;
    const hours = ov.sleepHours !== undefined ? ov.sleepHours : sleepHours;
    const qual = ov.sleepQuality !== undefined ? ov.sleepQuality : sleepQuality;
    let payloadSymptoms = [];
    let label = '';
    switch (kind) {
      case 'mood':
        payloadSymptoms = [`mood:${moodVal}`, ...emos.map((e) => `emotion:${e.toLowerCase()}`)];
        label = emos.length
          ? `Feeling ${emos.join(', ')} · Mood ${moodVal}/5`
          : `Mood ${moodVal}/5`;
        break;
      case 'energy':
        payloadSymptoms = [`energy:${energyVal}`];
        label = `Energy ${energyVal}/5`;
        break;
      case 'symptoms':
        payloadSymptoms = syms;
        label = syms.length ? syms.join(', ') : 'No symptoms';
        break;
      case 'cravings':
        payloadSymptoms = cravs.map((c) => `craving:${c}`);
        label = cravs.length ? cravs.join(', ') : 'No cravings';
        break;
      case 'sleep':
        payloadSymptoms = [`sleep:${hours}h`, `sleep_quality:${qual}`];
        label = `${hours}h, ${qual}`;
        break;
      default:
        break;
    }
    return {
      date: todayISO(),
      is_period: false,
      symptoms: payloadSymptoms,
      notes: note.trim() ? `${label} — ${note.trim()}` : label,
    };
  };

  const saveNow = async (kind, ov = {}) => {
    setSaveState('saving');
    try {
      await axios.post(`${API}/cycle-logs`, buildPayload(kind, ov), {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 15000,
      });
      setSaveState('saved');
      if (onSaved) onSaved(kind);
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setSaveState('idle'), 2200);
    } catch (err) {
      logger.error('Quick log save failed:', err);
      setSaveState('error');
    }
  };

  // Tapping a mood face saves that mood (with any feelings picked) at once.
  const handleMoodPick = (value) => {
    setMood(value);
    setLastKind('mood');
    saveNow('mood', { mood: value });
  };

  // Tapping a feeling chip saves the updated set at once.
  const handleEmotionToggle = (label) => {
    const next = emotions.includes(label) ? emotions.filter((v) => v !== label) : [...emotions, label];
    setEmotions(next);
    setLastKind('mood');
    saveNow('mood', { emotions: next });
  };

  const handleSymptomToggle = (s) => {
    const next = symptoms.includes(s) ? symptoms.filter((v) => v !== s) : [...symptoms, s];
    setSymptoms(next);
    setLastKind('symptoms');
    if (next.length > 0) saveNow('symptoms', { symptoms: next });
  };

  const handleCravingToggle = (c) => {
    const next = cravings.includes(c) ? cravings.filter((v) => v !== c) : [...cravings, c];
    setCravings(next);
    setLastKind('cravings');
    if (next.length > 0) saveNow('cravings', { cravings: next });
  };

  const handleSleepQuality = (q) => {
    setSleepQuality(q);
    setLastKind('sleep');
    saveNow('sleep', { sleepQuality: q });
  };

  // Done closes the sheet. If she typed a note, one last save carries it.
  const handleDone = async () => {
    if (note.trim()) {
      await saveNow(lastKind, {});
      setTimeout(onClose, 500);
    } else {
      onClose();
    }
  };

  const chip = (active, color) => ({
    fontFamily: 'Poppins, sans-serif',
    border: `1px solid ${active ? color : 'rgba(255,255,255,0.12)'}`,
    background: active ? `${color}22` : 'rgba(255,255,255,0.04)',
    color: active ? '#fff' : '#b8b8d1',
  });

  const moodColor = colorOf('mood');

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(10,5,15,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
      data-testid="quicklog-sheet"
    >
      <div
        className="w-full max-w-sm rounded-3xl animate-in flex flex-col max-h-[88vh]"
        style={{ background: 'linear-gradient(180deg, #241226 0%, #160b1a 100%)', border: '1px solid rgba(255,20,147,0.25)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-6">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Heart className="w-5 h-5" style={{ color: moodColor }} />
              <h3 className="text-white text-lg font-script">How do you feel?</h3>
            </div>
            <button onClick={onClose} aria-label="Close" className="text-[#9A8B91] hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-[#9A8B91] text-xs mb-5" style={{ fontFamily: 'Poppins, sans-serif' }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>

        <div className="overflow-y-auto px-6">
          {/* How do you feel: mood faces and the full feelings grid together */}
          <div className="flex justify-between mb-4">
            {MOOD_OPTIONS.map((m) => (
              <button
                key={m.value}
                onClick={() => handleMoodPick(m.value)}
                className="flex flex-col items-center gap-1 p-2 rounded-2xl transition-transform"
                style={{
                  background: mood === m.value ? `${moodColor}22` : 'transparent',
                  border: `1px solid ${mood === m.value ? moodColor : 'transparent'}`,
                  transform: mood === m.value ? 'scale(1.12)' : 'scale(1)',
                }}
                aria-label={m.label}
              >
                <span className="text-3xl">{m.emoji}</span>
                <span className="text-[10px]" style={{ fontFamily: 'Poppins, sans-serif', color: mood === m.value ? '#fff' : '#9A8B91' }}>{m.label}</span>
              </button>
            ))}
          </div>
          <p className="text-[#9A8B91] text-[10px] tracking-widest uppercase mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
            And what you are really feeling
          </p>
          <div className="flex flex-wrap gap-1.5 mb-1">
            {EMOTION_OPTIONS.map((e) => {
              const active = emotions.includes(e.label);
              return (
                <button
                  key={e.label}
                  onClick={() => handleEmotionToggle(e.label)}
                  className="px-2.5 py-1.5 rounded-full text-[11px]"
                  style={chip(active, moodColor)}
                  aria-label={e.label}
                  aria-pressed={active}
                >
                  {e.emoji} {e.label}
                </button>
              );
            })}
          </div>

          <SectionTitle Icon={ShieldAlert} color={colorOf('symptoms')}>Symptoms</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {SYMPTOM_OPTIONS.map((s) => (
              <button
                key={s} onClick={() => handleSymptomToggle(s)}
                className="px-3 py-1.5 rounded-full text-xs capitalize"
                style={chip(symptoms.includes(s), colorOf('symptoms'))}
              >
                {s}
              </button>
            ))}
          </div>

          <SectionTitle Icon={Cookie} color={colorOf('cravings')}>Cravings</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {CRAVING_OPTIONS.map((c) => (
              <button
                key={c} onClick={() => handleCravingToggle(c)}
                className="px-3 py-1.5 rounded-full text-xs capitalize"
                style={chip(cravings.includes(c), colorOf('cravings'))}
              >
                {c}
              </button>
            ))}
          </div>

          <SectionTitle Icon={Sun} color={colorOf('energy')}>Energy</SectionTitle>
          <div>
            <div className="flex justify-between text-xs mb-2" style={{ fontFamily: 'Poppins, sans-serif', color: '#9A8B91' }}>
              <span>Drained</span>
              <span className="text-white text-base font-semibold">{energy}/5</span>
              <span>Buzzing</span>
            </div>
            <input
              type="range" min="1" max="5" step="1" value={energy}
              onChange={(e) => { setEnergy(parseInt(e.target.value, 10)); setLastKind('energy'); }}
              onPointerUp={(e) => saveNow('energy', { energy: parseInt(e.target.value, 10) })}
              className="w-full accent-[#c9b8f0]"
              aria-label="Energy level"
            />
          </div>

          <SectionTitle Icon={BedDouble} color={colorOf('sleep')}>Sleep</SectionTitle>
          <div>
            <div className="flex justify-between text-xs mb-2" style={{ fontFamily: 'Poppins, sans-serif', color: '#9A8B91' }}>
              <span>Hours slept</span>
              <span className="text-white text-base font-semibold">{sleepHours}h</span>
            </div>
            <input
              type="range" min="0" max="12" step="0.5" value={sleepHours}
              onChange={(e) => { setSleepHours(parseFloat(e.target.value)); setLastKind('sleep'); }}
              onPointerUp={(e) => saveNow('sleep', { sleepHours: parseFloat(e.target.value) })}
              className="w-full accent-[#a29bfe] mb-4"
              aria-label="Hours slept"
            />
            <div className="flex gap-2">
              {SLEEP_QUALITY.map((q) => (
                <button
                  key={q} onClick={() => handleSleepQuality(q)}
                  className="flex-1 px-3 py-1.5 rounded-full text-xs capitalize"
                  style={chip(sleepQuality === q, colorOf('sleep'))}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a note (optional)"
            rows={2}
            className="input-dark text-sm mt-6 mb-4"
            style={{ fontFamily: 'Poppins, sans-serif' }}
          />
        </div>

        <div className="px-6 pb-6 pt-1">
          {/* Save status: every tap above already saved to today. This line
              is the proof, and a failure shows here instead of vanishing. */}
          <div className="h-5 mb-2 flex items-center justify-center" aria-live="polite">
            {saveState === 'saving' && (
              <span className="text-[11px]" style={{ fontFamily: 'Poppins, sans-serif', color: '#9A8B91' }}>Saving to today…</span>
            )}
            {saveState === 'saved' && (
              <span className="text-[11px] flex items-center gap-1 animate-in" style={{ fontFamily: 'Poppins, sans-serif', color: '#55efc4' }}>
                <Check className="w-3.5 h-3.5" /> Saved to today
              </span>
            )}
            {saveState === 'error' && (
              <span className="text-[11px]" style={{ fontFamily: 'Poppins, sans-serif', color: '#ff8fa3' }}>
                That didn&apos;t save. The server may be waking up, tap again.
              </span>
            )}
          </div>

          <button
            onClick={handleDone}
            disabled={saveState === 'saving'}
            className="w-full py-3 rounded-full text-white text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-40"
            style={{ background: '#FF1493', fontFamily: 'Poppins, sans-serif' }}
          >
            {saveState === 'saving' ? 'Saving…' : 'Done'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FloatingCarousel({ token }) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [justLogged, setJustLogged] = useState(false);
  // The icons orbit constantly, which makes them moving targets that are
  // hard to hit on a phone (Angelita: "when you push the icons, nothing
  // happens"). Pressing on the track freezes the orbit so she can tap
  // the icon she means.
  const [paused, setPaused] = useState(false);
  const pillTimer = useRef(null);

  const perItem = CYCLE_SECONDS / CATEGORIES.length;

  return (
    <div className="mb-6" data-testid="floating-carousel">
      <p className="text-[#6c6c8a] text-[10px] tracking-widest uppercase mb-1 text-center">
        Quick Log
      </p>
      <p className="text-[#9A8B91] text-xs mb-3 text-center" style={{ fontFamily: 'Poppins, sans-serif' }}>
        Tap an icon to log today
      </p>

      {/* No framing box: the icons sit directly on the page background
          (Angelita's fix list, Oct 16). The track is only a positioning area. */}
      <div
        className="hs-carousel-track relative overflow-hidden"
        style={{ height: 132 }}
        onPointerDown={() => setPaused(true)}
        onPointerUp={() => setPaused(false)}
        onPointerCancel={() => setPaused(false)}
        onPointerLeave={() => setPaused(false)}
      >
        {CATEGORIES.map((cat, i) => {
          const { Icon } = cat;
          return (
            <div
              key={cat.id}
              className="hs-orbit-item"
              style={{ animationDelay: `${-i * perItem}s`, animationPlayState: paused ? 'paused' : 'running' }}
            >
              <button
                className="hs-orbit-icon flex flex-col items-center gap-1 rounded-full"
                style={{ animationDelay: `${-i * perItem}s`, pointerEvents: 'auto', animationPlayState: paused ? 'paused' : 'running' }}
                onClick={() => setSheetOpen(true)}
                aria-label={`Log ${cat.label}`}
              >
                <span
                  className="w-14 h-14 rounded-full flex items-center justify-center"
                  style={{
                    background: `radial-gradient(circle at 35% 35%, ${cat.color}55, ${cat.color}18)`,
                    border: `1.5px solid ${cat.color}88`,
                    boxShadow: `0 0 22px ${cat.color}44`,
                  }}
                >
                  <Icon className="w-6 h-6" style={{ color: '#fff' }} />
                </span>
                <span
                  className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                  style={{ fontFamily: 'Poppins, sans-serif', color: '#fff', background: 'rgba(10,5,15,0.55)' }}
                >
                  {cat.label}
                </span>
              </button>
            </div>
          );
        })}

        {justLogged && (
          <div
            className="absolute bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[11px] animate-in"
            style={{ fontFamily: 'Poppins, sans-serif', background: 'rgba(85,239,196,0.15)', color: '#55efc4', border: '1px solid rgba(85,239,196,0.4)', zIndex: 20 }}
          >
            ✓ Saved to today
          </div>
        )}
      </div>

      {sheetOpen && (
        <QuickLogSheet
          token={token}
          onClose={() => setSheetOpen(false)}
          onSaved={() => {
            setJustLogged(true);
            if (pillTimer.current) clearTimeout(pillTimer.current);
            pillTimer.current = setTimeout(() => setJustLogged(false), 2500);
          }}
        />
      )}
    </div>
  );
}
