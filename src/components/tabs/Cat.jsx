import { useState, useEffect, useCallback, useRef } from 'react';
import DataStore from '../../store/DataStore.js';
import { todayKey } from '../../lib/date.js';
import { useAsyncResult } from '../../hooks/useAsyncResult.js';

/* ── Constants ─────────────────────────────────────────────── */

const CAT_DATE = new Date('2026-11-29T00:00:00+05:30');

const SECTIONS = [
  { id: 'qa',   label: 'QA',   fullLabel: 'Quantitative Aptitude' },
  { id: 'dilr', label: 'DILR', fullLabel: 'Data Interpretation & LR' },
  { id: 'varc', label: 'VARC', fullLabel: 'Verbal Ability & RC' },
];

const MOCK_TYPES = [
  { id: 'full', label: 'Full Length' },
  { id: 'qa',   label: 'Sectional — QA' },
  { id: 'dilr', label: 'Sectional — DILR' },
  { id: 'varc', label: 'Sectional — VARC' },
];

const CIRC = 2 * Math.PI * 34;

/* ── Shared helpers ─────────────────────────────────────────── */

function getCountdown() {
  const now  = new Date();
  const diff = CAT_DATE - now;
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, over: true };
  const days    = Math.floor(diff / 86_400_000);
  const hours   = Math.floor((diff % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  return { days, hours, minutes, over: false };
}

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/* ── Progress Ring ──────────────────────────────────────────── */

function ProgressRing({ section, value, size = 72 }) {
  const r      = (size / 2) - 5;
  const circ   = 2 * Math.PI * r;
  const offset = circ - (value / 100) * circ;
  return (
    <div className={`cat-ring cat-ring--${section}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle className="cat-ring__track" cx={size/2} cy={size/2} r={r} />
        <circle
          className="cat-ring__fill"
          cx={size/2} cy={size/2} r={r}
          strokeDasharray={circ}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="cat-ring__label">{value}%</span>
    </div>
  );
}

/* ── Countdown ──────────────────────────────────────────────── */

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
        <span className="cat__countdown-number" style={{ fontSize: '2.5rem' }}>🎓 Exam Day!</span>
      ) : (
        <>
          <span className="cat__countdown-number">{cd.days}</span>
          <span className="cat__countdown-sub">{cd.hours}h {cd.minutes}m remaining today</span>
        </>
      )}
      <span className="cat__countdown-date">Nov 29, 2026 · CAT 2026</span>
    </div>
  );
}

/* ── Summary Cards ──────────────────────────────────────────── */

function CatSummaryCards({ progress, onOpen }) {
  return (
    <div>
      <h3 className="cat__section-title">Section Progress</h3>
      <div className="cat__summary-grid">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            className="cat-summary-card"
            onClick={() => onOpen(s.id)}
            aria-label={`Open ${s.fullLabel}`}
            title={`Open ${s.fullLabel}`}
          >
            <span className="cat-summary-card__name">{s.label}</span>
            <ProgressRing section={s.id} value={progress?.[s.id] ?? 0} size={72} />
            <span className="cat-summary-card__open-hint">tap to open →</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Mock Panel (dashboard) ─────────────────────────────────── */

function MockLogModal({ onClose, onSave }) {
  const [form, setForm] = useState({
    date: todayKey(),
    type: 'full',
    name: '',
    score: '',
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    await onSave({
      date:  form.date,
      type:  form.type,
      name:  form.name.trim() || null,
      score: form.score !== '' ? Number(form.score) : null,
    }).finally(() => setSaving(false));
  };

  return (
    <div className="cat-modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="cat-modal" role="dialog" aria-modal="true" aria-label="Log mock">
        <h3>Log a Mock</h3>

        <div className="cat-modal__row">
          <div className="cat-modal__field">
            <label className="cat-modal__label">Date</label>
            <input
              type="date"
              className="cat-modal__input"
              value={form.date}
              max={todayKey()}
              onChange={(e) => set('date', e.target.value)}
            />
          </div>
          <div className="cat-modal__field">
            <label className="cat-modal__label">Type</label>
            <select className="cat-modal__select" value={form.type} onChange={(e) => set('type', e.target.value)}>
              {MOCK_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>
        </div>

        <div className="cat-modal__row">
          <div className="cat-modal__field">
            <label className="cat-modal__label">Name / Series</label>
            <input
              type="text"
              className="cat-modal__input"
              placeholder="e.g. AIMCAT 3"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
            />
          </div>
          <div className="cat-modal__field">
            <label className="cat-modal__label">Score</label>
            <input
              type="number"
              className="cat-modal__input"
              placeholder="raw score"
              value={form.score}
              min={0}
              onChange={(e) => set('score', e.target.value)}
            />
          </div>
        </div>

        <div className="cat-modal__actions">
          <button className="cat-modal__cancel" onClick={onClose}>Cancel</button>
          <button className="cat-modal__save" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Log Mock'}
          </button>
        </div>
      </div>
    </div>
  );
}

function MockPanel() {
  const [version, setVersion] = useState(0);
  const [showModal, setShowModal] = useState(false);

  const { data: mocks } = useAsyncResult(
    `cat:mocks:${version}`,
    () => DataStore.cat.mocks.list(),
    [version]
  );

  const bump = () => setVersion((v) => v + 1);

  const handleSave = async (data) => {
    await DataStore.cat.mocks.add(data)
      .catch((e) => console.warn('[PARTH] cat.mocks.add failed:', e?.message));
    setShowModal(false);
    bump();
  };

  const handleDelete = (id) => {
    DataStore.cat.mocks.delete(id)
      .then(bump)
      .catch((e) => console.warn('[PARTH] cat.mocks.delete failed:', e?.message));
  };

  const mockList = mocks || [];
  const counts = { full: 0, qa: 0, dilr: 0, varc: 0 };
  for (const m of mockList) counts[m.type] = (counts[m.type] || 0) + 1;

  const recent = mockList.slice(0, 8);

  return (
    <>
      <div className="cat__mock-panel">
        <div className="cat__mock-header">
          <h3>Mock Log</h3>
          <div className="cat__mock-counters">
            {[
              { key: 'full', label: 'Full' },
              { key: 'qa',   label: 'QA' },
              { key: 'dilr', label: 'DILR' },
              { key: 'varc', label: 'VARC' },
            ].map(({ key, label }) => (
              <div key={key} className={`cat__mock-count cat__mock-count--${key}`}>
                <span className="cat__mock-count-num">{counts[key] || 0}</span>
                <span className="cat__mock-count-label">{label}</span>
              </div>
            ))}
          </div>
          <button className="cat__mock-add-btn" onClick={() => setShowModal(true)}>
            + Log Mock
          </button>
        </div>

        <div className="cat__mock-list" role="list">
          {recent.length === 0 ? (
            <div className="cat__mock-empty">No mocks logged yet. Hit "+ Log Mock" after your first attempt.</div>
          ) : (
            recent.map((m) => (
              <div key={m.id} className="cat-mock" role="listitem">
                <span className={`cat-mock__type cat-mock__type--${m.type}`}>
                  {m.type === 'full' ? 'Full' : m.type.toUpperCase()}
                </span>
                <span className="cat-mock__name">{m.name || '—'}</span>
                <span className="cat-mock__date">{fmtDate(m.date)}</span>
                <span className="cat-mock__score">{m.score != null ? m.score : '—'}</span>
                <button
                  className="cat-mock__delete"
                  onClick={() => handleDelete(m.id)}
                  aria-label="Delete mock log"
                  title="Delete"
                >×</button>
              </div>
            ))
          )}
        </div>
      </div>

      {showModal && (
        <MockLogModal onClose={() => setShowModal(false)} onSave={handleSave} />
      )}
    </>
  );
}

/* ── Dashboard ──────────────────────────────────────────────── */

function CatDashboard({ onOpenSection }) {
  const date = todayKey();
  const { data: progress } = useAsyncResult(
    `cat:progress:${date}`,
    () => DataStore.cat.getProgress(date),
    [date]
  );

  return (
    <div className="cat">
      <CatCountdown />
      <CatSummaryCards progress={progress} onOpen={onOpenSection} />
      <MockPanel />
    </div>
  );
}

/* ── Section sub-page ───────────────────────────────────────── */

/** Editable topic checklist. */
function TopicChecklist({ section }) {
  const [version, setVersion]   = useState(0);
  const [input, setInput]       = useState('');
  const [adding, setAdding]     = useState(false);

  const { data: topics, loading } = useAsyncResult(
    `cat:topics:${section}:${version}`,
    () => DataStore.cat.topics.list(section),
    [section, version]
  );

  const bump = () => setVersion((v) => v + 1);

  const handleAdd = async () => {
    const t = input.trim();
    if (!t) return;
    setAdding(true);
    setInput('');
    await DataStore.cat.topics.add(section, t)
      .catch((e) => console.warn('[PARTH] topics.add:', e?.message))
      .finally(() => { setAdding(false); bump(); });
  };

  const handleToggle = (id, done) => {
    DataStore.cat.topics.toggle(id, !done).then(bump)
      .catch((e) => console.warn('[PARTH] topics.toggle:', e?.message));
  };

  const handleDelete = (id) => {
    DataStore.cat.topics.delete(id).then(bump)
      .catch((e) => console.warn('[PARTH] topics.delete:', e?.message));
  };

  const handleTitleBlur = (id, title) => {
    if (!title.trim()) return;
    DataStore.cat.topics.updateTitle(id, title.trim())
      .catch((e) => console.warn('[PARTH] topics.updateTitle:', e?.message));
  };

  const list = topics || [];
  const done = list.filter((t) => t.done).length;

  return (
    <div className="cat__topics">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>
        <h3 className="cat__section-title" style={{ margin: 0 }}>Topic Checklist</h3>
        {list.length > 0 && (
          <span className="cat__topics-progress">{done}/{list.length} done</span>
        )}
      </div>

      <div className="cat__topics-add">
        <input
          className="cat__topics-input"
          type="text"
          placeholder="Add a topic… e.g. Probability, RC Passage types"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          disabled={adding}
        />
        <button className="cat__topics-submit" onClick={handleAdd} disabled={adding || !input.trim()}>
          + Add
        </button>
      </div>

      <div className="cat__topic-list" role="list">
        {loading && !topics ? (
          <div className="cat__topics-empty">Loading…</div>
        ) : list.length === 0 ? (
          <div className="cat__topics-empty">No topics yet — add chapters or concepts to track.</div>
        ) : (
          list.map((t) => (
            <div key={t.id} className={`cat-topic${t.done ? ' cat-topic--done' : ''}`} role="listitem">
              <button
                className="cat-topic__check"
                onClick={() => handleToggle(t.id, t.done)}
                aria-label={t.done ? 'Mark incomplete' : 'Mark done'}
              >
                <span className="cat-topic__check-icon" aria-hidden="true">✓</span>
              </button>
              <input
                className="cat-topic__title"
                type="text"
                defaultValue={t.title}
                onBlur={(e) => handleTitleBlur(t.id, e.target.value)}
                title="Double-click to edit"
                readOnly={false}
                aria-label={`Topic: ${t.title}`}
              />
              <button
                className="cat-topic__delete"
                onClick={() => handleDelete(t.id)}
                aria-label="Delete topic"
                title="Delete"
              >×</button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/** Subject-scoped daily task plan. */
function SectionDailyPlan({ section }) {
  const date = todayKey();
  const [version, setVersion] = useState(0);
  const [input, setInput]     = useState('');
  const [adding, setAdding]   = useState(false);

  const { data: tasks, loading } = useAsyncResult(
    `cat:tasks:${section}:${date}:${version}`,
    () => DataStore.cat.getTasks(date, section),
    [section, date, version]
  );

  const bump = () => setVersion((v) => v + 1);

  const handleAdd = async () => {
    const t = input.trim();
    if (!t) return;
    setAdding(true);
    setInput('');
    await DataStore.cat.addTask(date, t, section)
      .catch((e) => console.warn('[PARTH] cat.addTask:', e?.message))
      .finally(() => { setAdding(false); bump(); });
  };

  const handleToggle = (id, done) => {
    DataStore.cat.toggleTask(id, !done).then(bump)
      .catch((e) => console.warn('[PARTH] cat.toggleTask:', e?.message));
  };

  const handleDelete = (id) => {
    DataStore.cat.deleteTask(id).then(bump)
      .catch((e) => console.warn('[PARTH] cat.deleteTask:', e?.message));
  };

  const list = tasks || [];

  return (
    <div className="cat__plan">
      <h3 className="cat__section-title">Today's Study Plan</h3>
      <div className="cat__plan-add">
        <input
          className="cat__plan-input"
          type="text"
          placeholder={`Add a task for today… e.g. Solve 20 ${section.toUpperCase()} questions`}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          disabled={adding}
        />
        <button className="cat__plan-submit" onClick={handleAdd} disabled={adding || !input.trim()}>
          + Add
        </button>
      </div>

      <div className="cat__task-list" role="list">
        {loading && !tasks ? (
          <div className="cat__task-empty">Loading…</div>
        ) : list.length === 0 ? (
          <div className="cat__task-empty">No tasks for today yet.</div>
        ) : (
          list.map((t) => (
            <div key={t.id} className={`cat-task${t.done ? ' cat-task--done' : ''}`} role="listitem">
              <button
                className="cat-task__check"
                onClick={() => handleToggle(t.id, t.done)}
                aria-label={t.done ? 'Mark incomplete' : 'Mark done'}
              >
                <span className="cat-task__check-icon" aria-hidden="true">✓</span>
              </button>
              <span className="cat-task__title">{t.title}</span>
              <button
                className="cat-task__delete"
                onClick={() => handleDelete(t.id)}
                aria-label="Delete task"
                title="Delete"
              >×</button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/** Auto-save notes textarea. */
function SectionNotes({ section }) {
  const [text, setText]    = useState('');
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef(null);

  // Load existing notes on mount / section change
  useEffect(() => {
    setLoaded(false);
    DataStore.cat.notes.get(section)
      .then((t) => { setText(t || ''); setLoaded(true); })
      .catch((e) => { console.warn('[PARTH] notes.get:', e?.message); setLoaded(true); });
  }, [section]);

  const handleChange = (e) => {
    const val = e.target.value;
    setText(val);
    setSaving(true);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      DataStore.cat.notes.save(section, val)
        .finally(() => setSaving(false));
    }, 500);
  };

  const sectionLabel = SECTIONS.find((s) => s.id === section)?.fullLabel || section;

  return (
    <div className="cat__notes">
      <div className="cat__notes-header">
        <h3 className="cat__section-title" style={{ margin: 0 }}>Notes</h3>
        <span className="cat__notes-saving" aria-live="polite">{saving ? 'saving…' : ''}</span>
      </div>
      <textarea
        className="cat__notes-editor"
        value={text}
        onChange={handleChange}
        placeholder={`Your ${sectionLabel} notes, strategies, formulas…`}
        disabled={!loaded}
        aria-label={`${sectionLabel} notes`}
      />
    </div>
  );
}

/** Section progress slider (sub-page variant, larger). */
function SectionProgress({ section }) {
  const date = todayKey();
  const [value, setValue]    = useState(0);
  const [saving, setSaving]  = useState(false);
  const [loaded, setLoaded]  = useState(false);
  const saveTimer = useRef(null);

  useEffect(() => {
    DataStore.cat.getProgress(date)
      .then((p) => { setValue(p[section] ?? 0); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, [date, section]);

  const handleChange = (e) => {
    const v = Number(e.target.value);
    setValue(v);
    setSaving(true);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      DataStore.cat.setProgress(date, section, v)
        .finally(() => setSaving(false));
    }, 800);
  };

  return (
    <div className="cat__progress-card">
      <ProgressRing section={section} value={value} size={88} />
      <div className="cat__progress-details">
        <label>Today's progress — {value}%</label>
        <input
          type="range"
          className="cat__progress-slider"
          min={0} max={100} step={1}
          value={value}
          onChange={handleChange}
          disabled={!loaded}
          aria-label="Section progress"
        />
        <span className="cat__progress-saving" aria-live="polite">{saving ? 'saving…' : ''}</span>
      </div>
    </div>
  );
}

/** Full section sub-page. */
function CatSectionPage({ section, onBack }) {
  const s = SECTIONS.find((x) => x.id === section);
  return (
    <div className={`cat cat__section-page--${section}`}>
      <header className="cat__section-header">
        <button className="cat__back-btn" onClick={onBack} aria-label="Back to CAT dashboard">
          ← Back
        </button>
        <h2>{s.fullLabel}</h2>
        <span className={`cat__section-badge cat__section-badge--${section}`}>{s.label}</span>
      </header>

      <SectionProgress section={section} />
      <TopicChecklist section={section} />
      <SectionDailyPlan section={section} />
      <SectionNotes section={section} />
    </div>
  );
}

/* ── Root ───────────────────────────────────────────────────── */

export default function Cat() {
  // 'dashboard' | 'qa' | 'dilr' | 'varc'
  const [view, setView] = useState('dashboard');

  if (view !== 'dashboard') {
    return <CatSectionPage section={view} onBack={() => setView('dashboard')} />;
  }
  return <CatDashboard onOpenSection={setView} />;
}
