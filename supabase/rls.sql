-- PARTH — Row-Level Security policies (V2.4)
-- Run AFTER schema.sql. Idempotent.
-- Each table enforces: a user can only touch rows where user_id = auth.uid().

-- ---------------------------------------------------------------------------
-- Role grants — Supabase auto-applies these when tables are created via the
-- dashboard UI, but NOT when created via raw SQL. Always run explicitly.
-- ---------------------------------------------------------------------------
grant usage on schema public to authenticated, anon;

grant all on public.journal         to authenticated;
grant all on public.planner_days    to authenticated;
grant all on public.trackers        to authenticated;
grant all on public.tracker_logs    to authenticated;
grant all on public.focus_sessions  to authenticated;
grant all on public.meta            to authenticated;

-- Safety: ensure RLS is on for all 6 tables.
alter table public.journal         enable row level security;
alter table public.planner_days    enable row level security;
alter table public.trackers        enable row level security;
alter table public.tracker_logs    enable row level security;
alter table public.focus_sessions  enable row level security;
alter table public.meta            enable row level security;

-- ---------------------------------------------------------------------------
-- Generic policy pattern, repeated per table:
--   SELECT ... using      (user_id = auth.uid())
--   INSERT ... with check (user_id = auth.uid())
--   UPDATE ... using      (user_id = auth.uid())
--                with check (user_id = auth.uid())
--   DELETE ... using      (user_id = auth.uid())
-- ---------------------------------------------------------------------------

-- journal
drop policy if exists journal_select on public.journal;
drop policy if exists journal_insert on public.journal;
drop policy if exists journal_update on public.journal;
drop policy if exists journal_delete on public.journal;
create policy journal_select on public.journal for select using (user_id = auth.uid());
create policy journal_insert on public.journal for insert with check (user_id = auth.uid());
create policy journal_update on public.journal for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy journal_delete on public.journal for delete using (user_id = auth.uid());

-- planner_days
drop policy if exists planner_select on public.planner_days;
drop policy if exists planner_insert on public.planner_days;
drop policy if exists planner_update on public.planner_days;
drop policy if exists planner_delete on public.planner_days;
create policy planner_select on public.planner_days for select using (user_id = auth.uid());
create policy planner_insert on public.planner_days for insert with check (user_id = auth.uid());
create policy planner_update on public.planner_days for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy planner_delete on public.planner_days for delete using (user_id = auth.uid());

-- trackers
drop policy if exists trackers_select on public.trackers;
drop policy if exists trackers_insert on public.trackers;
drop policy if exists trackers_update on public.trackers;
drop policy if exists trackers_delete on public.trackers;
create policy trackers_select on public.trackers for select using (user_id = auth.uid());
create policy trackers_insert on public.trackers for insert with check (user_id = auth.uid());
create policy trackers_update on public.trackers for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy trackers_delete on public.trackers for delete using (user_id = auth.uid());

-- tracker_logs
drop policy if exists tlog_select on public.tracker_logs;
drop policy if exists tlog_insert on public.tracker_logs;
drop policy if exists tlog_update on public.tracker_logs;
drop policy if exists tlog_delete on public.tracker_logs;
create policy tlog_select on public.tracker_logs for select using (user_id = auth.uid());
create policy tlog_insert on public.tracker_logs for insert with check (user_id = auth.uid());
create policy tlog_update on public.tracker_logs for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy tlog_delete on public.tracker_logs for delete using (user_id = auth.uid());

-- focus_sessions
drop policy if exists focus_select on public.focus_sessions;
drop policy if exists focus_insert on public.focus_sessions;
drop policy if exists focus_update on public.focus_sessions;
drop policy if exists focus_delete on public.focus_sessions;
create policy focus_select on public.focus_sessions for select using (user_id = auth.uid());
create policy focus_insert on public.focus_sessions for insert with check (user_id = auth.uid());
create policy focus_update on public.focus_sessions for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy focus_delete on public.focus_sessions for delete using (user_id = auth.uid());

-- meta
drop policy if exists meta_select on public.meta;
drop policy if exists meta_insert on public.meta;
drop policy if exists meta_update on public.meta;
drop policy if exists meta_delete on public.meta;
create policy meta_select on public.meta for select using (user_id = auth.uid());
create policy meta_insert on public.meta for insert with check (user_id = auth.uid());
create policy meta_update on public.meta for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy meta_delete on public.meta for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Email OTP — enable email confirmation flow with 6-digit OTP codes.
-- Run in the Supabase dashboard (Authentication → Email template) or set
-- these via the management API. The relevant project setting is:
--   Auth → Providers → Email → "Confirm email" = ON
--   Auth → Email Templates → "Confirm signup" template uses {{ .Token }}
--   (a 6-digit numeric token) rather than {{ .ConfirmationURL }}
-- That keeps the magic-link style off and signals OTP-only sign-in.
-- ---------------------------------------------------------------------------
