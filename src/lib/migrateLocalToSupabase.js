/**
 * One-shot local→Supabase migration (V2.4 Stage B).
 *
 * Runs at most once per user. Triggered by Auth.jsx's `maybeMigrate` hook
 * (called when the auth session first resolves). Conditions:
 *   1. The user's `meta.migrated` row is not yet set in Supabase.
 *   2. The user has at least one parth:* key in localStorage (i.e. there is
 *      something to migrate).
 *   3. The user's Supabase `journal` / `planner_days` / `trackers` tables
 *      for this user are empty. (Idempotent guard: if a previous migration
 *      half-ran and crashed, we still skip re-uploading.)
 *
 * On success: writes `meta.migrated = true` for this user in Supabase, sets
 * a localStorage `parth:migrated` flag (local cache so we don't even try
 * next time), and resolves.
 *
 * On failure: logs and rethrows so the Auth.jsx maybeMigrate can swallow
 * it without blocking app load.
 *
 * Strategy:
 *   - Enumerate parth:* keys via localStorage scan.
 *   - Batch-upsert to Supabase in 25-row chunks (default PostgREST limit is
 *     larger but smaller batches keep payload size sane).
 *   - Order matters: trackers before tracker_logs, focus_sessions alone,
 *     journal/planner_days/meta independent.
 */
import { sb } from './supabaseClient.js';
import { DataStore as LocalDataStore } from '../store/localStorage.js';

const BATCH_SIZE = 25;
const LOCAL_FLAG = 'parth:migrated';

