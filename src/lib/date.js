/**
 * Date utilities for PARTH.
 * Internal storage format: YYYY-MM-DD
 * Display format (address bar, day labels): aug-16, aug-2026
 */

const MONTHS_SHORT = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];

export function todayKey() {
  return toKey(new Date());
}

export function toKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function fromKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key, n) {
  const d = fromKey(key);
  d.setDate(d.getDate() + n);
  return toKey(d);
}

export function dayShortLabel(key) {
  const d = fromKey(key);
  return `${MONTHS_SHORT[d.getMonth()]}-${d.getDate()}`;
}

export function monthLabelKey(year, monthIdx) {
  return `${MONTHS_SHORT[monthIdx]}-${year}`;
}

export function isoMonthKey(year, monthIdx) {
  return `${year}-${String(monthIdx + 1).padStart(2, '0')}`;
}

/**
 * Difference in days between two YYYY-MM-DD keys (b - a).
 * Only counts calendar days, ignores time-of-day.
 */
export function dayDiff(aKey, bKey) {
  const a = fromKey(aKey).getTime();
  const b = fromKey(bKey).getTime();
  return Math.round((b - a) / 86400000);
}

export function isSameDay(key, date) {
  return key === toKey(date);
}

export function shortWeekday(date) {
  return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][date.getDay()];
}

export function longDate(key) {
  const d = fromKey(key);
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const wd = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  return `${wd[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export function clampMonth(year, monthIdx) {
  // Normalize month overflow. Returns {year, monthIdx}.
  let y = year;
  let m = monthIdx;
  while (m < 0) { m += 12; y -= 1; }
  while (m > 11) { m -= 12; y += 1; }
  return { year: y, monthIdx: m };
}

/**
 * Returns an array of 42 day-cells (6 weeks) for a month grid.
 * Each cell: { key, dayOfMonth, inMonth, isToday }
 */
export function monthGrid(year, monthIdx, todayK = todayKey()) {
  const first = new Date(year, monthIdx, 1);
  const startWeekday = first.getDay();
  const gridStart = new Date(year, monthIdx, 1 - startWeekday);
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    const key = toKey(d);
    cells.push({
      key,
      dayOfMonth: d.getDate(),
      inMonth: d.getMonth() === monthIdx,
      isToday: key === todayK,
    });
  }
  return cells;
}

export function lastNDaysKeys(n, endKey = todayKey()) {
  const keys = [];
  for (let i = n - 1; i >= 0; i--) keys.push(addDays(endKey, -i));
  return keys;
}
