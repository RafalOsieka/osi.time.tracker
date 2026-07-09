## Context

Stories 1–5 delivered the live timer, the topbar timer widget (`REQ-NFR-026`), and the timer view page (`REQ-TTR-046`) with day/task grouping. Entries are created only by starting a timer (`POST /api/time-entries` sets `startedAt = now`), and `PATCH /api/time-entries/[id]` edits only `stoppedAt`/`title`/`projectId`. Expanded group rows are explicitly read-only, and there is no delete endpoint. Story 6 completes the entry lifecycle: manual creation, editing start/stop/title per entry, deletion with task garbage collection, and (agreed extension) editing the running entry's start date/time from the topbar widget.

Existing building blocks to reuse:

- Title→task resolution (`REQ-TTR-038`) already handles retitle-splits server-side; no new task logic needed for retitle.
- `useTimer` composable holds the shared running-entry state; the elapsed ticker derives from `running.startedAt`.
- `shared/types/time-entry.ts` zod schemas define the boundary contract; `mapZodError` maps failures to `{ messageKey, params }`.
- Timer view components (day sections, group rows, `TimerTaskEditorDialog`, task autocomplete) provide the UI patterns.

## Goals / Non-Goals

**Goals:**

- Manual entry creation from each day section ("+ add entry", start/end hour+minutes, optional title with autocomplete).
- Editable `startedAt` on `PATCH /api/time-entries/[id]` with validation (`startedAt ≤ stoppedAt`; for running entries `startedAt ≤ now`).
- Inline per-entry editing (start time, stop time, title) in expanded group rows.
- `DELETE /api/time-entries/[id]` with hard-delete garbage collection of a task whose last entry is removed.
- Topbar popover (click elapsed time) to edit the running entry's start date + time; no future starts.

**Non-Goals:**

- Duration-based input mode; overlap prevention; bulk edit/delete; changes to reporting or remote-tracker features.

## Decisions

### 1. Extend `POST /api/time-entries` for manual creation (vs. a new endpoint)

The start schema gains an optional `startedAt`/`stoppedAt` pair (both ISO datetime strings, both required together, `startedAt ≤ stoppedAt`, `startedAt ≤ now`). When present, the endpoint creates an already-stopped entry and skips stop-on-new-start (nothing is running about it). Alternative — a dedicated `POST /api/time-entries/manual` — was rejected: same resource, same title-resolution transaction, and the branch is a small validation refinement; one endpoint keeps the DTO surface minimal.

### 2. Add `startedAt` to `updateTimeEntrySchema` (single PATCH for all edits)

All edit surfaces (inline rows, topbar popover) ride the existing `PATCH /api/time-entries/[id]`. Validation is applied against the entry's *effective* post-patch state: `startedAt ≤ stoppedAt` when stopped (using the incoming or stored value of each), `startedAt ≤ now` when running. Overlap with other entries is explicitly allowed (no overlap constraint exists in the model today). Alternative — a separate "running-entry" endpoint for the topbar — rejected as needless duplication.

### 3. New `DELETE /api/time-entries/[id]` with in-transaction task GC

Delete and GC run in one transaction: delete the entry, then if `taskId` was non-null and no other entry references the task, hard-delete the task. This mirrors story 5's "emptied Tasks are hard-deleted" merge behavior. Alternative — soft-delete of entries — rejected: entries have no `deletedAt` column and the vision has no undo requirement; keeping hard delete matches the task GC semantics already in place. Foreign/unknown ids resolve to 404 without confirming existence (consistent with PATCH).

### 4. Inline row editing (vs. per-entry dialog)

Expanded rows switch from read-only text to an inline edit pattern: time cells become hour+minute inputs (PrimeVue `DatePicker` with `timeOnly`, or `InputMask`-style equivalents), the title cell reuses the task autocomplete used by the widget/bulk-assign. Commit on blur/Enter, Escape cancels — consistent with the widget's inline title edit. A dialog per entry was considered (consistent with `TimerTaskEditorDialog`) but rejected per user preference and because 2–3 small fields fit inline. Cross-midnight `startedAt` edits regroup the entry client-side after the PATCH response (refetch/regroup the affected window).

### 5. Manual-entry form placement

Each day section header gets a "+ add entry" control opening a small dialog (or inline form row) with: title autocomplete (optional), start time, end time — times interpreted in the day's local date, converted to UTC instants for the POST. Times only (no date field): the day section fixes the date. End time earlier than start time is a validation error client-side (no implicit next-day rollover in MVP).

### 6. Topbar start edit popover

The elapsed-time display becomes a button; clicking opens a PrimeVue `Popover` containing a date field and a single hour+minutes input, seeded with the running entry's current start (browser-local). Commit PATCHes `startedAt`; on success `useTimer` replaces `running` with the response and the ticker rebases automatically (it derives from `running.startedAt`). Client-side and server-side both reject a resulting future instant. Past dates are allowed, so elapsed can legitimately exceed 24 h.

## Risks / Trade-offs

- [Timezone pitfalls: manual times and popover date are local, storage is UTC] → All conversions happen client-side (local wall time → ISO instant); server stays timezone-agnostic like `REQ-TTR-044`.
- [Task GC deletes a task the user still wanted] → GC only fires when the *last* entry disappears, matching story 5 semantics; delete requires an explicit confirm step.
- [`startedAt ≤ now` check races with clock skew] → Server allows a small tolerance (e.g. ≤ 60 s) when comparing against server time to absorb client/server clock drift.
- [Inline editing bloats the timer-view component] → Extract a per-entry row component; group header editor pattern already exists to follow.
- [Regrouping after cross-midnight edit surprises the user] → Accepted behavior (agreed); the entry simply appears under the other day after refresh.

## Migration Plan

No schema migration: `startedAt`/`stoppedAt` columns already exist and durations are derived. Purely additive API/UI change; deploy normally.

## Open Questions

None — UX decisions (inline editing, times-only manual form, popover with date field, overlap allowed) were confirmed during exploration.
