/**
 * Supabase implementation of the DataStore interface (V2.4).
 * Drop-in async replacement for localStorage.js.
 *
 * Every method returns a Promise. Call sites migrate to `useAsyncResult`
 * or explicit async handlers.
 *
 * `user_id` is resolved at call time from `sb.auth.getUser()` — never accepts
 * user_id as a param, since RLS enforces ownership server-side anyway.
 *
 * Key shape mirrors localStorage.js exactly so consumer code at call-site
 * level (what you `get`/`save`) is unchanged.
 */
import { sb } from '../lib/supabaseClient.js';
import { uuid } from '../lib/uuid.js';
import { addDays } from '../lib/date.js';

/* ---------- internal helpers ---------- */

async function uid() {
  const { data, error } = await sb.auth.getUser();
  if (error || !data?.user) throw new Error('Not authenticated');
  return data.user.id;
}

async function unwrap(p) {
  const { data, error } = await p;
  if (error) throw error;
  return data;
}

/* ============================================================ Journal === */

const journal = {
  async get(date) {
    const userId = await uid();
    const row = await unwrap(
      sb.from('journal').select('*').eq('user_id', userId).eq('date', date).maybeSingle()
    );
    if (!row) return null;
    return {
      content: row.content || '',
      mood: row.mood || null,
      tags: row.tags || [],
      updatedAt: row.updated_at,
    };
  },

  async save(date, entry) {
    const userId = await uid();
    const payload = {
      user_id: userId,
      date,
      content: entry.content ?? '',
      mood: entry.mood ?? null,
      tags: entry.tags ?? [],
    };
    await unwrap(
      sb.from('journal').upsert(payload, { onConflict: 'user_id,date' })
    );
    return journal.get(date);
  },

  /** Range query for BootSequence: returns a Map of dateKey -> journal entry shape. */
  async getForRange(startDate, endDate) {
    const userId = await uid();
    const rows = await unwrap(
      sb.from('journal')
        .select('*')
        .eq('user_id', userId)
        .gte('date', startDate)
        .lte('date', endDate)
    );
    const out = new Map();
    for (const r of rows || []) {
      out.set(r.date, {
        content: r.content || '',
        mood: r.mood || null,
        tags: r.tags || [],
        updatedAt: r.updated_at,
      });
    }
    return out;
  },
};

/* ============================================================ Planner === */

const planner = {
  async get(date) {
    const userId = await uid();
    const row = await unwrap(
      sb.from('planner_days').select('*').eq('user_id', userId).eq('date', date).maybeSingle()
    );
    return { tasks: row?.tasks || [] };
  },

  async _saveRaw(date, tasks) {
    const userId = await uid();
    await unwrap(
      sb.from('planner_days').upsert(
        { user_id: userId, date, tasks },
        { onConflict: 'user_id,date' }
      )
    );
  },

  async save(date, data) {
    await planner._saveRaw(date, data.tasks || []);
    return planner.get(date);
  },

  async addTask(date, { title, time = null, priority = 'low' }) {
    const day = await planner.get(date);
    const order = day.tasks.length
      ? Math.max(...day.tasks.map((t) => t.order || 0)) + 1
      : 0;
    const task = { id: uuid(), title, time, priority, done: false, order };
    day.tasks.push(task);
    await planner._saveRaw(date, day.tasks);
    return task;
  },

  async updateTask(date, id, patch) {
    const day = await planner.get(date);
    const t = day.tasks.find((x) => x.id === id);
    if (!t) return;
    Object.assign(t, patch);
    await planner._saveRaw(date, day.tasks);
  },

  async deleteTask(date, id) {
    const day = await planner.get(date);
    day.tasks = day.tasks.filter((x) => x.id !== id);
    await planner._saveRaw(date, day.tasks);
  },

  async reorder(date, orderedIds) {
    const day = await planner.get(date);
    const byId = new Map(day.tasks.map((t) => [t.id, t]));
    const next = orderedIds
      .map((id, idx) => {
        const t = byId.get(id);
        if (!t) return null;
        t.order = idx;
        return t;
      })
      .filter(Boolean);
    await planner._saveRaw(date, next);
  },

  /** Range query for MonthGrid: returns a Map of dateKey -> { tasks: [] }. */
  async getForRange(startDate, endDate) {
    const userId = await uid();
    const rows = await unwrap(
      sb.from('planner_days')
        .select('date, tasks')
        .eq('user_id', userId)
        .gte('date', startDate)
        .lte('date', endDate)
    );
    const out = new Map();
    for (const r of rows || []) out.set(r.date, { tasks: r.tasks || [] });
    return out;
  },
};

/* ============================================================ Tracker === */

