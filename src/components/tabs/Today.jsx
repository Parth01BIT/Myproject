import { useState, useEffect } from 'react';
import DataStore from '../../store/DataStore.js';
import { todayKey } from '../../lib/date.js';
import { computeStreak } from '../../lib/streaks.js';
import { useFocusStatus, useFocusTimer } from '../../hooks/useFocusTimer.js';

/**
 * Today tab — interactive composite (PRD §6.2).
 * Layout: Streak banner (+ Focus chip V2.3) → Tasks → Trackers → Journal preview.
 *
 * V2.4: all DataStore reads/writes are async. We batch the reads in a single
 * `useEffect` and re-run on `version` bump. Writes confirm via round-trip
 * (the bump after the await reflects authoritative state).
 */
export default function Today({ route, setRoute, bumpStale }) {
  const dayK = route.dateKey || todayKey();
  const [version, setVersion] = useState(0);
  const bump = () => { setVersion((v) => v + 1); bumpStale?.(); };

  // Controlled drafts for number-tracker inputs keyed by tracker id.
  // Reset to the saved log value every time async data reloads so the
  // input always reflects Supabase state, not a stale uncontrolled snapshot.
  const [numDrafts, setNumDrafts] = useState({});

  const focus = useFocusTimer();
  const focusStatus = useFocusStatus();

  // Async-loaded data: { day, trackers, trackerLogs (Map), journal,
  // streaks (array), focusStats } or null while loading.
  const [data, setData] = useState(null);
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [day, trackers, journal, focusStats] = await Promise.all([
          DataStore.planner.get(dayK),
          DataStore.tracker.list(),
          DataStore.journal.get(dayK),
          DataStore.focus.getTotalForDate(dayK),
        ]);
        // tracker logs in parallel
        const logEntries = await Promise.all(
          trackers.map((t) => DataStore.tracker.getLog(t.id, dayK).then((log) => ({ tracker: t, log })))
        );
        // streaks in parallel (range fetch per boolean tracker)
        const streakEntries = await Promise.all(
          trackers
            .filter((t) => t.type === 'boolean')
            .map((t) => computeStreak(t.id).then((streak) => ({ tracker: t, streak })))
        );
        if (!active) return;
        setData({
          day,
          trackers,
          trackerLogs: logEntries,
          journal: journal || { content: '', mood: null, tags: [] },
          streaks: streakEntries.filter((s) => s.streak.current > 0),
          focusStats,
        });
        // Sync controlled inputs to the freshly-loaded log values so
        // inputs never show a stale value after an async reload.
        const freshDrafts = {};
        for (const { tracker, log } of logEntries) {
          if (tracker.type === 'number') {
            freshDrafts[tracker.id] = log != null ? String(log.value) : '';
          }
        }
        setNumDrafts(freshDrafts);
      } catch (e) {
        console.warn('[PARTH] Today load failed:', e?.message);
        if (active) setData({
          day: { tasks: [] },
          trackers: [],
          trackerLogs: [],
          journal: { content: '', mood: null, tags: [] },
          streaks: [],
          focusStats: { seconds: 0, count: 0 },
        });
      }
    })();
    return () => { active = false; };
  }, [dayK, version, focusStatus.version]); // eslint-disable-line react-hooks/exhaustive-deps

  const day = data?.day || { tasks: [] };
  const tasks = [...(day.tasks || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const trackers = data?.trackers || [];
  const trackerLogs = data?.trackerLogs || [];
  const journal = data?.journal;
  const streaks = data?.streaks || [];
  const focusStats = data?.focusStats || { seconds: 0, count: 0 };
  const showFocusChip = focusStatus.running || focusStats.seconds > 0 || focusStats.count > 0;

  const journalSnip = (() => {
    if (!journal || !journal.content) return '';
    const div = document.createElement('div');
    div.innerHTML = journal.content;
    const text = (div.textContent || div.innerText || '').trim();
    if (text.length <= 100) return text;
    return text.slice(0, 100).trim() + '…';
  })();

  const hasAnything = trackers.length || journalSnip || journal?.mood ||
    (journal?.tags && journal.tags.length);

  const toggleTask = (id, done) => {
    DataStore.planner.updateTask(dayK, id, { done })
      .then(() => bump())
      .catch((err) => console.warn('[PARTH] toggleTask failed:', err?.message));
  };

  const toggleTracker = (id, current) => {
    (current ? DataStore.tracker.removeLog(id, dayK) : DataStore.tracker.log(id, dayK, true))
      .then(() => bump())
      .catch((err) => console.warn('[PARTH] toggleTracker failed:', err?.message));
  };

  const submitNumeric = (id, raw) => {
    const n = Number(raw);
    if (raw === '' || Number.isNaN(n)) return;
    DataStore.tracker.log(id, dayK, n)
      .then(() => bump())
      .catch((err) => console.warn('[PARTH] submitNumeric failed:', err?.message));
  };

  const setDraft = (id, val) => setNumDrafts((prev) => ({ ...prev, [id]: val }));

  const doneCount = tasks.filter((t) => t.done).length;

  return (
    <div className="today">
      <header className="today__head">
        <h2 className="today__title">Today</h2>
        <span className="today__date">{dayShortLongDate(dayK)}</span>
        {!hasAnything && data && (
          <div className="today__empty-top">Empty tab. Start planning?</div>
        )}
      </header>

      {(streaks.length > 0 || showFocusChip) && (
        <section className="today__streaks">
          {streaks.map(({ tracker, streak }) => (
            <span key={tracker.id} className="today__streak-chip" title={streak.frozen ? 'Frozen — log today to extend' : 'Active streak'}>
              🔥 {tracker.name} <strong>{streak.current}</strong>{streak.frozen ? ' · frozen' : ''}
            </span>
          ))}
          {focusStatus.running && (
            <span className="today__focus-chip today__focus-chip--live" title={`Focus session in progress on “${focus.taskTitle || 'free focus'}”`}>
              {focus.mode === 'break' ? '◐ break' : '● focusing'} · {formatClock(focus.remainingSec)} {focus.taskTitle ? `· ${truncate(focus.taskTitle, 18)}` : ''}
            </span>
          )}
          {!focusStatus.running && (focusStats.seconds > 0 || focusStats.count > 0) && (
            <span className="today__focus-chip" title={`${focusStats.count} focus session${focusStats.count === 1 ? '' : 's'} today`}>
              ⏱ Today's focus <strong>{formatDuration(focusStats.seconds)}</strong> · {focusStats.count} {focusStats.count === 1 ? 'session' : 'sessions'}
            </span>
          )}
        </section>
      )}

      <section className="today__section">
        <div className="today__section-head">
          <h3 className="today__section-title">Tasks</h3>
          {tasks.length > 0 && (
            <span className="today__section-meta">{doneCount} of {tasks.length}</span>
          )}
          <button className="today__open" onClick={() => setRoute({ tab: 'planner', dateKey: dayK })}>
            Open in Planner →
          </button>
        </div>
        {tasks.length === 0 ? null : (
          <ul className="today__tasks">
            {tasks.map((t) => (
              <li key={t.id} className={`today__task${t.done ? ' today__task--done' : ''}`}>
                <button
                  className="today__check"
                  onClick={() => toggleTask(t.id, !t.done)}
                  aria-pressed={t.done}
                  aria-label={t.done ? 'Mark not done' : 'Mark done'}
                >
                  {t.done && <span className="today__check-icon">✓</span>}
                </button>
                <span className="today__task-title">{t.title}</span>
                {t.time && <span className="today__task-time">{t.time}</span>}
                {t.priority === 'high'   && <span className="priority-dot" style={{ background: 'var(--danger)' }} />}
                {t.priority === 'medium' && <span className="priority-dot" style={{ background: 'var(--dot-planner)' }} />}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="today__section">
        <div className="today__section-head">
          <h3 className="today__section-title">Trackers</h3>
          <button className="today__open" onClick={() => setRoute({ tab: 'tracker' })}>Open in Tracker →</button>
        </div>
        {trackers.length === 0 ? null : (
          <ul className="today__trackers">
            {trackerLogs.map(({ tracker, log }) => (
              <li key={tracker.id} className="today__tracker">
                <span className="today__tracker-name">{tracker.name}</span>
                {tracker.type === 'boolean' ? (
                  <button
                    className={`toggle toggle--sm${log?.value ? ' toggle--on' : ''}`}
                    onClick={() => toggleTracker(tracker.id, log?.value)}
                    aria-pressed={!!log?.value}
                    aria-label={`Toggle ${tracker.name}`}
                  >
                    <span className="toggle__dot" />
                  </button>
                ) : (
                  <input
                    type="number"
                    className="numinput numinput--sm"
                    placeholder="0"
                    value={numDrafts[tracker.id] ?? (log != null ? String(log.value) : '')}
                    onChange={(e) => setDraft(tracker.id, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        submitNumeric(tracker.id, numDrafts[tracker.id] ?? '');
                        e.target.blur();
                      }
                    }}
                    onBlur={() => {
                      const raw = numDrafts[tracker.id] ?? '';
                      const saved = log != null ? String(log.value) : '';
                      if (raw === '' || raw === saved) return;
                      submitNumeric(tracker.id, raw);
                    }}
                    step="any"
                  />
                )}
                {tracker.type === 'number' && tracker.unit && <span className="today__tracker-unit">{tracker.unit}</span>}
                <span className={`today__tracker-status${log != null ? ' today__tracker-status--logged' : ''}`}>
                  {log != null ? 'logged' : 'not yet'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="today__section">
        <div className="today__section-head">
          <h3 className="today__section-title">Journal</h3>
          {journal?.mood && <span className="mood-emoji">{journalEmoji(journal.mood)}</span>}
          <button className="today__open" onClick={() => setRoute({ tab: 'journal', dateKey: dayK })}>Open in Journal →</button>
        </div>
        {journalSnip ? (
          <div className="today__journal-snip">
            {journalSnip}
          </div>
        ) : journal?.tags && journal.tags.length ? (
          <div className="today__journal-tags">
            {journal.tags.map((t) => <span key={t} className="tag">#{t}</span>)}
          </div>
        ) : (
          <div className="today__journal-empty">No entry yet.</div>
        )}
      </section>
    </div>
  );
}

const JOURNAL_MOODS = { happy: '😊', neutral: '😐', sad: '😔', energized:'🔥', tired: '😴' };
function journalEmoji(id) { return JOURNAL_MOODS[id] || '·'; }

function dayShortLongDate(k) {
  const [y,m,d] = k.split('-').map(Number);
  const dt = new Date(y, m-1, d);
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const wd = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  return `${wd[dt.getDay()]}, ${months[dt.getMonth()]} ${dt.getDate()}`;
}

function formatClock(totalSec) {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatDuration(totalSec) {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${totalSec}s`;
}

function truncate(s, n) { return s.length > n ? s.slice(0, n - 1) + '…' : s; }
