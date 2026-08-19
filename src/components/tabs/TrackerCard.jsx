import { useState, useEffect } from 'react';
import DataStore from '../../store/DataStore.js';
import { todayKey, addDays } from '../../lib/date.js';
import { computeStreak } from '../../lib/streaks.js';
import Heatmap from '../common/Heatmap.jsx';

const HEATMAP_RANGE = 84;

/**
 * Tracker card (PRD §6.5): logs today's value; shows streak + heatmap.
 * V2.4: today's log, streak (boolean trackers), and heatmap logs are all
 * async-loaded in a single effect on mount or change of onChange (the
 * parent's bump signal). Writes are fire-and-forget to Supabase and the
 * parent re-bumps `onChange` so this card re-fetches.
 */
export default function TrackerCard({ tracker, onChange, onEdit, onDelete }) {
  const [bump, setBump] = useState(false);
  const [numDraft, setNumDraft] = useState(null);
  // ⚠️ Do NOT hoist todayKey() here — it would be stale after midnight.
  // Call it fresh inside effects and handlers instead.

  const [todaysLog, setTodaysLog] = useState(null);
  const [streak, setStreak] = useState(null);
  const [logs, setLogs] = useState({});

  useEffect(() => {
    let active = true;
    (async () => {
      // Compute todayKey() fresh inside the effect so it's always the
      // current calendar day, even if the component mounted yesterday.
      const endKey = todayKey();
      const startKey = addDays(endKey, -(HEATMAP_RANGE - 1));
      const [log, logMap] = await Promise.all([
        DataStore.tracker.getLog(tracker.id, endKey),
        DataStore.tracker.getLogsForRange(tracker.id, startKey, endKey),
      ]);
      if (!active) return;
      setTodaysLog(log);
      setLogs(Object.fromEntries(logMap));
      if (tracker.type === 'boolean') {
        try {
          const s = await computeStreak(tracker.id);
          if (active) setStreak(s);
        } catch (e) {
          console.warn('[PARTH] streak failed:', e?.message);
        }
      }
    })();
    return () => { active = false; };
  }, [tracker.id, tracker.type, onChange]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggle() {
    const currentDay = todayKey(); // always use the real current date
    const nextVal = !todaysLog?.value;
    const work = nextVal
      ? DataStore.tracker.log(tracker.id, currentDay, true)
      : DataStore.tracker.removeLog(tracker.id, currentDay);
    setBump(true);
    setTimeout(() => setBump(false), 160);
    work
      .then(() => onChange())
      .catch((err) => console.warn('[PARTH] tracker toggle failed:', err?.message));
  }

  function submitNumber(e) {
    e.preventDefault();
    const raw = numDraft === null ? '' : String(numDraft);
    const n = Number(raw);
    if (raw.trim() === '' || Number.isNaN(n)) return;
    setNumDraft(null);
    const currentDay = todayKey(); // always use the real current date
    DataStore.tracker.log(tracker.id, currentDay, n)
      .then(() => onChange())
      .catch((err) => console.warn('[PARTH] tracker log failed:', err?.message));
  }

  const isLogged = todaysLog != null;

  return (
    <article className={`trkcard${isLogged ? ' trkcard--logged' : ''}`}>
      <header className="trkcard__head">
        <h3 className="trkcard__name">{tracker.name}</h3>
        <div className="trkcard__actions">
          <button className="icon-btn" onClick={onEdit} title="Edit tracker" aria-label="Edit">✎</button>
          <button className="icon-btn icon-btn--danger" onClick={onDelete} title="Delete tracker" aria-label="Delete">×</button>
        </div>
      </header>

      {tracker.type === 'boolean' ? (
        <div className="trkcard__log">
          <button
            className={`toggle${todaysLog?.value ? ' toggle--on' : ''}${bump ? ' toggle--bump' : ''}`}
            onClick={toggle}
            aria-pressed={!!todaysLog?.value}
          >
            <span className="toggle__dot" />
          </button>
          {streak && (
            <span className={`streak${streak.current > 0 ? ' streak--active' : ''}`} title={streak.frozen ? 'Frozen — log today to extend' : 'Active streak'}>
              {streak.current > 0 ? `🔥 ${streak.current}-day streak` : 'no active streak'}
              {streak.frozen && streak.current > 0 && <span className="streak__freeze" aria-hidden="true"> · frozen</span>}
            </span>
          )}
        </div>
      ) : (
        <form className="trkcard__log" onSubmit={submitNumber}>
          <input
            type="number"
            className="numinput"
            placeholder={todaysLog != null ? String(todaysLog.value) : '0'}
            value={numDraft === null ? (todaysLog != null ? String(todaysLog.value) : '') : numDraft}
            onChange={(e) => setNumDraft(e.target.value)}
            step="any"
          />
          {tracker.unit && <span className="trkcard__unit">{tracker.unit}</span>}
          <button type="submit" className="btn btn--ghost">Save</button>
        </form>
      )}

      <Heatmap trackerId={tracker.id} tracker={tracker} logs={logs} n={HEATMAP_RANGE} />
    </article>
  );
}
