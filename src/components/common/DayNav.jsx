import { addDays, dayShortLabel, longDate } from '../../lib/date.js';

/**
 * Reusable day navigator (PRD JN-012, PL-009).
 * Shows prev/next arrows and a long date label. Calls onChange(newKey).
 * `maxKey` clamps the "next" navigation (usually today).
 */
export default function DayNav({ dateKey, onChange, maxKey = null, showLong = true }) {
  const prev = () => onChange(addDays(dateKey, -1));
  const nextKey = addDays(dateKey, 1);
  const next = () => onChange(nextKey);
  const allowNext = !maxKey || nextKey <= maxKey;

  return (
    <div className="daynav">
      <button
        className="daynav__btn"
        onClick={prev}
        aria-label="Previous day"
      >‹</button>
      <div className="daynav__label">
        {showLong ? longDate(dateKey) : dayShortLabel(dateKey)}
      </div>
      <button
        className="daynav__btn"
        onClick={next}
        disabled={!allowNext}
        aria-label="Next day"
      >›</button>
    </div>
  );
}
