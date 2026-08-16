import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * Clock tab (V2.2).
 * Pure utility — Stopwatch and Timer segments.
 * No DataStore writes (closing the tab wipes state).
 *
 * Display is rAF-driven from a high-resolution ref to avoid long-session drift.
 */

const PRESETS = [
  { label: '5m',  sec: 5 * 60 },
  { label: '15m', sec: 15 * 60 },
  { label: '25m', sec: 25 * 60 },
  { label: '1h',  sec: 60 * 60 },
];

const SEGMENTS = [
  { id: 'stopwatch', label: 'Stopwatch' },
  { id: 'timer',    label: 'Timer' },
];

export default function Clock() {
  const [segment, setSegment] = useState('stopwatch');
  return (
    <div className="clock">
      <div className="clock__segmented" role="tablist" aria-label="Clock mode">
        {SEGMENTS.map((s) => (
          <button
            key={s.id}
            role="tab"
            aria-selected={segment === s.id}
            className={`clock__seg${segment === s.id ? ' clock__seg--active' : ''}`}
            onClick={() => setSegment(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>
      {segment === 'stopwatch'
        ? <Stopwatch />
        : <Timer />}
    </div>
  );
}

/* ---------- Stopwatch ---------- */
function Stopwatch() {
  // Use a ref for the high-precision baseline; render state mirrors display.
  const startPerfRef = useRef(0);          // performance.now() of current run start
  const elapsedAtPauseRef = useRef(0);    // accumulated ms when paused
  const rafRef = useRef(0);
  const [, setTick] = useState(0);
  const [running, setRunning] = useState(false);
  const [laps, setLaps] = useState([]);   // [{idx, total, delta}]
  const lastLapMsRef = useRef(0);

  const elapsedMs = useRef(0);

  const draw = useCallback(() => {
    if (running) {
      elapsedMs.current = elapsedAtPauseRef.current + (performance.now() - startPerfRef.current);
    }
    setTick((t) => t + 1);
    rafRef.current = requestAnimationFrame(draw);
  }, [running]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw]);

  const start = () => {
    startPerfRef.current = performance.now();
    setRunning(true);
  };
  const pause = () => {
    elapsedAtPauseRef.current = elapsedMs.current;
    setRunning(false);
  };
  const reset = () => {
    setRunning(false);
    elapsedAtPauseRef.current = 0;
    elapsedMs.current = 0;
    lastLapMsRef.current = 0;
    setLaps([]);
  };
  const lap = () => {
    const total = elapsedMs.current;
    const delta = total - lastLapMsRef.current;
    lastLapMsRef.current = total;
    setLaps((l) => [{ idx: l.length + 1, total, delta }, ...l]);
  };

  return (
    <div className="clock__pane">
      <div className="clock__display" aria-live="polite">
        {formatStopwatch(elapsedMs.current)}
      </div>

      <div className="clock__controls">
        <button className="btn btn--primary" onClick={running ? pause : start}>
          {running ? 'Pause' : elapsedAtPauseRef.current > 0 ? 'Resume' : 'Start'}
        </button>
        <button className="btn btn--ghost" onClick={lap} disabled={!running}>
          Lap
        </button>
        <button className="btn btn--ghost" onClick={reset} disabled={!elapsedMs.current && !laps.length}>
          Reset
        </button>
      </div>

      {laps.length > 0 && (
        <ul className="clock__laps">
          {laps.map((l) => (
            <li key={l.idx}>
              <span className="clock__lap-idx">#{l.idx}</span>
              <span className="clock__lap-delta">+{formatStopwatch(l.delta)}</span>
              <span className="clock__lap-total">{formatStopwatch(l.total)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------- Timer ---------- */
function formatMmSs(totalSec) {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${pad(m)}:${pad(s)}`;
}

function Timer() {
  const [presetSec, setPresetSec] = useState(25 * 60);
  const [customH, setCustomH] = useState(0);
  const [customM, setCustomM] = useState(25);
  const [customS, setCustomS] = useState(0);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);

  // totalSec: total duration set; remainingRef: ms remaining (high precision)
  const totalSecRef = useRef(25 * 60);
  const deadlineRef = useRef(0); // performance.now() target
  const remainingRef = useRef(25 * 60 * 1000);
  const rafRef = useRef(0);
  const [, setTick] = useState(0);

  const useCustom = () => {
    const total = (customH * 3600) + (customM * 60) + customS;
    if (total <= 0) return;
    totalSecRef.current = total;
    setPresetSec(total); // mirror it back so preset UI reflects custom choice
    remainingRef.current = total * 1000;
    setDone(false);
  };

  const applyPreset = (sec) => {
    setRunning(false);
    totalSecRef.current = sec;
    setPresetSec(sec);
    remainingRef.current = sec * 1000;
    setDone(false);
  };

  const draw = useCallback(() => {
    if (running) {
      const rem = deadlineRef.current - performance.now();
      if (rem <= 0) {
        remainingRef.current = 0;
        setRunning(false);
        setDone(true);
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      } else {
        remainingRef.current = rem;
      }
    }
    setTick((t) => t + 1);
    rafRef.current = requestAnimationFrame(draw);
  }, [running]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw]);

  const start = () => {
    deadlineRef.current = performance.now() + remainingRef.current;
    setDone(false);
    setRunning(true);
  };
  const pause = () => {
    setRunning(false);
  };
  const reset = () => {
    setRunning(false);
    remainingRef.current = totalSecRef.current * 1000;
    setDone(false);
  };

  const remainingSec = Math.max(0, Math.ceil(remainingRef.current / 1000));

  return (
    <div className="clock__pane">
      <div className={`clock__display clock__display--timer${done ? ' clock__display--done' : ''}`} aria-live="polite">
        {formatMmSs(remainingSec)}
      </div>

      <div className="clock__presets">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            className={`chip${presetSec === p.sec && !running ? ' chip--active' : ''}`}
            onClick={() => applyPreset(p.sec)}
            disabled={running}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="clock__custom">
        <label className="clock__custom-field">
          <span>h</span>
          <input type="number" min="0" max="23" value={customH}
            onChange={(e) => setCustomH(Math.max(0, Math.min(23, +e.target.value || 0)))}
            disabled={running}
          />
        </label>
        <label className="clock__custom-field">
          <span>m</span>
          <input type="number" min="0" max="59" value={customM}
            onChange={(e) => setCustomM(Math.max(0, Math.min(59, +e.target.value || 0)))}
            disabled={running}
          />
        </label>
        <label className="clock__custom-field">
          <span>s</span>
          <input type="number" min="0" max="59" value={customS}
            onChange={(e) => setCustomS(Math.max(0, Math.min(59, +e.target.value || 0)))}
            disabled={running}
          />
        </label>
        <button className="btn btn--ghost" onClick={useCustom} disabled={running}>Set</button>
      </div>

      <div className="clock__controls">
        <button className="btn btn--primary" onClick={running ? pause : start}>
          {running ? 'Pause' : remainingRef.current < totalSecRef.current * 1000 && !done ? 'Resume' : 'Start'}
        </button>
        <button className="btn btn--ghost" onClick={reset} disabled={!remainingRef.current && !running && !done}>
          Reset
        </button>
      </div>

      {done && (
        <div className="clock__done-overlay" role="alert">
          <div className="clock__done-card">
            <div className="clock__done-icon">⏰</div>
            <div className="clock__done-title">Timer complete</div>
            <div className="clock__done-sub">{formatMmSs(totalSecRef.current)} elapsed</div>
            <button className="btn btn--primary" onClick={() => { reset(); }}>Dismiss</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- helpers ---------- */
function pad(n) { return String(n).padStart(2, '0'); }

function formatStopwatch(ms) {
  const totalCs = Math.floor(ms / 10);
  const cs = totalCs % 100;
  const totalSec = Math.floor(totalCs / 100);
  const s = totalSec % 60;
  const m = Math.floor(totalSec / 60) % 60;
  const h = Math.floor(totalSec / 3600);
  return h > 0
    ? `${h}:${pad(m)}:${pad(s)}.${pad(cs)}`
    : `${pad(m)}:${pad(s)}.${pad(cs)}`;
}
