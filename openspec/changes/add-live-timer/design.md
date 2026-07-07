## Context

The app currently persists `users`, `clients`, `projects`, and `tasks` (Drizzle + PostgreSQL ≥ 18) with CRUD APIs and flat management pages. There is no time-entry storage or timer. `docs/vision.md` settled an **entry-first** model: the primary object a user creates is a `TimeEntry`; a `Task` is derived plumbing whose name is what the user perceives as the entry's "title". The app shell (`app/layouts/default.vue`, `AppTopBar.vue`) already reserves inline and stacked regions rendering `TIMER PLACEHOLDER`.

This change delivers the first vertical slice (user story #4): a server-persisted live timer with entry-first title binding, plus the running indicator in the shell. It deliberately excludes the timer view page, manual/edit/delete entries, task GC, and remote integration (later stories).

Conventions that constrain the design: user scoping on every query, `requireAuth` + CSRF on mutations, `{ messageKey, params }` error contract, boundary types defined once in `shared/types/*` and validated with a single zod schema, i18n `en`/`pl` parity, WCAG 2.1 AA.

## Goals / Non-Goals

**Goals:**

- Start/stop a live timer that survives reloads and device switches (server-persisted).
- At most one running entry per user; starting a new one stops the running one (Toggl).
- Bind an entry to a Task by title, resolving/creating the Task server-side on `(user, name, project)`.
- Allow untitled entries (`taskId = null`).
- Provide a title autocomplete data source and a persistent running indicator in the shell.
- Drop the per-user task `number` now.

**Non-Goals:**

- Timer view page, grouping, "(no task)" bucket, mini task editor, task merge (story 5).
- Manual entries, editing/deleting entries, orphan-task garbage collection (story 6).
- Remote issue refs / push (stories 9–11).

## Decisions

### 1. REST `time-entries` resource (vs. RPC timer endpoints)

A running timer is just a `TimeEntry` with `stoppedAt = null`, so the API is a plain resource that stories 5–6 reuse without a second surface:

- `POST /api/time-entries` — start: stops any running entry, then inserts a new one (`startedAt = now`, `stoppedAt = null`), resolving `title (+ projectId)` → `taskId`. Returns the `TimeEntryDto`.
- `PATCH /api/time-entries/[id]` — stop (set `stoppedAt`) and/or retitle (re-resolve `taskId`).
- `GET /api/time-entries/running` — the current running entry or `null`.

**Alternative considered:** dedicated `POST /api/timer/start|stop`. Rejected: hides entry mechanics but forces a duplicate API once entry CRUD lands in story 6.

### 2. Task match/create server-side, in one transaction (vs. client resolves first)

The entry handler resolves the title to a Task inside a single DB transaction — one source of truth, race-safe. Matching key is `(userId, name, projectId)` where `projectId = NULL` is its own scope. Rules (Toggl-style, per vision):

- Empty/whitespace title → `taskId = null`.
- Title matches an existing task in the given project scope → bind to it.
- No match → create a new Task in that scope and bind.
- Silent match: a project-less title that matches an existing project-less task binds to it.

**Alternative considered:** client calls the tasks API for a `taskId`, then posts the entry. Rejected: splits the invariant across two requests and races.

### 3. Drop `tasks.number` now (vs. defer to story 5)

`number` only made sense for the tasks page, which is being removed later; keeping it would force implicit task creation to invent numbers. This change's migration drops the column and its unique `(userId, number)` index; `TaskDto` and `tasks.vue` lose the number column. This is **BREAKING** for the tasks contract but the data is early-stage.

### 4. Data model

New table `server/db/schema/time-entries.ts`:

```
time_entries:
  id         uuid pk default uuidv7()
  userId     uuid not null  FK -> users.id
  taskId     uuid nullable  FK -> tasks.id
  startedAt  timestamptz not null
  stoppedAt  timestamptz nullable   -- null => running
  createdAt / updatedAt timestamptz
  index (userId)
  partial unique index (userId) WHERE stoppedAt IS NULL   -- one running entry per user
```

`tasks` schema changes (in addition to dropping `number`):

```
  partial unique index (userId, projectId, name) WHERE deletedAt IS NULL
  partial unique index (userId, name) WHERE projectId IS NULL AND deletedAt IS NULL
```

### 5. Boundary types (`shared/types/time-entry.ts`)

- `startTimeEntrySchema` — `{ title?: string | null (trimmed, max 200), projectId?: uuid | null }`.
- `stopTimeEntrySchema` / `updateTimeEntrySchema` — `{ stoppedAt?, title?, projectId? }`.
- `TimeEntryDto` — `{ id, taskId: string | null, taskName: string | null, projectId, projectName, clientName, startedAt: string, stoppedAt: string | null }` (timestamps serialized as strings, never `Date`). Validation failures map via `mapZodError` to `{ messageKey, params }`.

### 6. Autocomplete via `GET /api/tasks?search=`

Extend the existing tasks handler with a `search` query param: case-insensitive name match, returns existing `TaskDto`s (name + project/client context) for the title `AutoComplete`. Reuses the current endpoint rather than adding a suggestions route.

### 7. Shell widget + shared state

`AppTimer.vue` fills the topbar `#timer` slot and the stacked row: a PrimeVue `AutoComplete` for the title, an elapsed-time ticker, and a start/stop button. A `useTimer()` composable holds the running-entry state (fetched on app load, updated on start/stop) so the indicator and widget stay in sync. Custom markup only where no PrimeVue component fits.

## Risks / Trade-offs

- [Adding task matching unique indexes may fail on pre-existing duplicate `(user, name, project)` rows] → The migration includes a dedup step before creating the indexes; risk is low given early-stage data.
- [Dropping `tasks.number` is BREAKING for `TaskDto`/tasks page] → Coordinated in this change: DTO, page, and `task-management` spec delta updated together; documented as breaking in the proposal.
- [Silent-match rules (project-less vs. projected same-name tasks) have subtle edges] → Encoded explicitly as spec scenarios so stories 5–6 don't drift.
- [Race on concurrent starts creating two running entries] → Prevented by the partial unique index plus resolving inside one transaction.

## Migration Plan

1. Generate a Drizzle migration that: dedups conflicting task names, drops `tasks.number` + its unique index, adds the two task matching indexes, and creates `time_entries` with its partial unique index.
2. Apply with `pnpm db:migrate` before serving. Rollback: revert the migration (drop `time_entries`, restore `number`) — acceptable while data is early-stage.

## Open Questions

- None blocking. Merge-on-collision, orphan GC, and the "(no task)" bucket are deferred to stories 5–6 by design.
