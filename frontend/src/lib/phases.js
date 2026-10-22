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
