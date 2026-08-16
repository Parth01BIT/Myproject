/**
 * localStorage implementation of the DataStore interface (PRD §7.2).
 * Keys follow the parth: namespace pattern (PRD §7.1).
 * This file is the only place that calls localStorage directly.
 */

import { uuid } from '../lib/uuid.js';
import { todayKey, addDays } from '../lib/date.js';

const K = {
  journal: (d) => `parth:journal:${d}`,
  planner: (d) => `parth:planner:${d}`,
  trackers: 'parth:trackers',
  trackerLog: (id, d) => `parth:tracker-log:${id}:${d}`,
  focusSessions: (d) => `parth:focus-sessions:${d}`,
  meta: 'parth:meta',
};

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    // Quota exceeded or disabled — surface but don't crash (NF-007).
    if (e && (e.name === 'QuotaExceededError' || e.code === 22)) {
      console.warn('[PARTH] localStorage quota exceeded — save ignored.');
      return false;
    }
    throw e;
  }
  return true;
}

function remove(key) {
  try { localStorage.removeItem(key); } catch { /* noop */ }
}

/* ---------------- Journal ---------------- */
const journal = {
  get(date) {
    return read(K.journal(date), null);
  },
  save(date, entry) {
    const existing = journal.get(date) || {};
    const next = {
      content: '',
      mood: null,
      tags: [],
      ...existing,
      ...entry,
      updatedAt: new Date().toISOString(),
    };
    return write(K.journal(date), next);
  },
  /** Range query for BootSequence (V2.4). Returns Map<dateKey, entry>. */
  getForRange(startDate, endDate) {
    const out = new Map();
    let cur = startDate;
    while (cur <= endDate) {
      const e = journal.get(cur);
      if (e) out.set(cur, e);
      cur = addDays(cur, 1);
    }
    return out;
  },
};

/* ---------------- Planner ---------------- */
const planner = {
  get(date) {
    return read(K.planner(date), { tasks: [] });
  },
  save(date, data) {
    return write(K.planner(date), data);
  },
  addTask(date, { title, time = null, priority = 'low' }) {
    const day = planner.get(date);
    const order = day.tasks.length
      ? Math.max(...day.tasks.map((t) => t.order || 0)) + 1
      : 0;
    const task = { id: uuid(), title, time, priority, done: false, order };
    day.tasks.push(task);
    planner.save(date, day);
    return task;
  },
  updateTask(date, id, patch) {
    const day = planner.get(date);
    const t = day.tasks.find((x) => x.id === id);
    if (!t) return;
    Object.assign(t, patch);
    planner.save(date, day);
  },
  deleteTask(date, id) {
    const day = planner.get(date);
    day.tasks = day.tasks.filter((x) => x.id !== id);
    planner.save(date, day);
  },
  reorder(date, orderedIds) {
    const day = planner.get(date);
    const byId = new Map(day.tasks.map((t) => [t.id, t]));
    day.tasks = orderedIds
      .map((id, idx) => {
        const t = byId.get(id);
        if (!t) return null;
        t.order = idx;
        return t;
      })
      .filter(Boolean);
    planner.save(date, day);
  },
};

/* ---------------- Tracker ---------------- */
const tracker = {
  list() {
    return read(K.trackers, []);
  },
  _persist(list) {
    return write(K.trackers, list);
  },
  create({ name, type, unit = null }) {
    const list = tracker.list();
    const t = {
      id: uuid(),
      name,
      type,
      unit,
      createdAt: new Date().toISOString(),
    };
    list.push(t);
    tracker._persist(list);
    return t;
  },
  update(id, patch) {
    const list = tracker.list();
    const t = list.find((x) => x.id === id);
    if (!t) return;
    Object.assign(t, patch);
    tracker._persist(list);
  },
  delete(id) {
    // Delete tracker + sweep all its logs (best-effort scan).
    const list = tracker.list().filter((x) => x.id !== id);
    tracker._persist(list);
    sweepTrackerLogs(id);
  },
  log(id, date, value) {
    const payload = { value, loggedAt: new Date().toISOString() };
    return write(K.trackerLog(id, date), payload);
  },
  removeLog(id, date) {
    remove(K.trackerLog(id, date));
  },
  getLog(id, date) {
    return read(K.trackerLog(id, date), null);
  },
  getLogs(id, dates) {
    const out = {};
    for (const d of dates) {
      const l = tracker.getLog(id, d);
      if (l) out[d] = l.value;
    }
    return out;
  },
};

function sweepTrackerLogs(trackerId) {
  // localStorage doesn't enumerate by prefix easily — scan keys.
  const prefix = `parth:tracker-log:${trackerId}:`;
  const toDelete = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(prefix)) toDelete.push(key);
  }
  toDelete.forEach(remove);
}

/* ---------------- Focus sessions (V2.3) ----------------
 * per-day bucket, modeled on `planner:{date}`:
 *   parth:focus-sessions:{YYYY-MM-DD} -> { sessions: [sessionObj, ...] }
 *
 * sessionObj:
 *   {
 *     id,          (uuid)
 *     taskId?, taskTitle?,
 *     startedAt: ISO, endedAt: ISO,
 *     durationSec,       // planned
 *     elapsedSec,        // actual
 *     mode: 'focus' | 'break',
 *     completed: bool,
 *     stopReason?: 'manual' | 'switched',  // only when completed === false
 *   }
 */
const focus = {
  get(date) {
    return read(K.focusSessions(date), { sessions: [] });
  },
  add(date, session) {
    const day = focus.get(date);
    day.sessions.push(session);
    return write(K.focusSessions(date), day);
  },
  getForRange(startKey, endKey) {
    const out = [];
    let cur = startKey;
    while (cur <= endKey) {
      const day = focus.get(cur);
      if (day.sessions && day.sessions.length) {
        for (const s of day.sessions) out.push({ ...s, dateKey: cur });
      }
      cur = addDays(cur, 1);
    }
    return out;
  },
  getTotalForDate(date) {
    // Sum actual focus elapsed across all 'focus' mode sessions on this date.
    const day = focus.get(date);
    let sec = 0;
    let count = 0;
    let liveSec = 0;
    for (const s of day.sessions || []) {
      if (s.mode !== 'focus') continue;
      sec += s.elapsedSec || 0;
      count += s.completed ? 1 : 0;
      if (s.stopReason === 'manual' || s.stopReason === 'switched') count += 1;
    }
    void liveSec;
    return { seconds: sec, count: day.sessions.filter((s) => s.mode === 'focus').length };
  },
};

/* ---------------- Meta ---------------- */
const meta = {
  get() {
    return read(K.meta, {
      lastVisit: todayKey(),
      firstUse: todayKey(),
      theme: 'dark',
    });
  },
  update(patch) {
    const current = meta.get();
    const next = { ...current, ...patch };
    write(K.meta, next);
    return next;
  },
  touchVisit() {
    return meta.update({ lastVisit: todayKey() });
  },
  getTheme() {
    return meta.get().theme || 'dark';
  },
  setTheme(theme) {
    return meta.update({ theme });
  },
};

export const DataStore = {
  journal,
  planner,
  tracker,
  focus,
  meta,
  // Raw access for migration tooling / debugging only.
  _keys: K,
  _read: read,
  _write: write,
};

export default DataStore;
