import React, { useState, useRef } from 'react';
import { Heart, Sun, ShieldAlert, Cookie, BedDouble, Droplet, X, Check } from 'lucide-react';
import axios from 'axios';
import logger from '../utils/logger';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CATEGORIES = [
  { id: 'mood', label: 'Mood', Icon: Heart, color: '#f4a7b9' },
  { id: 'energy', label: 'Energy', Icon: Sun, color: '#c9b8f0' },
  { id: 'symptoms', label: 'Symptoms', Icon: ShieldAlert, color: '#ff6b6b' },
  { id: 'cravings', label: 'Cravings', Icon: Cookie, color: '#ff8fab' },
  { id: 'sleep', label: 'Sleep', Icon: BedDouble, color: '#C9B8F0' },
];

const MOOD_OPTIONS = [
  { value: 1, emoji: '😞', label: 'Low' },
  { value: 2, emoji: '😟', label: 'Meh' },
  { value: 3, emoji: '😐', label: 'Okay' },
  { value: 4, emoji: '🙂', label: 'Good' },
  { value: 5, emoji: '😄', label: 'Great' },
];

// The full range of real feelings: Angelita's list (Oct 16) was nearly
// all heavy feelings, so the positive ones lead now (her correction,
// Oct 17): a woman logging a good day finds her feelings first, and the
// hard ones are all still here. Multi-select. Saved through the same
// quick-log path as `emotion:<name>` symptom tags, so the payload shape
// stays compatible with /cycle-logs.
// Eight common feelings show first; the rest sit behind "More feelings".
const CORE_EMOTIONS = ['Happy', 'Calm', 'Loved', 'Confident', 'Anxious', 'Sad', 'Irritable', 'Tired'];

const EMOTION_OPTIONS = [
  { emoji: '😰', label: 'Anxious' },
  { emoji: '😤', label: 'Irritable' },
  { emoji: '😴', label: 'Tired' },
  { emoji: '😊', label: 'Happy' },
  { emoji: '😁', label: 'Joyful' },
  { emoji: '😌', label: 'Calm' },
  { emoji: '🕊️', label: 'Peaceful' },
  { emoji: '🍃', label: 'Relaxed' },
  { emoji: '☺️', label: 'Content' },
  { emoji: '🥰', label: 'Loved' },
  { emoji: '🙏', label: 'Grateful' },
  { emoji: '🌈', label: 'Hopeful' },
  { emoji: '🤩', label: 'Excited' },
  { emoji: '💪', label: 'Confident' },
  { emoji: '😜', label: 'Playful' },
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
  { emoji: '😵', label: 'Dumbfounded' },
  { emoji: '😏', label: 'Horny' },
  { emoji: '😘', label: 'Flirtatious' },
  { emoji: '😒', label: 'Jealous' },
  { emoji: '👀', label: 'Envious' },
];

const SYMPTOM_OPTIONS = [
  'cramps', 'headache', 'bloating', 'fatigue', 'nausea',
  'backache', 'tender breasts', 'acne', 'dizziness', 'spotting',
  'PMDD flare',
];

const CRAVING_OPTIONS = [
  'chocolate', 'salty snacks', 'sweets', 'carbs', 'spicy food', 'ice cream', 'fruit',
];

// How she collected the blood that day (Angelita, Oct 17). Multi-select:
// any number can be on at once, including all of them (a mixture is just
// several picked). Saved as `collection:<name>` symptom tags, the same
// way cravings are saved.
const COLLECTION_OPTIONS = [
  'Tampon', 'Pads', 'Cup', 'Disc', 'Period Underwear',
];

const SLEEP_QUALITY = ['restless', 'okay', 'deep'];

const todayISO = () => new Date().toISOString().split('T')[0];

const colorOf = (id) => (CATEGORIES.find((c) => c.id === id) || {}).color || '#FF4F9A';

function SectionTitle({ Icon, color, children }) {
  return (
    <div className="flex items-center gap-2 mb-3 mt-6">
      <Icon className="w-4 h-4" style={{ color }} />
      <p className="text-[#CFC3CC] text-[10px] tracking-widest uppercase" style={{ fontFamily: 'Poppins, sans-serif' }}>
        {children}
      </p>
    </div>
  );
}

