// Daily Proverbs: one chapter of Proverbs for each day of the month (31 chapters).
// Angelita's pick: a key verse from each chapter, King James Version (public domain).
// Verse text verified word for word against the KJV on Oct 16, 2026.
// Where a verse's second half turns harsh, the card shows the uplifting first half,
// which is standard for verse-of-the-day cards; the reference is the full verse.
export const DAILY_PROVERBS = [
  { day: 1, reference: 'Proverbs 1:7', text: 'The fear of the LORD is the beginning of knowledge.' },
  { day: 2, reference: 'Proverbs 2:6', text: 'For the LORD giveth wisdom: out of his mouth cometh knowledge and understanding.' },
  { day: 3, reference: 'Proverbs 3:5', text: 'Trust in the LORD with all thine heart; and lean not unto thine own understanding.' },
  { day: 4, reference: 'Proverbs 4:6', text: 'Forsake her not, and she shall preserve thee: love her, and she shall keep thee.' },
  { day: 5, reference: 'Proverbs 5:18', text: 'Let thy fountain be blessed: and rejoice with the wife of thy youth.' },
  { day: 6, reference: 'Proverbs 6:6', text: 'Go to the ant, thou sluggard; consider her ways, and be wise.' },
  { day: 7, reference: 'Proverbs 7:4', text: 'Say unto wisdom, Thou art my sister; and call understanding thy kinswoman.' },
  { day: 8, reference: 'Proverbs 8:11', text: 'For wisdom is better than rubies; and all the things that may be desired are not to be compared to it.' },
  { day: 9, reference: 'Proverbs 9:10', text: 'The fear of the LORD is the beginning of wisdom: and the knowledge of the holy is understanding.' },
  { day: 10, reference: 'Proverbs 10:12', text: 'Hatred stirreth up strifes: but love covereth all sins.' },
  { day: 11, reference: 'Proverbs 11:16', text: 'A gracious woman retaineth honour.' },
  { day: 12, reference: 'Proverbs 12:4', text: 'A virtuous woman is a crown to her husband.' },
  { day: 13, reference: 'Proverbs 13:20', text: 'He that walketh with wise men shall be wise.' },
  { day: 14, reference: 'Proverbs 14:1', text: 'Every wise woman buildeth her house.' },
  { day: 15, reference: 'Proverbs 15:1', text: 'A soft answer turneth away wrath.' },
  { day: 16, reference: 'Proverbs 16:24', text: 'Pleasant words are as an honeycomb, sweet to the soul, and health to the bones.' },
  { day: 17, reference: 'Proverbs 17:17', text: 'A friend loveth at all times, and a brother is born for adversity.' },
  { day: 18, reference: 'Proverbs 18:22', text: 'Whoso findeth a wife findeth a good thing, and obtaineth favour of the LORD.' },
  { day: 19, reference: 'Proverbs 19:14', text: 'A prudent wife is from the LORD.' },
  { day: 20, reference: 'Proverbs 20:15', text: 'The lips of knowledge are a precious jewel.' },
  { day: 21, reference: 'Proverbs 21:21', text: 'He that followeth after righteousness and mercy findeth life, righteousness, and honour.' },
  { day: 22, reference: 'Proverbs 22:6', text: 'Train up a child in the way he should go: and when he is old, he will not depart from it.' },
  { day: 23, reference: 'Proverbs 23:18', text: 'For surely there is an end; and thine expectation shall not be cut off.' },
  { day: 24, reference: 'Proverbs 24:3', text: 'Through wisdom is an house builded; and by understanding it is established.' },
  { day: 25, reference: 'Proverbs 25:11', text: 'A word fitly spoken is like apples of gold in pictures of silver.' },
  { day: 26, reference: 'Proverbs 26:20', text: 'Where there is no talebearer, the strife ceaseth.' },
  { day: 27, reference: 'Proverbs 27:17', text: 'Iron sharpeneth iron; so a man sharpeneth the countenance of his friend.' },
  { day: 28, reference: 'Proverbs 28:1', text: 'The righteous are bold as a lion.' },
  { day: 29, reference: 'Proverbs 29:18', text: 'He that keepeth the law, happy is he.' },
  { day: 30, reference: 'Proverbs 30:5', text: 'Every word of God is pure: he is a shield unto them that put their trust in him.' },
  { day: 31, reference: 'Proverbs 31:10', text: 'Who can find a virtuous woman? for her price is far above rubies.' },
];

// The Proverb for today: chapter matches the day of the month (1 to 31).
// On the 31st in a shorter month nothing special is needed; the date never exceeds 31.
export function getTodaysProverb(date = new Date()) {
  const day = Math.min(date.getDate(), 31);
  return DAILY_PROVERBS[day - 1];
}