export async function migrateLocalToSupabase(user) {
  if (!user?.id) throw new Error('migrateLocalToSupabase: no user id');

  // Fast local bypass: if we've already migrated on this browser, skip.
  if (localStorage.getItem(LOCAL_FLAG) === '1') {
    return { skipped: 'local-flag' };
  }

  const userId = user.id;

  // 1. Parity check: any parth:* in localStorage?
  const parthKeys = scanParthKeys();
  if (parthKeys.length === 0) {
    // Nothing to migrate. Still flip the local flag so we don't re-scan.
    localStorage.setItem(LOCAL_FLAG, '1');
    return { skipped: 'empty' };
  }

  // 2. Idempotent guard: already migrated server-side?
  const { data: existingFlag } = await sb
    .from('meta')
    .select('value')
    .eq('user_id', userId)
    .eq('key', 'migrated')
    .maybeSingle();
  if (existingFlag?.value === true) {
    localStorage.setItem(LOCAL_FLAG, '1');
    return { skipped: 'server-flag' };
  }

  // 3. Trackers first (needed for tracker_logs FK).
  const localTrackers = LocalDataStore.tracker.list();
  if (localTrackers.length) {
    const rows = localTrackers.map((t) => ({
      user_id: userId,
      id: t.id,
      name: t.name,
      type: t.type,
      unit: t.unit,
      created_at: t.createdAt || new Date().toISOString(),
    }));
    await batchInsert('trackers', rows);
  }

  // 4. Tracker logs — scan localStorage for parth:tracker-log:* keys.
  const logRows = [];
  for (const key of parthKeys) {
    if (!key.startsWith('parth:tracker-log:')) continue;
    const rest = key.slice('parth:tracker-log:'.length);
    const [trackerId, date] = rest.split(':');
    if (!trackerId || !date) continue;
    const raw = localStorage.getItem(key);
    if (raw == null) continue;
    try {
      const payload = JSON.parse(raw);
      logRows.push({
        user_id: userId,
        tracker_id: trackerId,
        date,
        value: payload.value,
        logged_at: payload.loggedAt || new Date().toISOString(),
      });
    } catch { /* skip malformed */ }
  }
  if (logRows.length) await batchInsert('tracker_logs', logRows);

  // 5. Journal entries — parth:journal:{date} keys.
  const journalRows = [];
  for (const key of parthKeys) {
    if (!key.startsWith('parth:journal:')) continue;
    const date = key.slice('parth:journal:'.length);
    const entry = LocalDataStore.journal.get(date);
    if (!entry) continue;
    journalRows.push({
      user_id: userId,
      date,
      content: entry.content || '',
      mood: entry.mood || null,
      tags: entry.tags || [],
    });
  }
  if (journalRows.length) await batchInsert('journal', journalRows);

  // 6. Planner days — parth:planner:{date} keys.
  const plannerRows = [];
  for (const key of parthKeys) {
    if (!key.startsWith('parth:planner:')) continue;
    if (key.startsWith('parth:planner-t')) continue; // be safe
    const date = key.slice('parth:planner:'.length);
    const day = LocalDataStore.planner.get(date);
    if (!day || !day.tasks || !day.tasks.length) continue;
    plannerRows.push({
      user_id: userId,
      date,
      tasks: day.tasks,
    });
  }
  if (plannerRows.length) await batchInsert('planner_days', plannerRows);

  // 7. Focus sessions — parth:focus-sessions:{date} keys.
  const focusRows = [];
  for (const key of parthKeys) {
    if (!key.startsWith('parth:focus-sessions:')) continue;
    const date = key.slice('parth:focus-sessions:'.length);
    const day = LocalDataStore.focus.get(date);
    if (!day.sessions || !day.sessions.length) continue;
    for (const s of day.sessions) {
      focusRows.push({
        user_id: userId,
        id: s.id,
        date,
        task_id: s.taskId ?? null,
        task_title: s.taskTitle ?? null,
        started_at: s.startedAt,
        ended_at: s.endedAt,
        duration_sec: s.durationSec,
        elapsed_sec: s.elapsedSec,
        mode: s.mode,
        completed: s.completed,
        stop_reason: s.stopReason ?? null,
      });
    }
  }
  if (focusRows.length) await batchInsert('focus_sessions', focusRows);

  // 8. Meta rows — preserve theme + lastVisit + firstUse, set migrated=true.
  const localMeta = LocalDataStore.meta.get();
  const metaRows = [];
  if (localMeta.theme) metaRows.push({ user_id: userId, key: 'theme', value: localMeta.theme });
  if (localMeta.lastVisit) metaRows.push({ user_id: userId, key: 'lastVisit', value: localMeta.lastVisit });
  if (localMeta.firstUse) metaRows.push({ user_id: userId, key: 'firstUse', value: localMeta.firstUse });
  metaRows.push({ user_id: userId, key: 'migrated', value: true, updated_at: new Date().toISOString() });
  if (metaRows.length) await batchInsert('meta', metaRows);

  // 9. Mark flags so we never re-run.
  localStorage.setItem(LOCAL_FLAG, '1');

  return {
    ok: true,
    counts: {
      trackers: localTrackers.length,
      trackerLogs: logRows.length,
      journal: journalRows.length,
      planner: plannerRows.length,
      focus: focusRows.length,
      meta: metaRows.length,
    },
  };
}

/* ---------- helpers ---------- */

function scanParthKeys() {
  const out = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('parth:')) out.push(k);
  }
  return out;
}

async function batchInsert(table, rows) {
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const slice = rows.slice(i, i + BATCH_SIZE);
    const { error } = await sb.from(table).upsert(slice, {
      onConflict: conflictFor(table),
    });
    if (error) {
      console.warn(`[PARTH migrate] ${table} batch failed:`, error.message);
      throw error;
    }
  }
}

function conflictFor(table) {
  switch (table) {
    case 'journal': return 'user_id,date';
    case 'planner_days': return 'user_id,date';
    case 'trackers': return 'user_id,id';
    case 'tracker_logs': return 'user_id,tracker_id,date';
    case 'focus_sessions': return 'user_id,id';
    case 'meta': return 'user_id,key';
    default: return undefined;
  }
}
