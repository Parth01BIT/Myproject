# PARTH — Project Context & AI Reference

> **Purpose:** Hand this file to the AI at the start of every session so it can
> skip the directory-surfing phase and jump straight into work.
> Last updated: August 2026 — **v4**

---

## 1. What Is PARTH?

A **personal self-management SPA** styled as a browser window. The entire UI
is a browser chrome: macOS-style window controls, a tab bar, and an address bar
that shows `parth://today/aug-16`-style routes. Dark, editorial, minimal aesthetic.

**Solo user, no collaboration, no public-facing pages.**

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Build | Vite 8 (`npm run dev` / `npm run build`) |
| UI | React 19 (JSX, no TypeScript) |
| Styling | Vanilla CSS — no Tailwind, no CSS-in-JS |
| Persistence | **Supabase** (migrated from localStorage in v2.4) |
| Auth | Supabase email OTP (6-digit code, no passwords) |
| Drag-to-reorder | `@dnd-kit/core` + `@dnd-kit/sortable` |
| Fonts | Inter (body) + JetBrains Mono (address bar, boot sequence) |
| Hosting | Vercel (static SPA, `vercel.json` present) |
| Linter | oxlint (`npm run lint`) |

**Key env vars** (in `.env.local`, never commit):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

---

## 3. Directory Map

```
parth/
├── index.html
├── vite.config.js
├── package.json
├── vercel.json
├── PARTH_PRD_v1.md          <- full product spec
├── PROJECT_CONTEXT.md       <- this file
├── supabase/
│   ├── schema.sql           <- DB table definitions (run in Supabase SQL editor)
│   └── rls.sql              <- Row-Level Security policies
└── src/
    ├── main.jsx             <- ReactDOM.createRoot entry
    ├── App.jsx              <- root: AuthProvider -> AuthGate -> FocusTimerProvider -> AppInner
    ├── store/
    │   ├── DataStore.js     <- SWAP-POINT: re-exports from supabaseStore.js
    │   ├── supabaseStore.js <- live DataStore impl (all methods are async/Promise)
    │   └── localStorage.js  <- legacy impl; only used by migration script
    ├── lib/
    │   ├── supabaseClient.js <- singleton `sb` + `isSupabaseConfigured` flag
    │   ├── date.js          <- todayKey, toKey, addDays, dayDiff, dayShortLabel, etc.
    │   ├── streaks.js       <- computeStreak(trackerId) -> async, single range fetch
    │   ├── uuid.js          <- tiny uuid helper
    │   └── migrateLocalToSupabase.js <- one-shot localStorage->Supabase migrator
    ├── contexts/
    │   ├── Auth.jsx         <- AuthProvider / useAuth — email OTP flow
    │   └── FocusTimer.jsx   <- FocusTimerProvider / FocusTimerCtx — Pomodoro engine
    ├── hooks/
    │   ├── useRoute.js      <- primary nav hook; also exports TABS, parsePath, buildPath, buildAddress
    │   ├── useAsyncResult.js <- shared async+state primitive for DataStore reads
    │   ├── useStaleTabs.js  <- computeStale() + useStaleTabs() + useStaleVersion()
    │   ├── useBootGate.js   <- sessionStorage-gated boot sequence trigger
    │   ├── useDebounced.js  <- debounce utility hook
    │   ├── useFocusTimer.js <- useFocusStatus() consumer hook
    │   └── useTheme.js      <- dark/light theme toggle, persisted via DataStore.meta
    ├── components/
    │   ├── shell/           <- Browser chrome frame
    │   │   ├── BrowserShell.jsx   <- titlebar + TabBar + AddressBar + <main>
    │   │   ├── TabBar.jsx         <- tab navigation (stale opacity, focus pulse dot)
    │   │   ├── AddressBar.jsx     <- read-only parth:// display
    │   │   ├── WindowControls.jsx <- decorative dots (macOS style)
    │   │   ├── BootSequence.jsx   <- full-screen terminal boot animation
    │   │   ├── RestoreSession.jsx <- "Restore session?" modal (>2 day gap)
    │   │   ├── FocusWidget.jsx    <- floating Pomodoro timer widget
    │   │   └── Login.jsx          <- email OTP login UI
    │   ├── tabs/            <- One component per tab
    │   │   ├── Today.jsx          <- composite: streak banner + tasks + trackers + journal preview
    │   │   ├── Journal.jsx        <- daily entry editor (mood, tags, auto-save)
    │   │   ├── Planner.jsx        <- task list + quick-add + day picker
    │   │   ├── TaskItem.jsx       <- single task row (inline edit, dnd, focus-launch)
    │   │   ├── Tracker.jsx        <- tracker list container + create modal trigger
    │   │   ├── TrackerCard.jsx    <- single tracker card (toggle/number log + heatmap)
    │   │   ├── TrackerModal.jsx   <- create/edit tracker modal
    │   │   ├── History.jsx        <- calendar month view <-> day detail router
    │   │   ├── MonthGrid.jsx      <- calendar grid with colour-coded dot indicators
    │   │   ├── DayDetail.jsx      <- read-only composite view of a past day
    │   │   └── Clock.jsx          <- analogue/digital clock tab (bonus tab)
    │   └── common/          <- Shared sub-components
    │       ├── DayNav.jsx         <- <- / -> day navigation arrows
    │       ├── Heatmap.jsx        <- 12-week GitHub-style heatmap grid
    │       └── RichEditor.jsx     <- contentEditable rich-text editor
    └── styles/
        ├── tokens.css       <- CSS custom properties (colours, spacing, radius, motion)
        ├── shell.css        <- browser chrome, tab bar, address bar
        ├── journal.css
        ├── planner.css
        ├── tracker.css
        ├── history.css
        ├── today.css
        ├── clock.css
        ├── focus.css        <- FocusWidget + timer styles
        ├── login.css
        └── polish.css       <- boot sequence, restore session, micro-animations
```

