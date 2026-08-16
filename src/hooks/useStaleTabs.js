import { useState, useCallback } from 'react';
import { useAsyncResult } from './useAsyncResult.js';
import { todayKey } from '../lib/date.js';
import DataStore from '../store/DataStore.js';

/**
 * Determines which tabs are "stale" for today (PRD §6.7.2).
 * V2.4: now async — the underlying DataStore calls hit Supabase.
 *
 * @param {string} dayKey  the day to evaluate (defaults to today)
 * @param {number} version bump to force recomputation after writes
 * @returns {{ stale, loading, error, reload }}
 *   - `stale` is the same shape as before (object of booleans keyed by tab id)
 *   - `loading` and `error` cover the async fetch
 *   - `reload` re-runs the fetcher on demand
 */
export async function computeStale(dayKey) {
  const date = dayKey || todayKey();

  const [j, p, trackers] = await Promise.all([
    DataStore.journal.get(date),
    DataStore.planner.get(date),
    DataStore.tracker.list(),
  ]);

  const journalStale = !j || (!j.content && !j.mood && (!j.tags || j.tags.length === 0));
  const plannerStale = !p || !p.tasks || p.tasks.length === 0;

  let trackerStale = trackers.length === 0;
  if (!trackerStale) {
    // Single batch lookup: ask each tracker for today's log in parallel.
    const logResults = await Promise.all(
      trackers.map((t) => DataStore.tracker.getLog(t.id, date))
    );
    trackerStale = logResults.every((log) => !log);
  }

  const allStale = journalStale && plannerStale && trackerStale;

  return {
    journal: journalStale,
    planner: plannerStale,
    tracker: trackerStale,
    history: false,  // PRD ST-004 — retrospective, never stale
    clock: false,   // V2.2 — pure utility, never stale
    today: allStale, // PRD ST-005
  };
}

export function useStaleTabs(dayKey, version) {
  const out = useAsyncResult(
    `stale:${dayKey || todayKey()}:${version}`,
    () => computeStale(dayKey),
    [dayKey, version]
  );
  // Default to non-stale / visible until the async load resolves so the
  // chrome doesn't flash red on every boot.
  const stale = out.data || {
    journal: false, planner: false, tracker: false,
    history: false, clock: false, today: false,
  };
  return { stale, loading: out.loading, error: out.error, reload: out.reload };
}

/**
 * Subscribe hook — re-reads staleness when its version prop bumps
 * (we bump the version anytime a tab writes via DataStore).
 */
export function useStaleVersion() {
  const [v, setV] = useState(0);
  const bump = useCallback(() => setV((x) => x + 1), []);
  return [v, bump];
}
