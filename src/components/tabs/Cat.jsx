import { useState, useEffect, useCallback, useRef } from 'react';
import DataStore from '../../store/DataStore.js';
import { todayKey } from '../../lib/date.js';
import { useAsyncResult } from '../../hooks/useAsyncResult.js';

/* ── Constants ─────────────────────────────────────────────── */

const CAT_DATE = new Date('2026-11-29T00:00:00+05:30'); // Nov 29 2026, IST
const SECTIONS = [
  { id: 'qa',   label: 'QA',   fullLabel: 'Quantitative Aptitude' },
  { id: 'dilr', label: 'DILR', fullLabel: 'Data Interpretation & LR' },
  { id: 'varc', label: 'VARC', fullLabel: 'Verbal Ability & RC' },
];

/* ── Helpers ────────────────────────────────────────────────── */

function getCountdown() {
  const now = new Date();
  const diff = CAT_DATE - now;
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, over: true };
  const days    = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours   = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return { days, hours, minutes, over: false };
}

/* Circumference for r=34 ring */
const CIRC = 2 * Math.PI * 34;

/* ── Sub-components ─────────────────────────────────────────── */

/** Live countdown hero card. */
function CatCountdown() {
  const [cd, setCd] = useState(getCountdown);

  useEffect(() => {
    const id = setInterval(() => setCd(getCountdown()), 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="cat__countdown" aria-label={`${cd.days} days until CAT 2026`}>
      <span className="cat__countdown-label">Days until CAT 2026</span>
      {cd.over ? (
        <span className="cat__countdown-number" style={{ fontSize: '2.5rem' }}>
          🎓 Exam Day!
        </span>
      ) : (
        <>
          <span className="cat__countdown-number">{cd.days}</span>
          <span className="cat__countdown-sub">
            {cd.hours}h {cd.minutes}m remaining today
          </span>
        </>
      )}
      <span className="cat__countdown-date">Nov 29, 2026 · CAT 2026</span>
    </div>
  );
}

/** Single section progress card with ring + slider. */
function SectionCard({ section, value, onChange }) {
  const [local, setLocal]   = useState(value);
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef(null);

  // Sync if parent refreshes
  useEffect(() => { setLocal(value); }, [value]);

  const handleChange = (e) => {
    const v = Number(e.target.value);
    setLocal(v);
    setSaving(true);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      onChange(section.id, v).finally(() => setSaving(false));
    }, 800);
  };

  const offset = CIRC - (local / 100) * CIRC;

  return (
    <div className={`cat-card cat-card--${section.id}`} title={section.fullLabel}>
      <span className="cat-card__name">{section.label}</span>

      {/* SVG ring */}
      <div className="cat-card__ring" aria-hidden="true">
        <svg width="80" height="80" viewBox="0 0 80 80">
          <circle className="cat-card__ring-track" cx="40" cy="40" r="34" />
          <circle
            className="cat-card__ring-fill"
            cx="40" cy="40" r="34"
            strokeDasharray={CIRC}
            strokeDashoffset={offset}
          />
        </svg>
        <span className="cat-card__ring-label">{local}%</span>
      </div>

      {/* Slider */}
      <div className="cat-card__slider-row">
        <input
          type="range"
          className="cat-card__slider"
          min={0} max={100} step={1}
          value={local}
          onChange={handleChange}
          aria-label={`${section.fullLabel} progress`}
        />
        <span className="cat-card__slider-val">{local}</span>
      </div>

      <span className="cat-card__saving" aria-live="polite">
        {saving ? 'saving…' : ''}
      </span>
    </div>
  );
}

/** Progress cards for all 3 sections. */
function CatProgress({ date }) {
  const [version, setVersion] = useState(0);

  const { data: progress } = useAsyncResult(
    `cat:progress:${date}:${version}`,
    () => DataStore.cat.getProgress(date),
    [date, version]
  );

  const handleChange = useCallback(async (section, value) => {
    await DataStore.cat.setProgress(date, section, value);
    setVersion((v) => v + 1);
  }, [date]);

  const prog = progress || { qa: 0, dilr: 0, varc: 0 };

  return (
    <div>
      <h3 className="cat__section-title" style={{ marginBottom: 'var(--space-md)' }}>
        Section Progress
      </h3>
      <div className="cat__progress-grid">
        {SECTIONS.map((s) => (
          <SectionCard
            key={s.id}
            section={s}
            value={prog[s.id] ?? 0}
            onChange={handleChange}
          />
        ))}
      </div>
    </div>
  );
}