---

## 4. App Render Tree

```
App
└── AuthProvider (contexts/Auth.jsx)
    └── AuthGate
        ├── <div class="app-splash" />   — while loading
        ├── <Login />                    — if !user
        └── FocusTimerProvider (contexts/FocusTimer.jsx)
            └── AppInner
                ├── <BootSequence />     — once per session (sessionStorage flag)
                ├── <RestoreSession />   — if gap > 2 days
                ├── <BrowserShell>
                │   └── [active tab pane]
                └── <FocusWidget />      — always mounted, floats over shell
```

**Tab panes** rendered by `AppInner` based on `route.tab`:
`today` | `journal` | `planner` | `tracker` | `clock` | `history`

---

## 5. Routing

`useRoute()` (hooks/useRoute.js) syncs `{ tab, dateKey, arg }` to `window.history`.

**Tab definitions** (exported as `TABS`):
```js
[
  { id: 'today',   label: 'Today',   icon: '🏠' },
  { id: 'journal', label: 'Journal', icon: '📓' },
  { id: 'planner', label: 'Planner', icon: '🗓' },
  { id: 'tracker', label: 'Tracker', icon: '📊' },
  { id: 'clock',   label: 'Clock',   icon: '⏱' },
  { id: 'history', label: 'History', icon: '🕰' },
]
```

**Address bar examples:**
- `parth://today/aug-18`
- `parth://journal/aug-18`
- `parth://planner/aug-18`
- `parth://tracker`
- `parth://clock`
- `parth://history/aug-2026`
- `parth://history/aug-14`

---

## 6. DataStore Interface

**All consumers import from `src/store/DataStore.js`** — never directly from
`supabaseStore.js` or `localStorage.js`.

Every method is **async (returns Promise)**. Use `useAsyncResult` in components.

