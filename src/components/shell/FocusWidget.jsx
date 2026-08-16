import { useState, useEffect } from 'react';
import { useFocusTimer, hasFocusMinutesTracker } from '../../contexts/FocusTimer.jsx';
import { useAsyncResult } from '../../hooks/useAsyncResult.js';

/**
 * Floating Focus widget (V2.3).
 * PiP-style: anchored bottom-right, fixed (V2.3 — drag-persist parked to V3).
 * Visible only when a session is in flight (running or paused).
 * Dims to ~40% opacity unless hovered.
 *
 * V2.4: hasFocusMinutesTracker() is now async against Supabase. We hydrate
 * the boolean via useAsyncResult once on mount and re-check whenever a
 * focus session transitions to idle (a session that just ended may have
 * been the first one the user wanted a tracker for).
 */
export default function FocusWidget() {
  const focus = useFocusTimer();
  const [hovered, setHovered] = useState(false);
  const [showTrackerTip, setShowTrackerTip] = useState(false);
  void setShowTrackerTip;

  const [showTipOnce, setShowTipOnce] = useState(false);

  // V2.4: async check — re-run whenever a focus session completes (version bump).
  const { data: hasTracker } = useAsyncResult(
    `focus-minutes-tracker:${focus.version}`,
    () => hasFocusMinutesTracker(),
    [focus.version]
  );
  const trackerMissing = hasTracker === false;

  useEffect(() => {
    if (focus.status === 'idle' && !showTipOnce && trackerMissing) {
      // Tip is rendered as a persistent subtle hint on hover (below).
    }
  }, [focus.status, showTipOnce, trackerMissing]);

  if (focus.status === 'idle') return null;

  const totalSec = focus.remainingSec;
  const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const ss = String(totalSec % 60).padStart(2, '0');
  const timeStr = `${mm}:${ss}`;

  const modeIcon = focus.mode === 'focus' ? '●' : '◯';
  const modeLabel = focus.mode === 'focus' ? 'Focus' : 'Break';

  // Progress ring math (SVG circle)
  const R = 22;
  const CIRC = 2 * Math.PI * R;
  const dash = CIRC * (focus.progress ?? 0);

  return (
    <div
      className={`focuswidget${hovered ? ' focuswidget--hover' : ''}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      role="status"
      aria-live="polite"
      aria-label={`${modeLabel} session ${focus.status}, ${timeStr} remaining`}
    >
      <div className="focuswidget__ring" aria-hidden="true">
        <svg width="56" height="56" viewBox="0 0 56 56">
          <circle cx="28" cy="28" r={R} className="focuswidget__ring-track" />
          <circle
            cx="28" cy="28" r={R}
            className={`focuswidget__ring-fill${focus.mode === 'break' ? ' focuswidget__ring-fill--break' : ''}`}
            strokeDasharray={`${dash} ${CIRC}`}
            transform="rotate(-90 28 28)"
          />
        </svg>
        <div className="focuswidget__mode">{modeIcon}</div>
      </div>

      <div className="focuswidget__body">
        <div className="focuswidget__meta">
          <span className={`focuswidget__mode-pill focuswidget__mode-pill--${focus.mode}`}>
            {modeLabel}
          </span>
          <span className="focuswidget__status">
            {focus.status === 'paused' ? 'paused' : 'running'}
          </span>
        </div>
        <div className="focuswidget__time">{timeStr}</div>
        <div className="focuswidget__task" title={focus.taskTitle || ''}>
          {focus.taskTitle ? `“${truncate(focus.taskTitle, 32)}”` : 'free focus'}
        </div>
      </div>

      <div className="focuswidget__controls">
        <button
          className="fw-btn"
          onClick={() => (focus.status === 'paused' ? focus.resume() : focus.pause())}
          title={focus.status === 'paused' ? 'Resume' : 'Pause'}
          aria-label={focus.status === 'paused' ? 'Resume' : 'Pause'}
        >
          {focus.status === 'paused' ? '▶' : '⏸'}
        </button>
        <button
          className="fw-btn fw-btn--danger"
          onClick={() => focus.stop()}
          title="Stop and discard"
          aria-label="Stop session"
        >
          ■
        </button>
      </div>

      {trackerMissing && hovered && (
        <div className="focuswidget__tip" role="note">
          Tip: create a ‘Focus minutes’ number tracker to auto-log sessions.
        </div>
      )}
    </div>
  );
}

function truncate(s, n) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}
