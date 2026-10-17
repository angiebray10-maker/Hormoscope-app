import React, { useState } from 'react';
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

function QuickLogDialog({ category, token, onClose, onSaved }) {
  const [mood, setMood] = useState(3);
  const [emotions, setEmotions] = useState([]);
  const [energy, setEnergy] = useState(3);
  const [symptoms, setSymptoms] = useState([]);
  const [cravings, setCravings] = useState([]);
  const [sleepHours, setSleepHours] = useState(7);
  const [sleepQuality, setSleepQuality] = useState('okay');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const toggleIn = (list, setter, value) => {
    setter(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  };

  const buildPayload = () => {
    let payloadSymptoms = [];
    let label = '';
    switch (category.id) {
      case 'mood':
        payloadSymptoms = [`mood:${mood}`, ...emotions.map((e) => `emotion:${e.toLowerCase()}`)];
        label = emotions.length
          ? `Feeling ${emotions.join(', ')} · Mood ${mood}/5`
          : `Mood ${mood}/5`;
        break;
      case 'energy':
        payloadSymptoms = [`energy:${energy}`];
        label = `Energy ${energy}/5`;
        break;
      case 'symptoms':
        payloadSymptoms = symptoms;
        label = symptoms.length ? symptoms.join(', ') : 'No symptoms';
        break;
      case 'cravings':
        payloadSymptoms = cravings.map((c) => `craving:${c}`);
        label = cravings.length ? cravings.join(', ') : 'No cravings';
        break;
      case 'sleep':
        payloadSymptoms = [`sleep:${sleepHours}h`, `sleep_quality:${sleepQuality}`];
        label = `${sleepHours}h, ${sleepQuality}`;
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

  const canSave = () => {
    if (category.id === 'symptoms') return symptoms.length > 0 || note.trim();
    if (category.id === 'cravings') return cravings.length > 0 || note.trim();
    return true;
  };

  const handleSave = async () => {
    if (saving || saved) return;
    setSaving(true);
    try {
      await axios.post(`${API}/cycle-logs`, buildPayload(), {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 15000,
      });
      setSaved(true);
      if (onSaved) onSaved(category.id);
      setTimeout(onClose, 900);
    } catch (err) {
      logger.error('Quick log save failed:', err);
    } finally {
      setSaving(false);
    }
  };

  const chip = (active, color) => ({
    fontFamily: 'Poppins, sans-serif',
    border: `1px solid ${active ? color : 'rgba(255,255,255,0.12)'}`,
    background: active ? `${color}22` : 'rgba(255,255,255,0.04)',
    color: active ? '#fff' : '#b8b8d1',
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(10,5,15,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
      data-testid={`quicklog-dialog-${category.id}`}
    >
      <div
        className="w-full max-w-sm rounded-3xl p-6 animate-in"
        style={{ background: 'linear-gradient(180deg, #241226 0%, #160b1a 100%)', border: `1px solid ${category.color}40` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <category.Icon className="w-5 h-5" style={{ color: category.color }} />
            <h3 className="text-white text-lg font-script">Log {category.label}</h3>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-[#9A8B91] hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-[#9A8B91] text-xs mb-5" style={{ fontFamily: 'Poppins, sans-serif' }}>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>

        {category.id === 'mood' && (
          <>
            <div className="flex justify-between mb-4">
              {MOOD_OPTIONS.map((m) => (
                <button
                  key={m.value}
                  onClick={() => setMood(m.value)}
                  className="flex flex-col items-center gap-1 p-2 rounded-2xl transition-transform"
                  style={{
                    background: mood === m.value ? `${category.color}22` : 'transparent',
                    border: `1px solid ${mood === m.value ? category.color : 'transparent'}`,
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
            <div className="flex flex-wrap gap-1.5 mb-5 max-h-36 overflow-y-auto pr-1">
              {EMOTION_OPTIONS.map((e) => {
                const active = emotions.includes(e.label);
                return (
                  <button
                    key={e.label}
                    onClick={() => toggleIn(emotions, setEmotions, e.label)}
                    className="px-2.5 py-1.5 rounded-full text-[11px]"
                    style={chip(active, category.color)}
                    aria-label={e.label}
                    aria-pressed={active}
                  >
                    {e.emoji} {e.label}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {category.id === 'energy' && (
          <div className="mb-5">
            <div className="flex justify-between text-xs mb-2" style={{ fontFamily: 'Poppins, sans-serif', color: '#9A8B91' }}>
              <span>Drained</span>
              <span className="text-white text-base font-semibold">{energy}/5</span>
              <span>Buzzing</span>
            </div>
            <input
              type="range" min="1" max="5" step="1" value={energy}
              onChange={(e) => setEnergy(parseInt(e.target.value, 10))}
              className="w-full accent-[#c9b8f0]"
              aria-label="Energy level"
            />
          </div>
        )}

        {category.id === 'symptoms' && (
          <div className="flex flex-wrap gap-2 mb-5">
            {SYMPTOM_OPTIONS.map((s) => (
              <button
                key={s} onClick={() => toggleIn(symptoms, setSymptoms, s)}
                className="px-3 py-1.5 rounded-full text-xs capitalize"
                style={chip(symptoms.includes(s), category.color)}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {category.id === 'cravings' && (
          <div className="flex flex-wrap gap-2 mb-5">
            {CRAVING_OPTIONS.map((c) => (
              <button
                key={c} onClick={() => toggleIn(cravings, setCravings, c)}
                className="px-3 py-1.5 rounded-full text-xs capitalize"
                style={chip(cravings.includes(c), category.color)}
              >
                {c}
              </button>
            ))}
          </div>
        )}

        {category.id === 'sleep' && (
          <div className="mb-5">
            <div className="flex justify-between text-xs mb-2" style={{ fontFamily: 'Poppins, sans-serif', color: '#9A8B91' }}>
              <span>Hours slept</span>
              <span className="text-white text-base font-semibold">{sleepHours}h</span>
            </div>
            <input
              type="range" min="0" max="12" step="0.5" value={sleepHours}
              onChange={(e) => setSleepHours(parseFloat(e.target.value))}
              className="w-full accent-[#a29bfe] mb-4"
              aria-label="Hours slept"
            />
            <div className="flex gap-2">
              {SLEEP_QUALITY.map((q) => (
                <button
                  key={q} onClick={() => setSleepQuality(q)}
                  className="flex-1 px-3 py-1.5 rounded-full text-xs capitalize"
                  style={chip(sleepQuality === q, category.color)}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add a note (optional)"
          rows={2}
          className="input-dark text-sm mb-4"
          style={{ fontFamily: 'Poppins, sans-serif' }}
        />

        <button
          onClick={handleSave}
          disabled={saving || saved || !canSave()}
          className="w-full py-3 rounded-full text-white text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-40"
          style={{ background: saved ? '#55efc4' : category.color, fontFamily: 'Poppins, sans-serif', color: saved ? '#0a0a1a' : '#fff' }}
        >
          {saved ? (<><Check className="w-4 h-4" /> Logged</>) : saving ? 'Saving…' : `Log ${category.label}`}
        </button>
      </div>
    </div>
  );
}

export default function FloatingCarousel({ token }) {
  const [activeCategory, setActiveCategory] = useState(null);
  const [justLogged, setJustLogged] = useState(null);

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
      >
        {CATEGORIES.map((cat, i) => {
          const { Icon } = cat;
          return (
            <div
              key={cat.id}
              className="hs-orbit-item"
              style={{ animationDelay: `${-i * perItem}s` }}
            >
              <button
                className="hs-orbit-icon flex flex-col items-center gap-1 rounded-full"
                style={{ animationDelay: `${-i * perItem}s`, pointerEvents: 'auto' }}
                onClick={() => setActiveCategory(cat)}
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
            ✓ {justLogged} logged
          </div>
        )}
      </div>

      {activeCategory && (
        <QuickLogDialog
          category={activeCategory}
          token={token}
          onClose={() => setActiveCategory(null)}
          onSaved={(id) => {
            const cat = CATEGORIES.find((c) => c.id === id);
            setJustLogged(cat ? cat.label : 'Entry');
            setTimeout(() => setJustLogged(null), 2500);
          }}
        />
      )}
    </div>
  );
}
