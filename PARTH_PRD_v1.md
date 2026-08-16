# PARTH — Product Requirements Document (v1)
### Personal Self-Management Web App — Browser Concept

| Field | Detail |
|---|---|
| **Product** | PARTH |
| **Version** | 1.0 |
| **Author** | Parth |
| **Date** | August 16, 2026 |
| **Status** | Draft — Approved for Build |

---

## Table of Contents

1. [Overview](#1-overview)
2. [Goals & Success Criteria](#2-goals--success-criteria)
3. [User Persona](#3-user-persona)
4. [Tech Stack](#4-tech-stack)
5. [Information Architecture](#5-information-architecture)
6. [Feature Requirements](#6-feature-requirements)
7. [Data Model](#7-data-model)
8. [Design System](#8-design-system)
9. [Non-Functional Requirements](#9-non-functional-requirements)
10. [Build Phases & Milestones](#10-build-phases--milestones)
11. [Future Scope (Parked)](#11-future-scope-parked)
12. [Risks & Mitigations](#12-risks--mitigations)
13. [Guardrails](#13-guardrails)

---

## 1. Overview

### 1.1 What is PARTH?

PARTH is a personal self-management web app that reimagines your day as a **browser session**. Instead of a conventional dashboard, the entire app is styled as a browser window — a tab bar across the top, each tab representing a different facet of your day. The aesthetic is dark, editorial, and minimal.

### 1.2 Problem Statement

Existing productivity and self-management tools fall into two camps:
- **Over-engineered platforms** (Notion, ClickUp) that require setup overhead and fight for attention with features you'll never use.
- **Minimal trackers** (habit apps, simple to-do lists) that are too narrow and don't connect the dots between planning, reflection, and tracking.

PARTH occupies the middle ground: structured enough to be useful, simple enough to not become another chore. The browser metaphor provides a familiar, intuitive frame that makes the app feel like a natural extension of your workflow — not another app to learn.

### 1.3 Scope

| In Scope (v1) | Out of Scope (v1) |
|---|---|
| Web application (SPA) | Native mobile/desktop apps |
| Solo user, single device | Multi-user / collaboration |
| Client-side data (localStorage) | Cloud sync / backend |
| 5 core tabs | AI features |
| Browser chrome aesthetic | Command bar / CLI input |
| Offline-capable | Authentication / accounts |

---

## 2. Goals & Success Criteria

### 2.1 Product Goals

| # | Goal |
|---|---|
| G1 | Provide a single place to plan, journal, track, and review each day |
| G2 | Make daily self-management feel lightweight and habitual, not burdensome |
| G3 | Use the browser metaphor to create a distinctive, memorable identity |
| G4 | Ship a working v1 that is immediately usable, then iterate |

### 2.2 Success Criteria (Personal — Solo User)

| Metric | Target |
|---|---|
| **Daily usage** | Opens PARTH at least once per day within the first 2 weeks |
| **Feature adoption** | Uses at least 3 out of 5 tabs regularly |
| **Data persistence** | No data loss across sessions over 30 days |
| **Time-to-entry** | Can log a journal entry or add a task in under 10 seconds |
| **Subjective** | Feels like "opening my browser for the day," not "opening another app" |

---

## 3. User Persona

| Field | Detail |
|---|---|
| **Name** | Parth (the sole user) |
| **Context** | Solo user managing personal productivity, journaling, and habit tracking |
| **Needs** | A single unified tool that combines planning, journaling, and tracking without context-switching between apps |
| **Pain points** | Too many separate apps for separate concerns; over-featured tools that feel like work; streak-based apps that punish gaps instead of encouraging return |
| **Devices** | Desktop browser (primary) |

---

## 4. Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| **Build tool** | Vite | Fast HMR, zero-config, ideal for SPAs |
| **UI framework** | React | Component model, ecosystem, developer familiarity |
| **Styling** | Vanilla CSS | Full control over the browser chrome aesthetic; custom design tokens without utility-class overhead |
| **Persistence** | localStorage | Zero backend, zero auth, zero deployment complexity. Solo user on a single device. |
| **Data abstraction** | Custom `DataStore` interface | Clean separation between app logic and storage. Swapping to Supabase or IndexedDB later requires changing one file, not the whole app. |
| **Fonts** | Google Fonts (Inter, JetBrains Mono) | Inter for body (legibility), JetBrains Mono for chrome/boot (editorial character) |
| **Hosting** | Static (Vercel / Netlify / local) | SPA with no server requirement |

### 4.1 Why Not the Original Stack?

The original plan specified Next.js + FastAPI + Supabase. This was simplified for v1 because:

- **No SSR needed** — PARTH is a personal SPA, not a public-facing site. No SEO, no server rendering.
- **No API layer needed** — With localStorage, there's no server to talk to. FastAPI adds deployment complexity with zero v1 benefit.
- **No auth needed** — Solo user on a single machine.
- **Migration path is clean** — The `DataStore` abstraction means Supabase can be added later without rewriting app logic.

---

## 5. Information Architecture

```
PARTH (Browser Window)
│
├── Window Controls (●●●)           ← decorative
├── Tab Bar                          ← primary navigation
│   ├── 🏠 Today     (default)
│   ├── 📓 Journal
│   ├── 🗓 Planner
│   ├── 📊 Tracker
│   └── 🕰 History
├── Address Bar                      ← shows parth:// route
│
└── Tab Content Area                 ← renders active tab
    ├── Today    → composite view (interactive)
    ├── Journal  → daily entry editor
    ├── Planner  → task list for selected day
    ├── Tracker  → tracker management + daily log
    └── History  → calendar browse + day detail
```

### 5.1 Navigation Model

- **Primary navigation**: Tab bar (always visible, always at the top).
- **Secondary navigation**: Date pickers within Journal, Planner, and History tabs.
- **No sidebar, no hamburger menu, no nested routes.** One level of navigation only.
- Tab switching is instant (no page reload — React state or simple routing).

---

## 6. Feature Requirements

### 6.1 Browser Shell

The shell is the app's frame. It wraps every tab and provides the browser metaphor.

#### 6.1.1 Window Controls

| Req ID | Requirement | Priority |
|---|---|---|
| SH-001 | Display macOS-style window control dots (●●●) in the top-left corner | Must |
| SH-002 | Dots are colored red, yellow, green | Must |
| SH-003 | Dots are decorative (no functional action) for v1 | Must |
| SH-004 | Controls are part of a top "title bar" strip spanning the full width | Must |

#### 6.1.2 Tab Bar

| Req ID | Requirement | Priority |
|---|---|---|
| TB-001 | Render 5 tabs horizontally below the title bar: Today, Journal, Planner, Tracker, History | Must |
| TB-002 | Each tab displays its emoji icon and label text | Must |
| TB-003 | Active tab is visually elevated (brighter background, connected to content area below, no bottom border) | Must |
| TB-004 | Inactive tabs are visually recessed (dimmer, separated from content area) | Must |
| TB-005 | Clicking a tab switches to that tab's content immediately (no loading state) | Must |
| TB-006 | Tab bar is always visible and pinned — never scrolls away | Must |
| TB-007 | **Stale tab indicator**: if a tab's underlying data is empty for today, apply a subtle frosted/suspended visual treatment (reduced opacity, faint overlay or desaturation) | Should |
| TB-008 | Stale indicator does not apply to History (it's inherently retrospective) | Should |
| TB-009 | Tab bar should feel like a real browser tab bar — rounded top corners on tabs, seamless join between active tab and content pane | Must |

#### 6.1.3 Address Bar

| Req ID | Requirement | Priority |
|---|---|---|
| AB-001 | Render an address bar below the tab bar | Must |
| AB-002 | Display the current route in `parth://` protocol format (e.g., `parth://today/aug-16`, `parth://journal/aug-16`, `parth://tracker`) | Must |
| AB-003 | Include a lock icon (🔒) to the left of the URL text | Must |
| AB-004 | Address bar is read-only for v1 (not editable, not clickable) | Must |
| AB-005 | URL updates automatically when switching tabs or changing the viewed date | Must |
| AB-006 | Use monospace font (JetBrains Mono) for the URL text | Must |

---

### 6.2 Today Tab (🏠)

The landing tab. An interactive composite view pulling data from Journal, Planner, and Tracker for the current day.

#### 6.2.1 Functional Requirements

| Req ID | Requirement | Priority |
|---|---|---|
| TD-001 | Display today's tasks (from Planner) in a checklist format | Must |
| TD-002 | Allow checking/unchecking tasks inline — changes persist to Planner data | Must |
| TD-003 | Display all active trackers with today's log status | Must |
| TD-004 | Allow toggling boolean trackers and entering numeric values inline — changes persist to Tracker data | Must |
| TD-005 | Display a preview snippet of today's journal entry (first ~100 characters or 3 lines) | Must |
| TD-006 | Journal preview links to the Journal tab ("Open in Journal →") | Must |
| TD-007 | Display a streak summary banner showing all currently active streaks and their counts | Should |
| TD-008 | If no data exists for today (no tasks, no tracker logs, no journal), show a soft empty state: *"Empty tab. Start planning?"* with a subtle prompt | Must |
| TD-009 | Sections are arranged vertically: Streak Banner → Tasks → Trackers → Journal Preview | Should |

#### 6.2.2 Address Bar

- Route: `parth://today/aug-16` (auto-formatted current date)

---

### 6.3 Journal Tab (📓)

A daily entry editor with lightweight formatting, mood selection, and tags.

#### 6.3.1 Functional Requirements

| Req ID | Requirement | Priority |
|---|---|---|
| JN-001 | One journal entry per day — creating a new entry on a day that already has one opens the existing entry for editing | Must |
| JN-002 | Rich text editor supporting: **bold**, *italic*, headings (H1–H3), unordered lists, ordered lists | Must |
| JN-003 | Editor built with `contentEditable` and a minimal floating or fixed toolbar | Must |
| JN-004 | Toolbar buttons: Bold, Italic, Heading, Unordered List, Ordered List | Must |
| JN-005 | No support for images, tables, embeds, or code blocks in v1 | Must |
| JN-006 | **Auto-save**: entry saves automatically after 500ms of inactivity (debounced) | Must |
| JN-007 | Visual save indicator — subtle text like "Saved" or a checkmark that appears briefly after auto-save | Should |
| JN-008 | **Mood picker**: optional single-select from a fixed set of 5 moods: 😊 😐 😔 🔥 😴 | Must |
| JN-009 | Mood appears as selectable emoji buttons above or beside the editor | Should |
| JN-010 | **Tags**: freeform, comma-separated input field below the editor | Must |
| JN-011 | Tags are stored as an array of trimmed lowercase strings | Must |
| JN-012 | **Date navigation**: ability to navigate to previous/next day's entry | Must |
| JN-013 | If no entry exists for the selected day, show the editor empty (ready to type) | Must |

#### 6.3.2 Address Bar

- Route: `parth://journal/aug-16` (reflects the currently viewed date)

---

### 6.4 Planner Tab (🗓)

An ordered task list for planning the day. Not a time-block grid.

#### 6.4.1 Functional Requirements

| Req ID | Requirement | Priority |
|---|---|---|
| PL-001 | Display tasks for the selected day as an ordered vertical list | Must |
| PL-002 | Each task has: title (required), time label (optional, e.g. "9:00 AM"), priority (low / medium / high), completion status (done / not done) | Must |
| PL-003 | **Quick add**: input field at the top of the list. Pressing Enter creates a new task at the bottom of the list | Must |
| PL-004 | **Inline editing**: clicking a task title allows editing it in place | Must |
| PL-005 | **Completion toggle**: checkbox to mark a task done. Completed tasks show strikethrough text and reduced opacity | Must |
| PL-006 | **Priority indicator**: visual badge or color accent for low (default/none), medium (amber), high (red) | Must |
| PL-007 | **Drag-to-reorder**: tasks can be reordered by dragging | Should |
| PL-008 | **Delete task**: each task has a delete action (icon or swipe) | Must |
| PL-009 | **Day picker**: navigate between days to plan ahead or review past plans | Must |
| PL-010 | Past days' tasks are viewable but still editable (no locking) | Should |
| PL-011 | Task count summary shown at the top: "3 of 7 done" | Should |
| PL-012 | Time label is a free-text input (not a time picker) — user types "9am" or "afternoon" | Must |

#### 6.4.2 Address Bar

- Route: `parth://planner/aug-16` (reflects the currently viewed date)

---

### 6.5 Tracker Tab (📊)

Custom recurring trackers with daily logging, streaks, and visualization.

#### 6.5.1 Functional Requirements

| Req ID | Requirement | Priority |
|---|---|---|
| TR-001 | **Create tracker**: user provides a name, type (boolean or number), and optional unit label (e.g., "glasses", "hours") | Must |
| TR-002 | Display all trackers in a list/grid on the main Tracker view | Must |
| TR-003 | **Boolean tracker logging**: single toggle button (logged / not logged) for today | Must |
| TR-004 | **Numeric tracker logging**: number input field for today's value | Must |
| TR-005 | **Streak calculation**: for boolean trackers, calculate consecutive days logged (including today) | Must |
| TR-006 | Display current streak count next to each boolean tracker | Must |
| TR-007 | **Streak forgiveness**: if the user has a gap in usage (didn't open the app), streaks freeze — they don't reset. Only an explicit "not logged" day (opened app, didn't log) breaks a streak. | Must |
| TR-008 | **Heatmap visualization**: GitHub-style contribution grid per tracker. Boolean = on/off cells. Numeric = intensity-shaded cells based on value. | Should |
| TR-009 | Heatmap shows the last 12 weeks (84 days) by default | Should |
| TR-010 | **Edit tracker**: rename or change unit label | Should |
| TR-011 | **Delete tracker**: with confirmation. Deletes the tracker and all its log data. | Must |
| TR-012 | **Empty state**: if no trackers exist, show a prompt: "No trackers yet. Create one to start." | Must |

#### 6.5.2 Address Bar

- Route: `parth://tracker`

---

### 6.6 History Tab (🕰)

Browse past days like browsing history. Calendar-based navigation with aggregated day views.

#### 6.6.1 Functional Requirements

| Req ID | Requirement | Priority |
|---|---|---|
| HI-001 | **Calendar view**: display a month grid for the selected month | Must |
| HI-002 | **Month navigation**: arrows or buttons to move to previous/next months | Must |
| HI-003 | Days with data (any of: journal entry, tasks, tracker logs) are visually highlighted | Must |
| HI-004 | **Color-coded dots** on calendar days: journal (blue dot), planner (amber dot), tracker (green dot) — showing which modules have data for that day | Should |
| HI-005 | Empty days are visually dim / muted | Must |
| HI-006 | **Day detail view**: clicking a day opens a read-only composite view of that day's Journal + Planner + Tracker data | Must |
| HI-007 | Day detail shows: journal entry (full text), task list (with completion status), tracker log values | Must |
| HI-008 | Day detail has a "Back to calendar" action | Must |
| HI-009 | From day detail, user can click through to the respective tab for that date (e.g., "Edit in Journal →") | Should |
| HI-010 | Today's date is visually marked on the calendar (border or highlight) | Must |
| HI-011 | The calendar defaults to the current month on first open | Must |

#### 6.6.2 Address Bar

- Route: `parth://history/aug-2026` (month view) or `parth://history/aug-14` (day detail)

---

### 6.7 Signature Browser Touches

These features add character and personality. They are polish — built after all tabs are functional.

#### 6.7.1 Boot Sequence

| Req ID | Requirement | Priority |
|---|---|---|
| BT-001 | On first load of a browser session, display a full-screen dark boot sequence before showing the app | Must |
| BT-002 | Boot text appears line by line in monospace font (JetBrains Mono), simulating a system loading | Must |
| BT-003 | Boot lines: `Loading yesterday...` → `Checking streaks...  3 active` → `Scanning journal...  last entry: Aug 15` → `Ready.` | Must |
| BT-004 | Dynamic data in boot lines: actual streak count, actual last journal date | Should |
| BT-005 | Total boot animation duration: ~2 seconds | Must |
| BT-006 | After boot completes, fade/transition into the Today tab | Must |
| BT-007 | Boot sequence plays only once per browser session (use `sessionStorage` flag to track) | Must |
| BT-008 | If the app is already open in another tab, skip the boot sequence | Should |

#### 6.7.2 Stale Tabs

| Req ID | Requirement | Priority |
|---|---|---|
| ST-001 | A tab whose underlying data is empty for today receives a "stale" visual treatment | Must |
| ST-002 | Stale treatment: reduced opacity (0.5–0.6), subtle desaturation or frost overlay on the tab label/icon | Must |
| ST-003 | Stale detection per tab: Journal (no entry today), Planner (no tasks today), Tracker (no logs today) | Must |
| ST-004 | History tab is never stale (it's retrospective by nature) | Must |
| ST-005 | Today tab is stale only if all other tabs are stale | Should |
| ST-006 | Stale treatment is a nudge, not punishment — no red indicators, no warning icons | Must |

#### 6.7.3 Restore Session

| Req ID | Requirement | Priority |
|---|---|---|
| RS-001 | On app load, check `meta.lastVisit` date | Must |
| RS-002 | If the gap between last visit and today is > 2 days, show a "Restore session?" modal | Must |
| RS-003 | Modal styled like a browser "Restore tabs?" dialog | Must |
| RS-004 | Two options: **"Restore"** (navigates to History tab showing the last active day) and **"Start fresh"** (navigates to Today tab) | Must |
| RS-005 | If gap ≤ 2 days, skip the modal and load normally | Must |
| RS-006 | Restore session modal appears after the boot sequence (if both trigger) | Must |
| RS-007 | Streaks freeze during absence gaps — they do not reset | Must |

---

## 7. Data Model

All data is stored in `localStorage` via the `DataStore` abstraction layer.

### 7.1 Storage Schema

```
Key Pattern                                    → Value Shape
───────────────────────────────────────────────────────────────────

parth:journal:{YYYY-MM-DD}                     → {
                                                    content: string (HTML),
                                                    mood: string | null,
                                                    tags: string[],
                                                    updatedAt: ISO timestamp
                                                  }

parth:planner:{YYYY-MM-DD}                     → {
                                                    tasks: [{
                                                      id: string (uuid),
                                                      title: string,
                                                      time: string | null,
                                                      priority: "low" | "medium" | "high",
                                                      done: boolean,
                                                      order: number
                                                    }]
                                                  }

parth:trackers                                 → [{
                                                    id: string (uuid),
                                                    name: string,
                                                    type: "boolean" | "number",
                                                    unit: string | null,
                                                    createdAt: ISO timestamp
                                                  }]

parth:tracker-log:{tracker-id}:{YYYY-MM-DD}    → {
                                                    value: boolean | number,
                                                    loggedAt: ISO timestamp
                                                  }

parth:meta                                     → {
                                                    lastVisit: YYYY-MM-DD,
                                                    firstUse: YYYY-MM-DD
                                                  }
```

### 7.2 DataStore Interface

```javascript
// Abstract interface — all tabs call these methods, never localStorage directly.

DataStore.journal.get(date)           → entry | null
DataStore.journal.save(date, entry)   → void

DataStore.planner.get(date)           → { tasks: [] }
DataStore.planner.save(date, data)    → void

DataStore.tracker.list()              → tracker[]
DataStore.tracker.create(tracker)     → tracker
DataStore.tracker.update(id, data)    → void
DataStore.tracker.delete(id)          → void
DataStore.tracker.log(id, date, val)  → void
DataStore.tracker.getLog(id, date)    → logEntry | null
DataStore.tracker.getLogs(id, range)  → logEntry[]

DataStore.meta.get()                  → metaObject
DataStore.meta.update(data)           → void
```

### 7.3 Migration Path

When moving to Supabase (future):
1. Create a `supabaseStore.js` implementing the same `DataStore` interface.
2. Map localStorage keys to Supabase tables:
   - `parth:journal:*` → `journal_entries` table
   - `parth:planner:*` → `tasks` table
   - `parth:trackers` → `trackers` table
   - `parth:tracker-log:*` → `tracker_logs` table
   - `parth:meta` → `user_meta` table
3. Swap the import in `DataStore.js` from `localStorage.js` to `supabaseStore.js`.
4. Write a one-time migration script to export localStorage data to Supabase.

---

## 8. Design System

### 8.1 Color Palette

| Token | Value | Usage |
|---|---|---|
| `--bg-primary` | `hsl(220, 15%, 8%)` | Page background, deepest layer |
| `--bg-secondary` | `hsl(220, 14%, 12%)` | Panels, content area background |
| `--bg-tab` | `hsl(220, 14%, 15%)` | Inactive tab background |
| `--bg-tab-active` | `hsl(220, 14%, 18%)` | Active tab background (matches content area) |
| `--surface` | `hsl(220, 12%, 16%)` | Inputs, wells, inset areas |
| `--text-primary` | `hsl(220, 10%, 88%)` | Main body text |
| `--text-secondary` | `hsl(220, 8%, 55%)` | Labels, secondary info |
| `--text-muted` | `hsl(220, 6%, 35%)` | Placeholders, hints, disabled text |
| `--accent` | `hsl(45, 90%, 60%)` | Warm amber — streaks, active states, highlights |
| `--accent-dim` | `hsl(45, 50%, 30%)` | Subdued accent for backgrounds |
| `--success` | `hsl(145, 60%, 45%)` | Task complete, tracker logged |
| `--danger` | `hsl(0, 65%, 55%)` | Delete actions, destructive confirmations |

### 8.2 Typography

| Token | Value | Usage |
|---|---|---|
| `--font-body` | `'Inter', system-ui, sans-serif` | All body text, UI labels, headings |
| `--font-mono` | `'JetBrains Mono', 'Fira Code', monospace` | Address bar, boot sequence, code-like elements |
| `--text-xs` | `0.75rem` (12px) | Muted labels, timestamps |
| `--text-sm` | `0.875rem` (14px) | Secondary text, meta info |
| `--text-base` | `1rem` (16px) | Body text |
| `--text-lg` | `1.25rem` (20px) | Section headers |
| `--text-xl` | `1.5rem` (24px) | Tab content titles |

### 8.3 Spacing

| Token | Value |
|---|---|
| `--space-xs` | `4px` |
| `--space-sm` | `8px` |
| `--space-md` | `16px` |
| `--space-lg` | `24px` |
| `--space-xl` | `32px` |
| `--space-2xl` | `48px` |

### 8.4 Border Radius

| Token | Value | Usage |
|---|---|---|
| `--radius-sm` | `4px` | Buttons, inputs |
| `--radius-md` | `8px` | Cards, panels |
| `--radius-lg` | `12px` | Modals, larger containers |
| `--radius-tab` | `8px 8px 0 0` | Tab tops (rounded top, flat bottom) |

### 8.5 Interaction & Motion

| Element | Behavior |
|---|---|
| Tab switch | Instant — no transition on content, subtle background transition on tab |
| Task completion | Strikethrough animates across text (~200ms), opacity fades to 0.5 |
| Tracker toggle | Scale bump (1.0 → 1.1 → 1.0) on toggle, ~150ms |
| Auto-save indicator | "Saved" text fades in and out over ~1.5s |
| Boot sequence lines | Each line fades in sequentially with ~300ms delay |
| Hover states | All interactive elements have a visible hover state (background shift or opacity change) |
| Focus states | Visible focus ring for keyboard accessibility |

---

## 9. Non-Functional Requirements

### 9.1 Performance

| Req ID | Requirement |
|---|---|
| NF-001 | App loads in under 1 second on a modern desktop browser |
| NF-002 | Tab switching is instantaneous (< 50ms) |
| NF-003 | Auto-save completes in < 100ms |
| NF-004 | No layout shift during tab transitions |
| NF-005 | localStorage operations are non-blocking (data sizes are small) |

### 9.2 Browser Compatibility

| Req ID | Requirement |
|---|---|
| NF-006 | Fully functional in latest Chrome, Firefox, Edge, Safari |
| NF-007 | Graceful degradation if localStorage is full (show warning, don't crash) |

### 9.3 Responsiveness

| Req ID | Requirement |
|---|---|
| NF-008 | App is usable at viewport widths ≥ 768px (tablet and desktop) |
| NF-009 | Below 768px, tab labels collapse to emoji-only |
| NF-010 | Content area is scrollable; tab bar and address bar are sticky |

### 9.4 Accessibility

| Req ID | Requirement |
|---|---|
| NF-011 | All interactive elements are keyboard-navigable |
| NF-012 | Tab bar supports arrow-key navigation |
| NF-013 | Color contrast meets WCAG AA for text on dark backgrounds |
| NF-014 | Focus indicators are visible on all focusable elements |

### 9.5 Data Safety

| Req ID | Requirement |
|---|---|
| NF-015 | No data is sent to any external server |
| NF-016 | Data persists across browser refreshes and restarts |
| NF-017 | Clearing browser data / localStorage is the only way to lose data (user responsibility for v1) |

---

## 10. Build Phases & Milestones

| Phase | Deliverable | Depends On | Est. Effort |
|---|---|---|---|
| **Phase 0: Scaffold** | Vite + React project, CSS design tokens, `DataStore` abstraction, folder structure, Google Fonts loaded | — | Small |
| **Phase 1: Browser Shell** | Tab bar, address bar, window controls, tab routing. The frame everything plugs into. | Phase 0 | Medium |
| **Phase 2: Journal Tab** | Daily entry editor, mood picker, tags, auto-save, date navigation | Phase 1 | Medium |
| **Phase 3: Planner Tab** | Task list, quick add, inline edit, completion toggle, priority, drag reorder, day picker | Phase 1 | Medium |
| **Phase 4: Tracker Tab** | Create/edit/delete trackers, daily logging (boolean + numeric), streak calculation, heatmap visualization | Phase 1 | Medium–Large |
| **Phase 5: History Tab** | Calendar month view, day detail composite, color-coded day indicators, month navigation | Phases 2–4 | Medium |
| **Phase 6: Today Tab** | Interactive composite — inline task check, tracker toggle, journal preview, streak banner | Phases 2–4 | Medium |
| **Phase 7: Polish** | Boot sequence, stale tab indicators, restore session modal, micro-interactions, transitions | Phases 1–6 | Medium |

### Build Order Rationale

1. **Shell first** — every tab plugs into the same frame. Build it once.
2. **Journal → Planner → Tracker** — independent vertical slices, each fully usable on its own.
3. **History** — depends on data from all three content tabs.
4. **Today** — depends on all tabs since it aggregates and interacts with their data.
5. **Polish** — the signature browser touches are layered on last, after all functionality works.

> The app is **usable after Phase 2** (you can journal daily). Each subsequent phase adds a new capability.

---

## 11. Future Scope (Parked)

These ideas have been explicitly deferred. They are not in scope for v1 and should not influence v1 architecture decisions — except where noted.

| Feature | Notes |
|---|---|
| **Command bar / quick-capture** | `log: gym done` style input. Address bar could become this. |
| **Incognito mode** | Private journal entries, visually distinct. |
| **Bookmarks tab** | Save/pin specific past days. |
| **Extensions system** | Unlockable tracker types, custom modules. |
| **Task Manager view** | View tasks as "running processes" — geeky, fun. |
| **Terminal tab** | CLI-style input for power users. |
| **Desktop widgets** | Draggable widgets on a desktop-like canvas. |
| **AI features** | Summarization, journaling prompts, mood analysis. |
| **Native app** | Desktop/mobile. DataStore abstraction makes this feasible. |
| **Supabase migration** | Cloud sync, multi-device. DataStore abstraction makes this a one-file swap. |
| **Data export** | JSON export of all data for backup. |

---

## 12. Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| **localStorage data loss** (user clears browser data) | High — all data gone | Medium | v1 accepts this risk. Future: add JSON export feature, then Supabase sync. |
| **localStorage quota exceeded** (~5–10MB) | Medium — can't save new entries | Low (text data is small) | Monitor usage, show warning at 80% capacity. |
| **`contentEditable` inconsistencies** across browsers | Medium — formatting bugs | Medium | Keep formatting minimal (bold, italic, lists only). Test across Chrome, Firefox, Safari. |
| **Drag-and-drop complexity** | Low — planner reorder breaks | Medium | Use a proven lightweight library (e.g., `@dnd-kit/core`). If too complex, ship without drag and add later. |
| **Scope creep** | High — v1 never ships | High | This PRD is the scope. If it's not in this document, it's parked. |

---

## 13. Guardrails

1. **Shell first** — the browser frame is built once. Don't rebuild navigation logic per tab.
2. **Vertical slices** — each tab ships as a complete, working feature before moving to the next.
3. **Polish last** — signature touches (boot, stale, restore) come after all core functionality works.
4. **Data abstraction** — no component directly calls `localStorage`. All access goes through `DataStore`.
5. **No scope creep** — if it's not in this PRD, it's parked. Period.
6. **Minimal dependencies** — prefer vanilla CSS over frameworks, native browser APIs over libraries. Add a dependency only when building it from scratch would take disproportionately longer.
7. **Ship and iterate** — a working v1 with rough edges beats a polished v1 that never ships.

---

*End of PRD — PARTH v1*
