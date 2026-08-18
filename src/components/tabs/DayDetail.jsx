import { useState, useEffect } from 'react';
import DataStore from '../../store/DataStore.js';
import { longDate } from '../../lib/date.js';

/**
 * Composite read-only day detail (PRD HI-006 / HI-007).
 * Renders Journal + Planner + Tracker + Focus timeline (V2.3) for a single date.
 * V2.4: parallel async load; skeleton while fetching.
 */
export default function DayDetail({ dateKey, onBack, onEditIn }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    let active = true;
    setData(null);
    (async () => {
      try {
        const [j, p, trackers] = await Promise.all([
          DataStore.journal.get(dateKey),
          DataStore.planner.get(dateKey),
          DataStore.tracker.list(),
        ]);
        const trackerLogs = await Promise.all(
          trackers.map((t) => DataStore.tracker.getLog(t.id, dateKey).then((log) => ({ tracker: t, log })))
        );
        const focusDay = await DataStore.focus.get(dateKey);
        const focusSessions = (focusDay.sessions || [])
          .filter((s) => s.mode === 'focus')
          .slice()
          .sort((a, b) => (a.startedAt || '').localeCompare(b.startedAt || ''));
        if (!active) return;
        setData({
          j,
          p,
          trackerLogs: trackerLogs.filter((row) => row.log != null),
          focusSessions,
        });
      } catch (e) {
        console.warn('[PARTH] DayDetail load failed:', e?.message);
        if (active) setData({ j: null, p: { tasks: [] }, trackerLogs: [], focusSessions: [] });
      }
    })();
    return () => { active = false; };
  }, [dateKey]);

  const j = data?.j;
  const p = data?.p;
  const trackerLogs = data?.trackerLogs || [];
  const focusSessions = data?.focusSessions || [];

  const hasJournal  = j && (j.content || j.mood || (j.tags && j.tags.length));
  const hasPlanner  = p && p.tasks && p.tasks.length;
  const hasTracker  = trackerLogs.length > 0;
  const hasFocus    = focusSessions.length > 0;
  const anyData = hasJournal || hasPlanner || hasTracker || hasFocus;

  const plain = (html) => {
    if (!html) return '';
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
  };

  if (!data) {
    return (
      <div className="daydetail">
        <header className="daydetail__head">
          <button className="daydetail__back" onClick={onBack} aria-label="Back to calendar">‹ Back to calendar</button>
          <h2 className="daydetail__title">{longDate(dateKey)}</h2>
        </header>
        <div className="daydetail__empty" aria-live="polite">Loading…</div>
      </div>
    );
  }

  return (
    <div className="daydetail">
      <header className="daydetail__head">
        <button className="daydetail__back" onClick={onBack} aria-label="Back to calendar">‹ Back to calendar</button>
        <h2 className="daydetail__title">{longDate(dateKey)}</h2>
      </header>

      {!anyData && (
        <div className="daydetail__empty">Nothing recorded on this day.</div>
      )}

      {hasJournal && (
        <section className="daydetail__section">
          <div className="daydetail__heading">
            <h3>Journal</h3>
            <button className="daydetail__edit" onClick={() => onEditIn('journal', dateKey)}>Edit in Journal →</button>
          </div>
          <div className="daydetail__journalmeta">
            {j.mood && <span className="daydetail__mood">Mood: {j.mood}</span>}
            {j.tags && j.tags.length > 0 && (
              <span className="daydetail__tags">
                {j.tags.map((t) => (
                  <span key={t} className="tag">#{t}</span>
                ))}
              </span>
            )}
          </div>
          <div
            className="daydetail__journalcontent"
            dangerouslySetInnerHTML={{ __html: j.content || '' }}
          />
          {!j.content && (
            <div className="daydetail__muted">No text, only metadata.</div>
          )}
        </section>
      )}

      {hasPlanner && (
        <section className="daydetail__section">
          <div className="daydetail__heading">
            <h3>Planner</h3>
            <button className="daydetail__edit" onClick={() => onEditIn('planner', dateKey)}>Edit in Planner →</button>
          </div>
          <ul className="daydetail__tasks">
            {[...p.tasks]
              .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
              .map((t) => (
                <li key={t.id} className={`daydetail__task${t.done ? ' daydetail__task--done' : ''}`}>
                  <span className="daydetail__check">{t.done ? '☑' : '☐'}</span>
                  <span className="daydetail__tasktitle">{t.title}</span>
                  {t.time && <span className="daydetail__tasktime">{t.time}</span>}
                  {t.priority === 'high'   && <span className="badge badge--red">high</span>}
                  {t.priority === 'medium' && <span className="badge badge--amber">med</span>}
                </li>
              ))}
          </ul>
        </section>
      )}

      {hasTracker && (
        <section className="daydetail__section">
          <div className="daydetail__heading">
            <h3>Trackers</h3>
            <button className="daydetail__edit" onClick={() => onEditIn('tracker', null)}>Open Tracker →</button>
          </div>
          <ul className="daydetail__trackerlogs">
            {trackerLogs.map(({ tracker, log }) => (
              <li key={tracker.id}>
                <span className="daydetail__trackername">{tracker.name}</span>
                <span className="daydetail__trackerval">
                  {tracker.type === 'boolean'
                    ? (log.value ? '✓ logged' : '— missed')
                    : `${log.value}${tracker.unit ? ' ' + tracker.unit : ''}`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {hasFocus && (
        <section className="daydetail__section">
          <div className="daydetail__heading">
            <h3>Focus sessions</h3>
            <button className="daydetail__edit" onClick={() => onEditIn('planner', dateKey)}>Open in Planner →</button>
          </div>
          <ul className="daydetail__focus-timeline">
            {focusSessions.map((s) => {
              const start = s.startedAt ? clockTime(s.startedAt) : '--:--';
              const end   = s.endedAt   ? clockTime(s.endedAt)   : '--:--';
              const dur   = formatDuration(s.elapsedSec || 0);
              const mark  = s.completed
                ? { cls: 'complete', label: 'done' }
                : s.stopReason === 'switched'
                  ? { cls: 'switched', label: 'switched' }
                  : { cls: 'manual', label: 'manual' };
              return (
                <li key={s.id} className="daydetail__session">
                  <span className="daydetail__session-time">
                    {start} – {end}
                  </span>
                  <span className="daydetail__session-task">
                    {s.taskTitle ? `“${s.taskTitle}”` : 'free focus'}
                  </span>
                  <span className="daydetail__session-meta">
                    <span>{dur}</span>
                    <span className={`daydetail__session-mark daydetail__session-mark--${mark.cls}`}>
                      {mark.label}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

/* ---------- helpers ---------- */
function clockTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--:--';
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function formatDuration(totalSec) {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m === 0) return `${s}s`;
  if (m < 60) return `${m}m ${String(s).padStart(2,'0')}s`;
  const h = Math.floor(m / 60);
  const remM = m % 60;
  return `${h}h ${remM}m`;
}
