import React, { useState, useEffect } from 'react';

// Tappable month / day / year dropdowns. Used instead of <input type="date">,
// which does not open a picker when tapped inside some Android WebViews.
// Emits a "YYYY-MM-DD" string once all three parts are chosen, "" otherwise.
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function daysInMonth(year, month) {
  return new Date(Number(year), Number(month), 0).getDate();
}

function splitValue(v) {
  const p = (v || '').split('-');
  return { y: p[0] || '', m: p[1] || '', d: p[2] || '' };
}

export default function DateSelect({ value, onChange, testId, minYear, maxYear }) {
  const [parts, setParts] = useState(() => splitValue(value));

  // Stay in sync when the parent sets the value from elsewhere
  // (for example the "about 2 weeks ago" estimate button).
  useEffect(() => {
    const incoming = splitValue(value);
    setParts((prev) => {
      const composed = prev.y && prev.m && prev.d
        ? `${prev.y}-${prev.m}-${prev.d}`
        : '';
      return composed === (value || '') ? prev : incoming;
    });
  }, [value]);

  const emit = (np) => {
    setParts(np);
    if (np.y && np.m && np.d) {
      const dim = daysInMonth(np.y, np.m);
      const day = String(Math.min(Number(np.d), dim)).padStart(2, '0');
      onChange(`${np.y}-${np.m}-${day}`);
    } else {
      onChange('');
    }
  };

  const years = [];
  for (let yr = maxYear; yr >= minYear; yr--) years.push(String(yr));
  const days = [];
  for (let dd = 1; dd <= 31; dd++) days.push(String(dd).padStart(2, '0'));

  const selClass = 'input-dark min-w-0 w-full';
  // Tighter side padding so the 4-digit year is never clipped on phones.
  const selStyle = { colorScheme: 'dark', paddingLeft: 10, paddingRight: 22, fontSize: 15, textOverflow: 'clip' };

  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: '1.5fr 1fr 1.25fr' }} data-testid={testId}>
      <select
        aria-label="Month"
        className={selClass}
        style={selStyle}
        value={parts.m}
        onChange={(e) => emit({ ...parts, m: e.target.value })}
      >
        <option value="">Month</option>
        {MONTHS.map((name, i) => (
          <option key={name} value={String(i + 1).padStart(2, '0')}>{name.slice(0, 3)}</option>
        ))}
      </select>
      <select
        aria-label="Day"
        className={selClass}
        style={selStyle}
        value={parts.d}
        onChange={(e) => emit({ ...parts, d: e.target.value })}
      >
        <option value="">Day</option>
        {days.map((dd) => (
          <option key={dd} value={dd}>{Number(dd)}</option>
        ))}
      </select>
      <select
        aria-label="Year"
        className={selClass}
        style={selStyle}
        value={parts.y}
        onChange={(e) => emit({ ...parts, y: e.target.value })}
      >
        <option value="">Year</option>
        {years.map((yr) => (
          <option key={yr} value={yr}>{yr}</option>
        ))}
      </select>
    </div>
  );
}
