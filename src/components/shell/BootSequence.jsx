import { useState, useEffect } from 'react';
import DataStore from '../../store/DataStore.js';
import { lastNDaysKeys, dayShortLabel, todayKey, addDays } from '../../lib/date.js';
import { computeStreak } from '../../lib/streaks.js';

/**
 * Boot sequence (PRD §6.7.1).
 * ~2 seconds total. Each line fades in sequentially (~350ms delay, BT).
 * Includes dynamic data on lines 2 and 3 (BT-004): active streak count and
 * last journal entry date.
 *
 * V2.4: data fetches are now async and run in parallel with the animation.
 * Lines render immediately with placeholder text, and patch in real numbers
 * as the await resolves. This avoids a delay-before-boot that would make
 * sessions feel slow when Supabase is the laggy kind.
 */
const STEP_MS = 350;
const FINAL_HOLD_MS = 350;

export default function BootSequence({ onComplete }) {
  const [meta, setMeta] = useState({ activeStreaks: null, lastEntryLabel: null });

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const trackers = await DataStore.tracker.list();
        // Run streak computes in parallel — these are range fetches now.
        const booleanTrackers = trackers.filter((t) => t.type === 'boolean');
        const streaks = await Promise.all(booleanTrackers.map((t) => computeStreak(t.id)));
        const activeStreaks = streaks.filter((s) => s.current > 0).length;

        // Last journal entry: walk back up to 365 days.
        // Range fetch all journal rows for the past year in one query.
        const today = todayKey();
        const earliest = addDays(today, -364);
        const rows = await DataStore.journal.getForRange(earliest, today);
        let lastEntryLabel = null;
        for (const k of lastNDaysKeys(365)) {
          const j = rows.get(k);
          if (j && (j.content || j.mood || (j.tags && j.tags.length))) {
            lastEntryLabel = dayShortLabel(k);
            break;
          }
        }
        if (active) setMeta({ activeStreaks, lastEntryLabel });
      } catch (e) {
        console.warn('[PARTH] boot data fetch failed:', e?.message);
      }
    })();
    return () => { active = false; };
  }, []);

  const lines = [
    'Loading yesterday...',
    meta.activeStreaks == null
      ? 'Checking streaks...'
      : `Checking streaks...  ${meta.activeStreaks} active`,
    meta.lastEntryLabel == null
      ? (meta.activeStreaks == null ? 'Scanning journal...' : 'Scanning journal...  no entries yet')
      : `Scanning journal...  last entry: ${meta.lastEntryLabel}`,
    'Ready.',
  ];

  const [visible, setVisible] = useState(0);

  useEffect(() => {
    const timers = [];
    for (let i = 0; i < lines.length; i++) {
      timers.push(setTimeout(() => setVisible((v) => Math.max(v, i + 1)), STEP_MS * (i + 1)));
    }
    timers.push(setTimeout(() => onComplete?.(), STEP_MS * (lines.length + 1) + FINAL_HOLD_MS));
    return () => timers.forEach(clearTimeout);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="boot" role="status" aria-live="polite">
      <div className="boot__brand">PARTH</div>
      <pre className="boot__lines">
        {lines.map((line, i) => (
          <span
            key={i}
            className={`boot__line${i < visible ? ' boot__line--in' : ''}`}
          >
            {line}
            {'\n'}
          </span>
        ))}
      </pre>
    </div>
  );
}