/** Daily CAT task plan. */
function CatDailyPlan({ date }) {
  const [version, setVersion] = useState(0);
  const [input, setInput]     = useState('');
  const [adding, setAdding]   = useState(false);
  const inputRef = useRef(null);

  const { data: tasks, loading } = useAsyncResult(
    `cat:tasks:${date}:${version}`,
    () => DataStore.cat.getTasks(date),
    [date, version]
  );

  const bump = () => setVersion((v) => v + 1);

  const handleAdd = async () => {
    const title = input.trim();
    if (!title) return;
    setAdding(true);
    setInput('');
    await DataStore.cat.addTask(date, title)
      .catch((e) => console.warn('[PARTH] cat.addTask failed:', e?.message))
      .finally(() => { setAdding(false); bump(); });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleAdd();
  };

  const handleToggle = (id, done) => {
    DataStore.cat.toggleTask(id, !done)
      .then(bump)
      .catch((e) => console.warn('[PARTH] cat.toggleTask failed:', e?.message));
  };

  const handleDelete = (id) => {
    DataStore.cat.deleteTask(id)
      .then(bump)
      .catch((e) => console.warn('[PARTH] cat.deleteTask failed:', e?.message));
  };

  const taskList = tasks || [];
  const done  = taskList.filter((t) => t.done).length;
  const total = taskList.length;

  return (
    <div className="cat__plan">
      <h3 className="cat__section-title">Today's Study Plan</h3>

      {/* Quick stats */}
      {total > 0 && (
        <div className="cat__stats">
          <div className="cat__stat">
            <span className="cat__stat-value">{total}</span>
            <span className="cat__stat-label">Tasks</span>
          </div>
          <div className="cat__stat">
            <span className="cat__stat-value">{done}</span>
            <span className="cat__stat-label">Done</span>
          </div>
          <div className="cat__stat">
            <span className="cat__stat-value">{total - done}</span>
            <span className="cat__stat-label">Left</span>
          </div>
        </div>
      )}

      {/* Add task */}
      <div className="cat__plan-add">
        <input
          ref={inputRef}
          className="cat__plan-input"
          type="text"
          placeholder="Add a study task… e.g. VARC RC set 3"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={adding}
          aria-label="New CAT study task"
        />
        <button
          className="cat__plan-submit"
          onClick={handleAdd}
          disabled={adding || !input.trim()}
          aria-label="Add task"
        >
          + Add
        </button>
      </div>

      {/* Task list */}
      <div className="cat__task-list" role="list">
        {loading && !tasks ? (
          <div className="cat__task-empty">Loading…</div>
        ) : taskList.length === 0 ? (
          <div className="cat__task-empty">No tasks yet — add your first study item above.</div>
        ) : (
          taskList.map((t) => (
            <div
              key={t.id}
              className={`cat-task${t.done ? ' cat-task--done' : ''}`}
              role="listitem"
            >
              <button
                className="cat-task__check"
                onClick={() => handleToggle(t.id, t.done)}
                aria-label={t.done ? 'Mark incomplete' : 'Mark complete'}
                title={t.done ? 'Mark incomplete' : 'Mark complete'}
              >
                <span className="cat-task__check-icon" aria-hidden="true">✓</span>
              </button>
              <span className="cat-task__title">{t.title}</span>
              <button
                className="cat-task__delete"
                onClick={() => handleDelete(t.id)}
                aria-label="Delete task"
                title="Delete"
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ── Main tab ────────────────────────────────────────────────── */

export default function Cat() {
  const date = todayKey();

  return (
    <div className="cat">
      <CatCountdown />
      <CatProgress date={date} />
      <CatDailyPlan date={date} />
    </div>
  );
}