```js
// Journal
DataStore.journal.get(date)              -> entry | null
DataStore.journal.save(date, entry)      -> entry
DataStore.journal.getForRange(start,end) -> Map<dateKey, entry>

// Planner
DataStore.planner.get(date)              -> { tasks: Task[] }
DataStore.planner.save(date, data)       -> { tasks: Task[] }
DataStore.planner.addTask(date, {title, time, priority}) -> Task
DataStore.planner.updateTask(date, id, patch)             -> void
DataStore.planner.deleteTask(date, id)                    -> void
DataStore.planner.reorder(date, orderedIds)               -> void
DataStore.planner.getForRange(start, end) -> Map<dateKey, {tasks}>

// Tracker
DataStore.tracker.list()                 -> Tracker[]
DataStore.tracker.create({name,type,unit}) -> Tracker
DataStore.tracker.update(id, patch)      -> void
DataStore.tracker.delete(id)             -> void
DataStore.tracker.log(id, date, value)   -> void
DataStore.tracker.removeLog(id, date)    -> void
DataStore.tracker.getLog(id, date)       -> {value, loggedAt} | null
DataStore.tracker.getLogs(id, dates[])   -> { [date]: value }
DataStore.tracker.getLogsForRange(id, start, end) -> Map<dateKey, value>

// Focus sessions
DataStore.focus.get(date)                -> { sessions: Session[] }
DataStore.focus.add(date, session)       -> void
DataStore.focus.getForRange(start, end)  -> Session[]
DataStore.focus.getTotalForDate(date)    -> { seconds, count }

// Meta (theme, lastVisit, firstUse, migrated)
DataStore.meta.get()                     -> { lastVisit, firstUse, theme, migrated }
DataStore.meta.update(patch)             -> metaObject
DataStore.meta.touchVisit()              -> metaObject
DataStore.meta.getTheme()               -> string
DataStore.meta.setTheme(theme)           -> void
```

**Task shape:**
```js
{ id: uuid, title: string, time: string|null, priority: 'low'|'medium'|'high', done: boolean, order: number }
```

**Tracker shape:**
```js
{ id: uuid, name: string, type: 'boolean'|'number', unit: string|null, createdAt: ISO }
```

---

## 7. Supabase Database Schema

7 tables, all with `user_id uuid references auth.users`:

| Table | Primary Key | Notes |
|---|---|---|
| `journal` | `(user_id, date)` | `content text, mood text, tags jsonb, updated_at` |
| `planner_days` | `(user_id, date)` | `tasks jsonb` — full Task[] blob |
| `trackers` | `(user_id, id)` | `name, type, unit, created_at` |
| `tracker_logs` | `(user_id, tracker_id, date)` | `value jsonb` — bool or number |
| `focus_sessions` | `(user_id, id)` | `date, task_id, started_at, ended_at, duration_sec, elapsed_sec, mode, completed, stop_reason` |
| `meta` | `(user_id, key)` | key/value: `lastVisit`, `firstUse`, `theme`, `migrated` |

RLS policies in `supabase/rls.sql` — users can only read/write their own rows.

---

## 8. Auth Flow

1. User enters email -> `sendOtp(email)` -> Supabase emails a 6-digit code
2. User enters code -> `verifyOtp(email, code)` -> session created
3. Session stored in localStorage by supabase-js (persists across refresh)
4. `onAuthStateChange` fires -> `maybeMigrate(user)` runs once
5. `<AuthGate>` switches from `<Login>` to `<AppInner>`

**On first login with existing localStorage data:** `migrateLocalToSupabase.js`
uploads all local data to Supabase, then sets `meta.migrated = true`.

---

## 9. Focus Timer (Pomodoro)

`FocusTimerProvider` owns the in-flight session. Cross-cuts:
- **Planner** — each task row has a play button to launch a session
- **FocusWidget** — floating overlay (always mounted at App level)
- **TabBar** — pulsing amber dot on active tab while timer runs
- **Tracker auto-feed** — if a tracker named "Focus minutes" (or similar) exists,
  completed sessions add elapsed minutes to today's log

