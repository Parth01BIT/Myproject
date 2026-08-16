import DataStore from '../store/DataStore.js';
import { addDays, todayKey } from './date.js';

/**
 * Streak calculation with forgiveness (PRD TR-005, TR-007).
 * V2.4: now async + range-fetches all logs in a single query, then walks
 * the map locally. (Previously looped 1095 sequential getLog calls, which
 * would be 1095 network round-trips against Supabase — a full History tab
 * load would have taken minutes.)
 *
 * Rules:
 *  - A day with explicit `value === false` breaks the streak.
 *  - A day with no log (the app wasn't opened) freezes the streak — does NOT break.
 *  - A day with `value === true` increments.
 *
 * @param {string} trackerId
 * @returns {Promise<{ current: number, longest: number, lastLogged: string|null, frozen: boolean }>}
 */
export async function computeStreak(trackerId) {
  const today = todayKey();
  const earliest = addDays(today, -1094); // 3-year probe window
  const logsMap = await DataStore.tracker.getLogsForRange(trackerId, earliest, today);

  let trueRun = 0;       // active trailing run including today
  let frozen = true;
  let lastLogged = null;
  let longest = 0;
  let currentRun = 0;    // running tally for longest sweep over history
  let hitToday = false;

  for (let i = 0; i < 1095; i++) {
    const key = addDays(today, -i);
    const log = logsMap.has(key) ? { value: logsMap.get(key) } : null;

    if (log === null) {
      if (i === 0) frozen = true;
      continue;
    }

    lastLogged ||= key;
    if (i === 0) hitToday = true;

    if (log.value === true) {
      currentRun++;
      longest = Math.max(longest, currentRun);
      if (trueRun !== -1) trueRun++;
    } else if (log.value === false) {
      if (trueRun !== -1) {
        longest = Math.max(longest, trueRun);
        trueRun = -1;
        currentRun = 0;
      } else {
        currentRun = 0;
      }
    }
    // Any other value (numeric on a boolean tracker, etc.) treats as no-op.
  }

  const current = trueRun === -1 ? 0 : trueRun;
  frozen = !hitToday;

  return {
    current,
    longest: Math.max(longest, current),
    lastLogged,
    frozen,
  };
}
