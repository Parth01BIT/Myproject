-- PARTH — Supabase schema (V2.5)
-- Run in the Supabase SQL Editor. Idempotent: safe to re-run after edits.
-- Companion file: rls.sql (enables row-level security + policies).

-- ============================================================================
-- 9 tables, all scoped by user_id (references auth.users). One row per
-- (user_id, natural-key). Maps 1:1 to the parth:* localStorage namespaces.
-- V2.5 adds: cat_progress, cat_tasks (CAT 2026 exam prep tab)
-- ============================================================================

-- journal: one entry per (user, day). matches DataStore.journal shape.
create table if not exists public.journal (
  user_id    uuid not null references auth.users(id) on delete cascade,
  date       date not null,
  content    text default '',
  mood       text,
  tags       jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);

-- planner_days: one row per (user, day). tasks stored as jsonb to preserve
-- the Task[] shape ({id,title,time,priority,done,order}) without a relational
-- tasks table (preserves reorder/insert semantics from localStorage.js).
create table if not exists public.planner_days (
  user_id    uuid not null references auth.users(id) on delete cascade,
  date       date not null,
  tasks      jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);

-- trackers: catalog of tracker definitions (boolean / number + unit).
create table if not exists public.trackers (
  user_id    uuid not null references auth.users(id) on delete cascade,
  id         uuid not null default gen_random_uuid(),
  name       text not null,
  type       text not null check (type in ('boolean', 'number')),
  unit       text,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- tracker_logs: one value per (tracker, day). Mirrors DataStore.tracker.log.
create table if not exists public.tracker_logs (
  user_id     uuid not null references auth.users(id) on delete cascade,
  tracker_id  uuid not null,
  date        date not null,
  value       jsonb not null,
  logged_at   timestamptz not null default now(),
  primary key (user_id, tracker_id, date),
  foreign key (user_id, tracker_id) references public.trackers(user_id, id) on delete cascade
);

-- focus_sessions: one row per focus/break session. id is the client-supplied
-- uuid (matches DataStore.focus.add(session) shape).
create table if not exists public.focus_sessions (
  user_id      uuid not null references auth.users(id) on delete cascade,
  id           uuid not null,
  date         date not null,
  task_id      uuid,
  task_title   text,
  started_at   timestamptz,
  ended_at     timestamptz,
  duration_sec integer,
  elapsed_sec  integer,
  mode         text not null check (mode in ('focus', 'break')),
  completed    boolean not null default false,
  stop_reason  text,
  created_at   timestamptz not null default now(),
  primary key (user_id, id)
);

-- meta: per-user key/value store (theme, lastVisit, firstUse, migrated flag).
create table if not exists public.meta (
  user_id     uuid not null references auth.users(id) on delete cascade,
  key         text not null,
  value       jsonb not null,
  updated_at  timestamptz not null default now(),
  primary key (user_id, key)
);

-- ============================================================================
-- updated_at trigger — keeps updated_at in sync on every UPDATE.
-- ============================================================================
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- cat_progress: one row per (user, date, section). Tracks study progress
-- per section per day so you can chart improvement over time.
create table if not exists public.cat_progress (
  user_id    uuid not null references auth.users(id) on delete cascade,
  date       date not null,
  section    text not null check (section in ('qa', 'dilr', 'varc')),
  value      integer not null default 0 check (value between 0 and 100),
  updated_at timestamptz not null default now(),
  primary key (user_id, date, section)
);

-- cat_tasks: CAT-prep daily task list, separate from planner_days.
create table if not exists public.cat_tasks (
  user_id    uuid not null references auth.users(id) on delete cascade,
  id         uuid not null default gen_random_uuid(),
  date       date not null,
  title      text not null,
  done       boolean not null default false,
  order_idx  integer not null default 0,
  -- section: null = dashboard-level task; 'qa'|'dilr'|'varc' = subject-scoped task
  section    text check (section in ('qa', 'dilr', 'varc')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
-- For existing rows: backfill section = NULL (already the default for new column)
alter table public.cat_tasks add column if not exists section text check (section in ('qa', 'dilr', 'varc'));

-- index to quickly fetch all tasks for a given (user, date)
create index if not exists cat_tasks_user_date
  on public.cat_tasks (user_id, date);

-- cat_topic_items: editable topic checklist per section (e.g. "Algebra", "RC Passage types").
create table if not exists public.cat_topic_items (
  user_id    uuid not null references auth.users(id) on delete cascade,
  id         uuid not null default gen_random_uuid(),
  section    text not null check (section in ('qa', 'dilr', 'varc')),
  title      text not null,
  done       boolean not null default false,
  order_idx  integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists cat_topics_user_section
  on public.cat_topic_items (user_id, section);

-- cat_mocks: log of every mock attempt (full-length or sectional).
create table if not exists public.cat_mocks (
  user_id    uuid not null references auth.users(id) on delete cascade,
  id         uuid not null default gen_random_uuid(),
  date       date not null,
  -- type: 'full' = full-length; 'qa'|'dilr'|'varc' = sectional
  type       text not null check (type in ('full', 'qa', 'dilr', 'varc')),
  name       text,        -- e.g. "AIMCAT 3", "SimCAT 7"
  score      integer,     -- raw score
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists cat_mocks_user_date
  on public.cat_mocks (user_id, date desc);

do $$
declare
  t text;
begin
  for t in select unnest(array['journal', 'planner_days', 'meta', 'cat_progress', 'cat_tasks', 'cat_topic_items'])
  loop
    execute format(
      'drop trigger if exists set_updated_at on public.%I;
       create trigger set_updated_at before update on public.%I
       for each row execute function public.touch_updated_at();',
      t, t
    );
  end loop;
end$$;