**Lifecycle:**
- Natural complete -> auto-start break (5 min) -> idle
- Manual stop / task switch (>=60s elapsed) -> write session as `completed: false`
- Manual stop / task switch (<60s elapsed) -> discard silently

---

## 10. Key Patterns & Conventions

### Async reads in components
```jsx
const { data: entry, loading, error } = useAsyncResult(
  `journal:${dateKey}`,
  () => DataStore.journal.get(dateKey),
  [dateKey]
);
```

### Stale tab indicator
After **any write**, call `bumpStale()` (passed down from `AppInner`).
`useStaleTabs` re-runs `computeStale()` which checks journal, planner, and tracker logs.

### Theme
`data-theme="dark"` or `data-theme="light"` on `<html>`. All tokens in
`tokens.css`. Persisted to `DataStore.meta.setTheme()`.

### CSS conventions
- All styles in per-feature CSS files, no CSS modules
- Use `--tokens` from `tokens.css`, never hardcode colors/spacing
- BEM-ish class names: `.shell__titlebar`, `.trkcard__actions`, `.task__delete`
- Touch adaptations via `@media (hover: none)` in `tokens.css`

### No direct localStorage calls
All data goes through `DataStore`. `localStorage.js` is only imported by
`migrateLocalToSupabase.js`.

---

## 11. Version History

| Version | What was added |
|---|---|
| **v1** | Core 5 tabs (Today, Journal, Planner, Tracker, History) + localStorage DataStore |
| **v2** | FocusTimer (Pomodoro) — floating widget, tracker auto-feed, focus_sessions table |
| **v3** | Clock tab (bonus tab, not in PRD) |
| **v4** | Supabase migration — all DataStore methods async, email OTP auth, RLS, migrateLocalToSupabase |

> The codebase uses internal labels like "V2.4" / "Stage A / Stage B" in comments.
> These refer to sub-steps within v4's Supabase migration work, not product versions.

---

## 12. Current State (v4 — Live)

- All 5 PRD tabs + bonus Clock tab functional
- **v4:** Supabase backend replacing localStorage
- **v4:** Email OTP auth + one-shot migration script (localStorage → Supabase)
- **v3:** Clock tab
- **v2:** FocusTimer (Pomodoro) with tracker auto-feed
- Dual theme (dark default / warm-paper light)
- Boot sequence, restore session modal, stale tab indicators
- Drag-to-reorder tasks (dnd-kit)
- Heatmap visualisation for trackers
- Touch / mobile responsive adaptations

---

## 13. PRD Feature Reference (short)

| Tab | Key behaviour |
|---|---|
| Today | Composite: streak banner -> tasks (inline check) -> trackers (inline log) -> journal preview |
| Journal | One entry/day, RichEditor (contentEditable), mood picker (5 moods), tags, 500ms auto-save |
| Planner | Task list, quick-add (Enter), inline edit, priority badge, drag-reorder, day picker |
| Tracker | Boolean (toggle) + number trackers, streak forgiveness, 12-week heatmap |
| History | Month calendar grid, color-coded dots (journal=blue, planner=amber, tracker=green), day detail |
| Clock | Analogue + digital clock, bonus tab not in original PRD |

**Streak forgiveness rule (TR-007):** Only an explicit `value === false` log
breaks a streak. Days with NO log (app not opened) freeze it — no penalty.

---

## 14. Things NOT in This Project (v1 scope guardrail)

- No AI features
- No multi-user / sharing
- No command bar / CLI input
- No data export (JSON)
- No native app
- No SSR / Next.js
- No Tailwind CSS

---

## 15. Quick Reference — Commands

```powershell
# Install (first time)
npm install

# Dev server (localhost:5173 by default)
npm run dev

# Lint
npm run lint

# Production build
npm run build
```

Database changes: edit `supabase/schema.sql` and/or `supabase/rls.sql`,
then run in the Supabase project's SQL editor.
