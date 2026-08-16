import { useState, useEffect } from 'react';
import { dayDiff, todayKey, longDate, addDays } from '../../lib/date.js';
import DataStore from '../../store/DataStore.js';

/**
 * Restore-session modal (PRD §6.7.3).
 * Shown when the gap between meta.lastVisit and today is > 2 days.
 *
 * V2.4: DataStore is now async — the restore-key probe runs in an effect
 * and renders a brief "Looking…" state while it walks back up to 60 days
 * looking for activity.
 */
export default function RestoreSession({ lastVisit, onRestore, onStartFresh }) {
  const [restoreKey, setRestoreKey] = useState(null);
  const [looking, setLooking] = useState(true);

  useEffect(() => {
    if (!lastVisit) { setLooking(false); return; }
    let active = true;
    (async () => {
      let found = null;
      for (let i = 0; i <= 60 && !found; i++) {
        const probe = i === 0 ? lastVisit : addDays(lastVisit, -i);
        if (!probe) break;
        if (await hasActivityOn(probe)) found = probe;
      }
      if (active) { setRestoreKey(found); setLooking(false); }
    })();
    return () => { active = false; };
  }, [lastVisit]);

  if (!lastVisit) return null;

  const gap = Math.max(0, dayDiff(lastVisit, todayKey()));

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal restore">
        <header className="restore__head">
          <span className="restore__icon" aria-hidden="true">⟳</span>
          <h2 className="modal__title">Restore session?</h2>
        </header>
        <p className="restore__body">
          You were last here <strong>{gap} days ago</strong> — {longDate(lastVisit)}.
          {restoreKey
            ? <> We can bring you back to that day in History, or start fresh today.</>
            : looking
              ? <> Looking for your last entries…</>
              : <> Want to start fresh?</>}
        </p>
        <footer className="modal__foot">
          <button className="btn btn--ghost" onClick={onStartFresh}>Start fresh</button>
          <button
            className="btn btn--primary"
            onClick={() => onRestore(restoreKey)}
            disabled={!restoreKey}
          >Restore</button>
        </footer>
      </div>
    </div>
  );
}

async function hasActivityOn(key) {
  const j = await DataStore.journal.get(key);
  if (j && (j.content || j.mood || (j.tags && j.tags.length))) return true;
  const p = await DataStore.planner.get(key);
  if (p && p.tasks && p.tasks.length) return true;
  const trackers = await DataStore.tracker.list();
  for (const t of trackers) {
    const log = await DataStore.tracker.getLog(t.id, key);
    if (log != null) return true;
  }
  return false;
}
