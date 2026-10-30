// One source of truth for brand + phase colours (Orio launch fixes).
// Navy background, pink for actions, one soft lilac accent, and a fixed
// colour per cycle phase used everywhere (day circle, cards, calendar).
export const BRAND = {
  bg: '#0B0B1E',
  surface: '#15152B',
  pink: '#FF4F9A',
  lilac: '#C9B8F0',
  text: '#F7F4FA',
  textMuted: '#CFC8DC',
};

export const PHASE_COLORS = {
  menstrual: '#E85A6B',
  follicular: '#FF9EC7',
  ovulatory: '#F5C26B',
  luteal: '#A98BEA',
  late: '#9C9CB8',
  unknown: '#9C9CB8',
};

// Phase color PAIRS (v55, Angelita, Oct 30, 2026). Her words: menstrual
// is bright orange and red, pretty much the logo colors; follicular is
// bright pink and blue; ovulation is bright pink and green; luteal is
// bright pink and purple. Everything in the app is coded by these
// pairs: primary is the lead color a surface already used, secondary
// is its pair partner (gradients, glows, second series). The shared
// pink is her app pink #F74093; the green anchor is the app's existing
// fertile green #5DBB8A and the purple anchor is the existing luteal
// #A98BEA. THIS object is the one place to adjust them; every surface
// reads from here.
export const PHASE_PAIRS = {
  menstrual: { primary: '#E85A6B', secondary: '#FF7A29' },
  follicular: { primary: '#F74093', secondary: '#4FA8FF' },
  ovulatory: { primary: '#F74093', secondary: '#5DBB8A' },
  luteal: { primary: '#F74093', secondary: '#A98BEA' },
  late: { primary: '#E85A6B', secondary: '#FF7A29' },
  unknown: { primary: '#9C9CB8', secondary: '#6E6E8E' },
};

export const phasePair = (phase) => PHASE_PAIRS[phase] || PHASE_PAIRS.unknown;

export const PHASE_NAMES = {
  menstrual: 'Menstrual',
  follicular: 'Follicular',
  ovulatory: 'Ovulatory',
  luteal: 'Luteal',
  late: 'Period expected',
  unknown: 'Cycle not set',
};

export const phaseColor = (phase) => PHASE_COLORS[phase] || PHASE_COLORS.unknown;

export const HEADING_FONT = "'Poiret One', sans-serif";
export const BODY_FONT = "'Poppins', sans-serif";

// Client-side phase from the user record, same day thresholds as the
// server (backend calculate_cycle_info). Used only for decoration.
export const phaseFromUser = (user) => {
  if (!user?.last_period_date) return 'unknown';
  const L = user.cycle_length || 28;
  const start = new Date(user.last_period_date + 'T00:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.floor((today - start) / 86400000);
  if (diff < 0) return 'unknown';
  if (diff >= L) return 'late';
  const day = diff + 1;
  if (day <= 5) return 'menstrual';
  if (day <= 12) return 'follicular';
  if (day <= 19) return 'ovulatory';
  return 'luteal';
};
