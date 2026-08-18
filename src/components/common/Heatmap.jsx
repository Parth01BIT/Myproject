import { lastNDaysKeys } from '../../lib/date.js';

/**
 * GitHub-style contribution heatmap (PRD TR-008, TR-009).
 * 12 weeks (84 days) ending today.
 * Boolean tracker: on/off (filled vs empty cells, intensity graded by streak proximity)
 * Numeric tracker: intensity shade scaled to that tracker's max value over the range.
 */

const LEVELS_BOOLEANS = [
  'var(--surface)',
  'hsl(145, 55%, 30%)',
  'hsl(145, 55%, 42%)',
  'hsl(145, 55%, 54%)',
];
const LEVELS_NUMERIC = [
  'var(--surface)',
  'hsl(210, 70%, 28%)',
  'hsl(210, 70%, 40%)',
  'hsl(210, 75%, 56%)',
];

export default function Heatmap({ tracker, logs, n = 84 }) {
  const keys = lastNDaysKeys(n);
  // For numeric, compute max for scaling.
  let max = 0;
  if (tracker.type === 'number') {
    for (const k of keys) {
      const v = logs[k];
      if (typeof v === 'number' && v > max) max = v;
    }
  }

  const level = (key) => {
    const v = logs[key];
    if (v === undefined || v === null || v === false) {
      // not logged — cell is empty (level 0)
      return 0;
    }
    if (tracker.type === 'boolean') {
      return LEVELS_BOOLEANS.length - 1; // single tier on for booleans
    }
    // numeric — scale 1..3 by ratio against max
    if (max <= 0) return LEVELS_NUMERIC.length - 1;
    const r = v / max;
    if (r <= 0) return 0;
    if (r < 0.34) return 1;
    if (r < 0.67) return 2;
    return 3;
  };

  // Group into 12 columns (weeks), 7 rows (Sun..Sat) — GitHub layout.
  const cells = keys.map((k, i) => ({ key: k, idx: i, level: level(k) }));
  // Pad front so the first column starts on Sunday.
  const [fy, fm, fd] = cells[0].key.split('-').map(Number);
  const firstWeekday = new Date(fy, fm - 1, fd).getDay();
  const padded = [...Array(firstWeekday).fill(null), ...cells];

  const cols = [];
  for (let i = 0; i < padded.length + (7 - (padded.length % 7)) % 7; i++) {
    const col = Math.floor(i / 7);
    if (!cols[col]) cols.push([]);
    cols[col].push(padded[i] ?? null);
  }

  const palette = tracker.type === 'boolean' ? LEVELS_BOOLEANS : LEVELS_NUMERIC;

  return (
    <div className="heatmap" role="img" aria-label="12-week history grid">
      {cols.map((col, ci) => (
        <div className="heatmap__col" key={ci}>
          {col.map((cell, ri) => (
            <div
              key={ri}
              className="heatmap__cell"
              style={{ background: cell ? palette[cell.level] : 'transparent' }}
              title={cell ? `${cell.key}${cell.level > 0 ? ' · logged' : ''}` : ''}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