const tracker = {
  async list() {
    const userId = await uid();
    const rows = await unwrap(
      sb.from('trackers').select('*').eq('user_id', userId).order('created_at', { ascending: true })
    );
    return (rows || []).map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      unit: r.unit,
      createdAt: r.created_at,
    }));
  },

  async _persistRow(row) {
    const userId = await uid();
    await unwrap(
      sb.from('trackers').upsert(
        { ...row, user_id: userId },
        { onConflict: 'user_id,id' }
      )
    );
  },

  async create({ name, type, unit = null }) {
    const userId = await uid();
    const id = uuid();
    const payload = {
      user_id: userId,
      id,
      name,
      type,
      unit,
      created_at: new Date().toISOString(),
    };
    await unwrap(sb.from('trackers').insert(payload));
    return { id, name, type, unit, createdAt: payload.created_at };
  },

  async update(id, patch) {
    const userId = await uid();
    await unwrap(
      sb.from('trackers').update(patch).eq('user_id', userId).eq('id', id)
    );
  },

  async delete(id) {
    const userId = await uid();
    // FK onDelete cascade removes tracker_logs automatically.
    await unwrap(
      sb.from('trackers').delete().eq('user_id', userId).eq('id', id)
    );
  },

  async log(id, date, value) {
    const userId = await uid();
    await unwrap(
      sb.from('tracker_logs').upsert(
        {
          user_id: userId,
          tracker_id: id,
          date,
          value,
          logged_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,tracker_id,date' }
      )
    );
  },

  async removeLog(id, date) {
    const userId = await uid();
    await unwrap(
      sb.from('tracker_logs')
        .delete()
        .eq('user_id', userId)
        .eq('tracker_id', id)
        .eq('date', date)
    );
  },

  async getLog(id, date) {
    const userId = await uid();
    const row = await unwrap(
      sb.from('tracker_logs')
        .select('value, logged_at')
        .eq('user_id', userId)
        .eq('tracker_id', id)
        .eq('date', date)
        .maybeSingle()
    );
    if (!row) return null;
    return { value: row.value, loggedAt: row.logged_at };
  },

  async getLogs(id, dates) {
    // For backwards-compat with the localStorage signature (key map).
    const userId = await uid();
    const rows = await unwrap(
      sb.from('tracker_logs')
        .select('date, value')
        .eq('user_id', userId)
        .eq('tracker_id', id)
        .in('date', dates)
    );
    const out = {};
    for (const r of rows || []) out[r.date] = r.value;
    return out;
  },

  /** Single range fetch replacing the 1095 sequential getLog calls in streaks.js. */
  async getLogsForRange(id, startDate, endDate) {
    const userId = await uid();
    const rows = await unwrap(
      sb.from('tracker_logs')
        .select('date, value')
        .eq('user_id', userId)
        .eq('tracker_id', id)
        .gte('date', startDate)
        .lte('date', endDate)
    );
    const out = new Map();
    for (const r of rows || []) out.set(r.date, r.value);
    return out;
  },
};

/* ============================================================ Focus === */

const focus = {
  async get(date) {
    const userId = await uid();
    const rows = await unwrap(
      sb.from('focus_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('date', date)
    );
    return { sessions: rowsToSessions(rows) };
  },

  async add(date, session) {
    const userId = await uid();
    await unwrap(
      sb.from('focus_sessions').insert({
        user_id: userId,
        id: session.id,
        date,
        task_id: session.taskId ?? null,
        task_title: session.taskTitle ?? null,
        started_at: session.startedAt,
        ended_at: session.endedAt,
        duration_sec: session.durationSec,
        elapsed_sec: session.elapsedSec,
        mode: session.mode,
        completed: session.completed,
        stop_reason: session.stopReason ?? null,
      })
    );
  },

  async getForRange(startKey, endKey) {
    const userId = await uid();
    const rows = await unwrap(
      sb.from('focus_sessions')
        .select('*')
        .eq('user_id', userId)
        .gte('date', startKey)
        .lte('date', endKey)
    );
    const out = [];
    let cur = startKey;
    const byDate = new Map();
    for (const r of rows || []) {
      const dateKey = r.date;
      if (!byDate.has(dateKey)) byDate.set(dateKey, []);
      byDate.get(dateKey).push(rowToSession(r));
    }
    while (cur <= endKey) {
      for (const s of byDate.get(cur) || []) out.push({ ...s, dateKey: cur });
      cur = addDays(cur, 1);
    }
    return out;
  },

  async getTotalForDate(date) {
    const day = await focus.get(date);
    let sec = 0;
    let count = 0;
    for (const s of day.sessions) {
      if (s.mode !== 'focus') continue;
      sec += s.elapsedSec || 0;
      count += 1;
    }
    return { seconds: sec, count };
  },
};

function rowToSession(r) {
  return {
    id: r.id,
    taskId: r.task_id,
    taskTitle: r.task_title,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    durationSec: r.duration_sec,
    elapsedSec: r.elapsed_sec,
    mode: r.mode,
    completed: r.completed,
    stopReason: r.stop_reason,
  };
}

function rowsToSessions(rows) {
  return (rows || []).map(rowToSession);
}

/* ============================================================ Meta === */

/**
 * Supabase `meta` table is a per-user key/value store. The localStorage
 * version modeled meta as a single object; we emulate the same shape by
 * reading all rows for the user on `get()` and returning a merged object
 * shaped like { lastVisit, firstUse, theme, migrated }.
 */
const meta = {
  async get() {
    const userId = await uid();
    const rows = await unwrap(
      sb.from('meta').select('key, value').eq('user_id', userId)
    );
    const out = { lastVisit: null, firstUse: null, theme: 'dark', migrated: false };
    for (const r of rows || []) {
      out[r.key] = r.value;
    }
    return out;
  },

  async _upsert(key, value) {
    const userId = await uid();
    await unwrap(
      sb.from('meta').upsert(
        { user_id: userId, key, value, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,key' }
      )
    );
  },

  async update(patch) {
    for (const [k, v] of Object.entries(patch)) {
      await meta._upsert(k, v);
    }
    return meta.get();
  },

  async touchVisit() {
    const today = new Date().toISOString().slice(0, 10);
    await meta._upsert('lastVisit', today);
    return meta.get();
  },

  async getTheme() {
    const m = await meta.get();
    return m.theme || 'dark';
  },

  async setTheme(theme) {
    await meta._upsert('theme', theme);
  },
};

/* ============================================================ Export === */

export const DataStore = {
  journal,
  planner,
  tracker,
  focus,
  meta,
};

export default DataStore;