// ONE sheet with everything in it (Angelita, Oct 17): tapping any floaty
// icon opens this, so she never has to wait for the orbiting icons to come
// around. "How do you feel?" (mood faces + the full feelings grid, the
// negative ones included) comes first, then symptoms, cravings, collection,
// energy and sleep, all in the same scrollable sheet. Every control still saves to
// today the moment it is tapped, exactly like the per-category dialogs did.
function QuickLogSheet({ token, onClose, onSaved, mode = 'full' }) {
  // No mood is pre-picked (Angelita, Oct 20, 2026): the old default of
  // 3 (Okay) meant an emotion-only log also recorded a mood she never
  // chose. Null until she taps a face, and the payload follows suit.
  const [showAllFeelings, setShowAllFeelings] = useState(false);
  const [mood, setMood] = useState(null);
  const [emotions, setEmotions] = useState([]);
  const [energy, setEnergy] = useState(3);
  const [symptoms, setSymptoms] = useState([]);
  const [cravings, setCravings] = useState([]);
  const [collection, setCollection] = useState([]);
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
    const colls = ov.collection !== undefined ? ov.collection : collection;
    const hours = ov.sleepHours !== undefined ? ov.sleepHours : sleepHours;
    const qual = ov.sleepQuality !== undefined ? ov.sleepQuality : sleepQuality;
    let payloadSymptoms = [];
    let label = '';
    switch (kind) {
      case 'mood':
        payloadSymptoms = [
          ...(moodVal != null ? [`mood:${moodVal}`] : []),
          ...emos.map((e) => `emotion:${e.toLowerCase()}`),
        ];
        label = emos.length
          ? (moodVal != null ? `Feeling ${emos.join(', ')} · Mood ${moodVal}/5` : `Feeling ${emos.join(', ')}`)
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
      case 'collection':
        payloadSymptoms = colls.map((c) => `collection:${c}`);
        label = colls.length ? `Collection: ${colls.join(', ')}` : 'No collection';
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
    // Save the selected emotions exactly as picked. If she untapped the
    // last feeling and never picked a mood face, there is nothing to
    // save, and nothing is invented for her.
    if (next.length > 0 || mood !== null) saveNow('mood', { emotions: next });
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

  // Tapping a collection chip saves the updated set at once, exactly
  // like cravings: any mix can be on, and the tap saves right away.
  const handleCollectionToggle = (c) => {
    const next = collection.includes(c) ? collection.filter((v) => v !== c) : [...collection, c];
    setCollection(next);
    setLastKind('collection');
    if (next.length > 0) saveNow('collection', { collection: next });
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
        style={{ background: 'linear-gradient(180deg, #241226 0%, #160b1a 100%)', border: '1px solid rgba(255,79,154,0.25)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-6">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Heart className="w-5 h-5" style={{ color: moodColor }} />
              <h3 className="text-white text-lg font-script">How do you feel?</h3>
            </div>
            <button onClick={onClose} aria-label="Close" className="text-[#CFC3CC] hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-[#CFC3CC] text-xs mb-5" style={{ fontFamily: 'Poppins, sans-serif' }}>
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
                <span className="text-[10px]" style={{ fontFamily: 'Poppins, sans-serif', color: mood === m.value ? '#fff' : '#CFC3CC' }}>{m.label}</span>
              </button>
            ))}
          </div>
          <p className="text-[#CFC3CC] text-[10px] tracking-widest uppercase mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
            And what you are really feeling
          </p>
          <div className="flex flex-wrap gap-2 mb-1">
            {EMOTION_OPTIONS.filter((e) => showAllFeelings || CORE_EMOTIONS.includes(e.label) || emotions.includes(e.label)).map((e, idx) => {
              const active = emotions.includes(e.label);
              return (
                <button
                  key={e.label}
                  onClick={() => handleEmotionToggle(e.label)}
                  className="emotion-chip rounded-full px-3.5 py-2 text-sm"
                  style={{ ...chip(active, moodColor) }}
                  aria-label={e.label}
                  aria-pressed={active}
                >
                  {e.emoji} {e.label}
                </button>
              );
            })}
          </div>
          <button type="button" onClick={() => setShowAllFeelings(!showAllFeelings)} className="text-sm underline mt-1 mb-2" style={{ color: '#C9B8F0', fontFamily: 'Poppins, sans-serif' }} data-testid="more-feelings-btn">
            {showAllFeelings ? 'Fewer feelings' : 'More feelings'}
          </button>

{mode !== 'emotions' && (
            <>
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

          <SectionTitle Icon={Droplet} color="#ff7096">Collection</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {COLLECTION_OPTIONS.map((c) => (
              <button
                key={c} onClick={() => handleCollectionToggle(c)}
                className="px-3 py-1.5 rounded-full text-xs"
                style={chip(collection.includes(c), '#ff7096')}
              >
                {c}
              </button>
            ))}
          </div>

          <SectionTitle Icon={Sun} color={colorOf('energy')}>Energy</SectionTitle>
          <div>
            <div className="flex justify-between text-xs mb-2" style={{ fontFamily: 'Poppins, sans-serif', color: '#CFC3CC' }}>
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
            <div className="flex justify-between text-xs mb-2" style={{ fontFamily: 'Poppins, sans-serif', color: '#CFC3CC' }}>
              <span>Hours slept</span>
              <span className="text-white text-base font-semibold">{sleepHours}h</span>
            </div>
            <input
              type="range" min="0" max="12" step="0.5" value={sleepHours}
              onChange={(e) => { setSleepHours(parseFloat(e.target.value)); setLastKind('sleep'); }}
              onPointerUp={(e) => saveNow('sleep', { sleepHours: parseFloat(e.target.value) })}
              className="w-full accent-[#C9B8F0] mb-4"
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

            </>
          )}
        </div>
        <div className="px-6 pb-6 pt-1">
          {/* Save status: every tap above already saved to today. This line
              is the proof, and a failure shows here instead of vanishing. */}
          <div className="h-5 mb-2 flex items-center justify-center" aria-live="polite">
            {saveState === 'saving' && (
              <span className="text-[11px]" style={{ fontFamily: 'Poppins, sans-serif', color: '#CFC3CC' }}>Saving to today…</span>
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
            style={{ background: '#FF4F9A', fontFamily: 'Poppins, sans-serif' }}
          >
            {saveState === 'saving' ? 'Saving…' : 'Done'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FloatingCarousel({ token }) {
  // Quick log is a static row of five large buttons (launch fixes): no
  // orbit, no motion, nothing to chase with a thumb.
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState('full'); // 'full' | 'emotions'
  const [justLogged, setJustLogged] = useState(false);
  const pillTimer = useRef(null);

  return (
    <div className="mb-6" data-testid="floating-carousel">
      <p className="text-white text-sm mb-3 text-center" style={{ fontFamily: 'Poppins, sans-serif' }}>
        Log today
      </p>
      <div className="grid grid-cols-5 gap-2" data-testid="quick-log-row">
        {CATEGORIES.map((cat) => {
          const { Icon } = cat;
          return (
            <button
              key={cat.id}
              data-testid={`quick-log-${cat.id}`}
              className="flex flex-col items-center gap-1.5 py-3 rounded-2xl border border-white/10 active:scale-95 transition-transform"
              style={{ background: 'rgba(255,255,255,0.05)', minHeight: 76 }}
              onClick={() => { setSheetMode(cat.id === 'mood' ? 'emotions' : 'full'); setSheetOpen(true); }}
              aria-label={`Log ${cat.label}`}
            >
              <span className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: `${cat.color}33`, border: `1.5px solid ${cat.color}` }}>
                <Icon className="w-5 h-5" style={{ color: '#fff' }} />
              </span>
              <span className="text-[11px] font-medium text-white" style={{ fontFamily: 'Poppins, sans-serif' }}>{cat.label}</span>
            </button>
          );
        })}
      </div>
      {justLogged && (
        <p className="text-center text-sm mt-3" style={{ fontFamily: 'Poppins, sans-serif', color: '#7FD9A8' }} role="status">✓ Saved to today</p>
      )}

      {sheetOpen && (
        <QuickLogSheet
          mode={sheetMode}
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
