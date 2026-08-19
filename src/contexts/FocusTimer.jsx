import {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import DataStore from '../store/DataStore.js';
import { uuid } from '../lib/uuid.js';
import { todayKey } from '../lib/date.js';

/**
 * FocusTimer context (V2.3).
 *
 * Owns a single in-flight session. Cross-cuts:
 *   - Planner (launch ▶)
 *   - Floating widget (render-once at app level)
 *   - TabBar (pulsing dot)
 *   - Tracker auto-feed (writes 'Focus minutes' if a matching tracker exists)
 *   - History/DataStore.focus (session log)
 *
 * Lifecycle rules (finalized in plan-mode discussion):
 *   - Natural completion: {completed:true}, no stopReason, trigger 5-min auto-break.
 *   - Manual Stop/Reset: stopReason:'manual'.
 *   - Auto-stop via new task: stopReason:'switched'.
 *   - For EITHER interrupted stop: elapsed ≥ 60s → write session as
 *     {completed:false, stopReason}, feed trackers by actual elapsed minutes,
 *     do NOT trigger auto-break. elapsed < 60s → discard silently (mis-click).
 */
export const FocusTimerCtx = createContext(null);

export const FOCUS_DEFAULT_SEC  = 25 * 60;
export const BREAK_DEFAULT_SEC  = 5 * 60;
const MIN_KEEP_SECONDS = 60;

export function FocusTimerProvider({ children }) {
  // status: 'idle' | 'running' | 'paused'
  // mode:   'focus' | 'break'
  const [status, setStatus] = useState('idle');
  const [mode, setMode] = useState('focus');

  // Configurable durations (UI drives these; refs mirror for the timing loop).
  const [focusSec, setFocusSec] = useState(FOCUS_DEFAULT_SEC);
  const [breakSec, setBreakSec] = useState(BREAK_DEFAULT_SEC);
  const focusSecRef = useRef(FOCUS_DEFAULT_SEC);
  const breakSecRef = useRef(BREAK_DEFAULT_SEC);

  // session linkage
  const [taskId, setTaskId] = useState(null);
  const [taskTitle, setTaskTitle] = useState(null);
  // Refs mirror state so beforeunload handler always reads the current value.
  const taskIdRef   = useRef(null);
  const taskTitleRef = useRef(null);
  useEffect(() => { taskIdRef.current   = taskId;    }, [taskId]);
  useEffect(() => { taskTitleRef.current = taskTitle; }, [taskTitle]);

  // timing refs (drift-proof)
  const deadlineRef       = useRef(0);
  const remainingRef      = useRef(FOCUS_DEFAULT_SEC * 1000);
  const startedAtRef      = useRef(null);
  const elapsedAtPauseRef = useRef(0);
  const rafRef            = useRef(0);

  // bump version: forces consumers (widget, today stat, planner highlight) to re-render.
  const [version, setVersion] = useState(0);
  const bump = useCallback(() => setVersion((v) => v + 1), []);
  const [, setTick] = useState(0);

  // Mirror latest refs of state needed by riskeEn queue handlers.
  const statusRef = useRef(status);
  const modeRef = useRef(mode);
  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { modeRef.current = mode; }, [mode]);

  // ---------- Flush any session saved by a previous beforeunload ----------
  // If the user refreshed mid-session, the beforeunload handler (below) will
  // have serialised the in-flight session to sessionStorage. Flush it to
  // Supabase on this mount before anything else.
  useEffect(() => {
    const raw = sessionStorage.getItem('parth:pending-focus-session');
    if (!raw) return;
    sessionStorage.removeItem('parth:pending-focus-session');
    try {
      const { session, dateKey } = JSON.parse(raw);
      DataStore.focus.add(dateKey, session).catch((e) =>
        console.warn('[PARTH] flush pending session failed:', e?.message)
      );
    } catch {
      // Corrupt entry — ignore silently.
    }
  }, []); // mount only

  // ---------- Save in-flight session on page refresh / unload ----------
  // beforeunload fires synchronously. Supabase fetch won't complete in time,
  // so we write to sessionStorage instead (survives refresh, cleared on close).
  // The flush effect above picks this up on the next mount.
  useEffect(() => {
    const handleUnload = () => {
      if (statusRef.current === 'idle') return;

      const plannedSec = focusSecRef.current;
      const remainingSec = remainingRef.current / 1000;
      const elapsedSec = Math.max(0, Math.round(plannedSec - remainingSec));

      if (elapsedSec < MIN_KEEP_SECONDS) return; // too short — discard

      const session = {
        id: uuid(),
        taskId:    taskIdRef.current,
        taskTitle: taskTitleRef.current,
        startedAt: startedAtRef.current,
        endedAt:   new Date().toISOString(),
        durationSec: plannedSec,
        elapsedSec,
        mode:      modeRef.current,
        completed: false,
        stopReason: 'page_unload',
      };

      try {
        const dateKey = new Date().toISOString().slice(0, 10);
        sessionStorage.setItem(
          'parth:pending-focus-session',
          JSON.stringify({ session, dateKey })
        );
      } catch {
        // sessionStorage full or disabled — silently drop.
      }
    };

    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, []); // refs keep this stable — no deps needed

  // ---------- Helpers (single-flight) ----------


  const writeSession = useCallback((partial) => {
    const plannedSec = focusSecRef.current;
    const remainingSec = remainingRef.current / 1000;
    const elapsedSec = Math.max(0, Math.min(plannedSec, Math.round(plannedSec - remainingSec)));

    const session = {
      id: uuid(),
      taskId: taskId ?? null,
      taskTitle: taskTitle ?? null,
      startedAt: startedAtRef.current,
      endedAt: new Date().toISOString(),
      durationSec: plannedSec,
      elapsedSec,
      mode: modeRef.current,
      completed: false,
      ...partial,
    };
    // V2.4: async post to Supabase. Fire-and-forget since the session is
    // already captured in memory for the active UI. Errors logged but not
    // surfaced — Stage B scope excludes sync indicator UI.
    DataStore.focus.add(todayKey(), session).catch((e) =>
      console.warn('[PARTH] focus.add failed:', e?.message)
    );
    if (session.mode === 'focus' && session.elapsedSec >= MIN_KEEP_SECONDS) {
      feedFocusTracker(Math.round(session.elapsedSec / 60));
    }
    return session;
  }, [taskId, taskTitle]);

  /** Interrupted stop (manual or switched). Resets to idle. */
  const interrupt = useCallback((stopReason) => {
    if (statusRef.current === 'idle') return;
    const plannedSec = focusSecRef.current;
    const remainingSec = remainingRef.current / 1000;
    const elapsedSec = Math.max(0, Math.round(plannedSec - remainingSec));

    setStatus('idle');
    statusRef.current = 'idle';

    if (elapsedSec >= MIN_KEEP_SECONDS) {
      writeSession({
        elapsedSec,
        completed: false,
        stopReason,
      });
    }

    setTaskId(null);
    setTaskTitle(null);
    setMode('focus');
    modeRef.current = 'focus';
    elapsedAtPauseRef.current = 0;
    startedAtRef.current = null;
    remainingRef.current = focusSecRef.current * 1000;
    bump();
  }, [writeSession, bump]);

  /** Natural completion — fires when deadline hits inside the rAF loop. */
  const handleNaturalComplete = useCallback(() => {
    // Force remaining to 0 so the display shows 00:00 before transitioning.
    remainingRef.current = 0;

    writeSession({
      elapsedSec: focusSecRef.current,
      completed: true,
    });

    if (modeRef.current === 'focus') {
      // auto-break
      breakSecRef.current = BREAK_DEFAULT_SEC;
      setBreakSec(BREAK_DEFAULT_SEC);
      modeRef.current = 'break';
      setMode('break');
      remainingRef.current = BREAK_DEFAULT_SEC * 1000;
      deadlineRef.current = performance.now() + remainingRef.current;
      startedAtRef.current = new Date().toISOString();
      elapsedAtPauseRef.current = 0;
      setStatus('running');
      statusRef.current = 'running';
    } else {
      // break ended → idle
      setTaskId(null);
      setTaskTitle(null);
      modeRef.current = 'focus';
      setMode('focus');
      elapsedAtPauseRef.current = 0;
      startedAtRef.current = null;
      remainingRef.current = focusSecRef.current * 1000;
      setStatus('idle');
      statusRef.current = 'idle';
    }
    bump();
  }, [writeSession, bump]);

  // ---------- rAF display loop ----------

  useEffect(() => {
    const draw = () => {
      if (statusRef.current === 'running') {
        const rem = deadlineRef.current - performance.now();
        if (rem <= 0) {
          remainingRef.current = 0;
          handleNaturalComplete();
        } else {
          remainingRef.current = rem;
        }
      }
      setTick((t) => (t + 1) % 1000000);
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [handleNaturalComplete]);

  // ---------- Public actions ----------

  const start = useCallback((task) => {
    // Collision: a session already in flight → interrupt as 'switched'.
    if (statusRef.current === 'running' || statusRef.current === 'paused') {
      interrupt('switched');
    }

    focusSecRef.current = focusSec;
    setTaskId(task?.id ?? null);
    setTaskTitle(task?.title ?? null);
    modeRef.current = 'focus';
    setMode('focus');

    remainingRef.current = focusSec * 1000;
    elapsedAtPauseRef.current = 0;
    startedAtRef.current = new Date().toISOString();
    deadlineRef.current = performance.now() + remainingRef.current;

    setStatus('running');
    statusRef.current = 'running';
    bump();
  }, [focusSec, interrupt, bump]);

  const pause = useCallback(() => {
    if (statusRef.current !== 'running') return;
    elapsedAtPauseRef.current += (focusSecRef.current * 1000) - remainingRef.current;
    setStatus('paused');
    statusRef.current = 'paused';
    bump();
  }, [bump]);

  const resume = useCallback(() => {
    if (statusRef.current !== 'paused') return;
    deadlineRef.current = performance.now() + remainingRef.current;
    setStatus('running');
    statusRef.current = 'running';
    bump();
  }, [bump]);

  const stop = useCallback(() => {
    if (statusRef.current === 'idle') return;
    interrupt('manual');
  }, [interrupt]);

  const startBreak = useCallback((durationSec) => {
    breakSecRef.current = durationSec;
    setBreakSec(durationSec);
    modeRef.current = 'break';
    setMode('break');
    remainingRef.current = durationSec * 1000;
    startedAtRef.current = new Date().toISOString();
    elapsedAtPauseRef.current = 0;
    deadlineRef.current = performance.now() + remainingRef.current;
    setStatus('running');
    statusRef.current = 'running';
    bump();
  }, [bump]);

  // Sync refs when config changes while idle.
  useEffect(() => {
    if (status === 'idle' && mode === 'focus') {
      remainingRef.current = focusSec * 1000;
      focusSecRef.current = focusSec;
    }
  }, [focusSec, status, mode]);

  useEffect(() => {
    if (status === 'idle' && mode === 'break') {
      remainingRef.current = breakSec * 1000;
      breakSecRef.current = breakSec;
    }
  }, [breakSec, status, mode]);

  // Pickle the tick cadence: widget reads via context value re-computation,
  // which is driven by status changes (handled above) rather than polling.
  // A light 200ms redraw trigger is enough for clock-feel:
  useEffect(() => {
    if (status !== 'running') return;
    const t = setInterval(() => setTick((v) => (v + 1) % 1000000), 200);
    return () => clearInterval(t);
  }, [status]);

  //---------- Derived for consumers ----------

  const remainingMs = remainingRef.current;
  const remainingSecInt = status === 'idle'
    ? (mode === 'focus' ? focusSec : breakSec)
    : Math.max(0, Math.ceil(remainingMs / 1000));

  const isFocusingTask = useCallback((targetTaskId) => {
    return status !== 'idle' && taskId === targetTaskId;
  }, [status, taskId]);

  const totalMs = (mode === 'focus' ? focusSec : breakSec) * 1000;
  const usedMs = totalMs - (status === 'running' || status === 'paused' ? remainingMs : 0);
  const progress = totalMs > 0 ? Math.max(0, Math.min(1, usedMs / totalMs)) : 0;

  const value = useMemo(() => ({
    status,
    mode,
    taskId,
    taskTitle,
    focusSec,
    breakSec,
    remainingSec: remainingSecInt,
    progress,
    version,
    setFocusSec,
    setBreakSec,
    start,
    pause,
    resume,
    stop,
    startBreak,
    isFocusingTask,
  }), [
    status, mode, taskId, taskTitle, focusSec, breakSec,
    remainingSecInt, progress, version,
    start, pause, resume, stop, startBreak, isFocusingTask,
  ]);

  return (
    <FocusTimerCtx.Provider value={value}>
      {children}
    </FocusTimerCtx.Provider>
  );
}

/* ---------- helpers ---------- */

/**
 * Locate a "Focus minutes" number tracker (case-insensitive name match on a
 * allowlist) and write elapsed minutes onto today's log. If none exists,
 * no-op — the user gets a soft tip in the widget instead.
 *
 * V2.4: now async — reads tracker.list then existing log, then writes.
 * Fire-and-forget from writeSession; errors only logged.
 */
async function feedFocusTracker(minutes) {
  try {
    const trackers = await DataStore.tracker.list();
    const target = trackers.find((t) => {
      if (t.type !== 'number') return false;
      const name = (t.name || '').trim().toLowerCase();
      if (!name) return false;
      const candidates = [
        'focus minutes', 'focus min', 'focus-minutes', 'focus_time',
        'focusminutes', 'focus', 'focus time',
      ];
      if (candidates.includes(name)) return true;
      const unit = (t.unit || '').trim().toLowerCase();
      if (name === 'focus' && (unit === 'min' || unit === 'minutes')) return true;
      return false;
    });
    if (!target) return;
    const dayK = todayKey();
    const existing = await DataStore.tracker.getLog(target.id, dayK);
    const prev = existing != null && typeof existing.value === 'number' ? existing.value : 0;
    await DataStore.tracker.log(target.id, dayK, prev + minutes);
  } catch (e) {
    console.warn('[PARTH] feedFocusTracker failed:', e?.message);
  }
}
