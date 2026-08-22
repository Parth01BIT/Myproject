import { useState, useEffect, useCallback } from 'react';
import { todayKey, dayShortLabel, monthLabelKey, toKey, dayDiff } from '../lib/date.js';

/**
 * Tab definitions (PRD §5, §6).
 * `route` is the bare path prefix the browser URL uses (e.g. "/today").
 * Address bar renders `parth://{route}/{arg}` for display.
 */
export const TABS = [
  { id: 'today',   label: 'Today',   icon: '🏠' },
  { id: 'journal', label: 'Journal', icon: '📓' },
  { id: 'planner', label: 'Planner', icon: '🗓' },
  { id: 'tracker', label: 'Tracker', icon: '📊' },
  { id: 'cat',     label: 'CAT',     icon: '🎯' },
  { id: 'clock',   label: 'Clock',   icon: '⏱' },
  { id: 'history', label: 'History', icon: '🕰' },
];

const TAB_IDS = TABS.map((t) => t.id);

/**
 * Parse a browser pathname into { tab, dateKey, arg }.
 * Formats:
 *   /today            -> today / today
 *   /today/aug-16     -> today / resolved date for aug-<today's year>
 *   /journal/aug-16
 *   /planner/aug-16
 *   /tracker
 *   /history          -> history / current month
 *   /history/aug-2026 -> history / that month
 *   /history/aug-14   -> history / that day, month detail
 */
export function parsePath(pathname) {
  const segs = pathname.split('/').filter(Boolean);
  if (!segs.length || !TAB_IDS.includes(segs[0])) {
    return { tab: 'today', dateKey: todayKey(), arg: null };
  }
  const tab = segs[0];
  const arg = segs[1] || null;

  if (tab === 'tracker') return { tab, dateKey: todayKey(), arg: null };
  if (tab === 'clock')    return { tab, dateKey: todayKey(), arg: null };
  if (tab === 'cat')      return { tab, dateKey: todayKey(), arg: null };

  // Try to resolve arg as either "aug-16" (day) or "aug-2026" (month) or day-in-history "aug-14".
  if (arg) {
    const m = /^([a-z]{3})-(\d{1,4})$/.exec(arg);
    if (m) {
      const mon = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(m[1]);
      const tail = Number(m[2]);
      if (mon >= 0) {
        if (tail > 31) {
          // month form: aug-2026
          if (tab === 'history') return { tab, dateKey: null, arg: { type: 'month', year: tail, monthIdx: mon } };
          return { tab, dateKey: todayKey(), arg: null };
        }
        // day form: aug-16 (possibly aug-14 for history day detail)
        const y = new Date().getFullYear();
        const candidate = toKey(new Date(y, mon, tail));
        // If date is in the future relative to today, prefer previous year.
        let resolved = candidate;
        if (dayDiff(todayKey(), candidate) < 0) {
          resolved = toKey(new Date(y - 1, mon, tail));
        }
        if (tab === 'history') return { tab, dateKey: resolved, arg: { type: 'day', key: resolved } };
        return { tab, dateKey: resolved, arg: null };
      }
    }
  }
  if (tab === 'history') {
    const d = new Date();
    return { tab, dateKey: null, arg: { type: 'month', year: d.getFullYear(), monthIdx: d.getMonth() } };
  }
  return { tab, dateKey: todayKey(), arg: null };
}

export function buildPath(tab, dateKey, argOverride) {
  if (tab === 'tracker') return '/tracker';
  if (tab === 'clock')    return '/clock';
  if (tab === 'cat')      return '/cat';
  if (tab === 'history') {
    if (argOverride && argOverride.type === 'day') return `/history/${dayShortLabel(argOverride.key)}`;
    if (argOverride && argOverride.type === 'month') return `/history/${monthLabelKey(argOverride.year, argOverride.monthIdx)}`;
    const d = new Date();
    return `/history/${monthLabelKey(d.getFullYear(), d.getMonth())}`;
  }
  if (tab === 'today') return dateKey ? `/today/${dayShortLabel(dateKey)}` : '/today';
  return `/${tab}/${dayShortLabel(dateKey)}`;
}

/** Build the parth:// address-bar string from current route. */
export function buildAddress(tab, dateKey, arg) {
  if (tab === 'tracker') return 'parth://tracker';
  if (tab === 'clock')    return 'parth://clock';
  if (tab === 'cat')      return 'parth://cat/nov-29';
  if (tab === 'history') {
    if (arg && arg.type === 'day') return `parth://history/${dayShortLabel(arg.key)}`;
    if (arg && arg.type === 'month') return `parth://history/${monthLabelKey(arg.year, arg.monthIdx)}`;
    const d = new Date();
    return `parth://history/${monthLabelKey(d.getFullYear(), d.getMonth())}`;
  }
  // today / journal / planner
  const label = dateKey ? dayShortLabel(dateKey) : dayShortLabel(todayKey());
  return `parth://${tab}/${label}`;
}

/**
 * The main route hook. Syncs {tab, dateKey, arg} to window.history and
 * keeps state in sync on popstate.
 *
 * Returns: [route, setRoute]
 *   route = { tab, dateKey, arg }
 *   setRoute = (partial) => void  -- merges partial into current route + pushState
 */
export function useRoute() {
  const [route, setRouteState] = useState(() => parsePath(window.location.pathname));

  useEffect(() => {
    const onPop = () => setRouteState(parsePath(window.location.pathname));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Normalize initial URL if bare "/" or unknown tab.
  useEffect(() => {
    const correct = buildPath(route.tab, route.dateKey, route.arg);
    if (window.location.pathname !== correct) {
      window.history.replaceState({}, '', correct);
    }
  }, [route]);

  const setRoute = useCallback((partial) => {
    setRouteState((prev) => {
      let next = { ...prev, ...partial };
      // today/journal/planner always carry a dateKey; default to today.
      if (['today','journal','planner'].includes(next.tab) && !next.dateKey) {
        next.dateKey = todayKey();
      }
      const path = buildPath(next.tab, next.dateKey, next.arg);
      try {
        window.history.pushState({}, '', path);
      } catch {
        // If pushState fails (too many / sandboxed), fall back to replaceState.
        window.history.replaceState({}, '', path);
      }
      return next;
    });
  }, []);

  return [route, setRoute];
}
