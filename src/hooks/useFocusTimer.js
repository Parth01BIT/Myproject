import { useContext } from 'react';
import { FocusTimerCtx } from '../contexts/FocusTimer.jsx';
import DataStore from '../store/DataStore.js';

/**
 * Primary hook for Focus Timer consumers — returns the full context object.
 * Must be used inside <FocusTimerProvider>.
 */
export function useFocusTimer() {
  const ctx = useContext(FocusTimerCtx);
  if (!ctx) throw new Error('useFocusTimer must be used within <FocusTimerProvider>');
  return ctx;
}

/**
 * Lightweight hook for components that just want to know "is a focus session
 * running right now?" — used by the TabBar pulse indicator and Today's
 * "live" chip.
 */
export function useFocusStatus() {
  const ctx = useContext(FocusTimerCtx);
  if (!ctx) return { running: false, playingTabId: null };
  return {
    running: ctx.status === 'running' || ctx.status === 'paused',
    paused: ctx.status === 'paused',
    mode: ctx.mode,
    /** Tab id where the pulse indicator should show (only when bound to a task). */
    playingTabId: ctx.status !== 'idle' && ctx.taskId ? 'planner' : null,
    taskId: ctx.taskId,
    version: ctx.version,
  };
}

/**
 * Detect whether a 'Focus minutes' numeric tracker already exists.
 * V2.4: async against Supabase. FocusWidget hydrates the boolean via
 * useAsyncResult.
 */
export async function hasFocusMinutesTracker() {
  try {
    const trackers = await DataStore.tracker.list();
    return trackers.some((t) => {
      if (t.type !== 'number') return false;
      const name = (t.name || '').trim().toLowerCase();
      const candidates = ['focus minutes', 'focus min', 'focus-minutes', 'focus_time', 'focusminutes', 'focus', 'focus time'];
      if (candidates.includes(name)) return true;
      const unit = (t.unit || '').trim().toLowerCase();
      if (name === 'focus' && (unit === 'min' || unit === 'minutes')) return true;
      return false;
    });
  } catch (e) {
    console.warn('[PARTH] hasFocusMinutesTracker failed:', e?.message);
    return false;
  }
}
