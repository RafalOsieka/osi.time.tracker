# Design

## Context

See proposal.md for the motivation and specs for the behaviour (REQ-371–REQ-377, REQ-180).

Current state:

- `AppTimer.vue` and `TimerAddEntryDialog.vue` both drive a `UInputMenu` in autocomplete mode with a **string model** (`value-key="name"`). They build items through `buildTaskTitleMenuItems` (`app/utils/task-title-menu.ts`), and each item's `onSelect` captures identity before the model update lands.
- `useTimer().start(title, projectId, taskId)` and `updateTitle(title, taskId)` already exist. `POST`/`PATCH /api/time-entries` accept `projectId`, and `PATCH` treats an absent `projectId` as "keep" and an explicit `null` as "project-less" (REQ-143). `TimeEntryDto` carries `projectId`/`projectName`.
- `GET /api/tasks` already filters by `projectId`.
- The add-entry dialog currently posts only `title`. A picked suggestion is not bound by identity and always resolves project-less.
- `GET /api/projects` returns every non-deleted project ordered by name, with no usage data.

## Goals / Non-Goals

**Goals:**
- Keep one pure, unit-testable module for all mention logic, shared by both surfaces.
- Reuse the existing overlay, string-model menu items and commit paths. No new popup machinery.
- Keep server work to one additive aggregate.

**Non-Goals:**
- Generic mention infrastructure for other entities.
- Server-side project search.

## Decisions

### D1. One overlay, two modes (instead of a caret-anchored tooltip)
The title overlay's items switch between task mode and project mode, based on whether the caret sits in a mention token that has at least one match.
- *Alternative:* a separate popover anchored at the `@` caret position. Rejected. An `<input>` can't report the caret's on-screen position without a mirror-element measurement. A second listbox would compete with `UInputMenu` for arrow keys and Enter, and one input would own two listboxes, which isn't valid combobox behaviour.

### D2. Pure mention module: `app/utils/title-mention.ts`
It exports typed functions with no Vue dependency:
- `normalizeMentionText(s)`: lowercase, `NFD` with combining marks stripped, an explicit `ł→l` map (NFD does not decompose `ł`), and whitespace/`-`/`_` removed.
- `findMentionAtCaret(text, caret)`: returns `{ start, query }` or `null`. Applies the start-or-whitespace trigger rule.
- `rankMentionProjects(projects, query, limit = 5)`: match tier, then `recentTrackedSeconds`, then name.
- `resolveTypedMention(text, projects)`: returns `{ title, project }` using the last token and the longest exact word-prefix (REQ-375).
- `removeMention(text, start, end)`: removes the token and collapses whitespace.

The create row preview and the commit path both call `resolveTypedMention`, so the label always matches what will be sent.

### D3. Project-mode items reuse the string model
A project item's `name` (the model value) is the **input text with the token removed**, so `UInputMenu`'s model update writes the stripped text through the existing `onTitleModelUpdate` free-form path. The item's `onSelect` sets the chip first. `buildTaskTitleMenuItems` gains an optional `mention` input (`{ projects, textWithoutToken, onSelectProject }`). When it's present, it returns a labelled project group instead of the create row and suggestions. Both components keep one builder call.

### D4. Client-side filtering over a cached project list
The `useMentionProjects()` composable loads `GET /api/projects` on input focus (top bar) or dialog open, and keeps the last successful list. Matching and ranking happen locally, with no debounce or stale-response guard, unlike tasks (REQ-360).
- *Alternative:* a server search endpoint per keystroke. Rejected because project counts are in the tens, so a round trip adds latency and complexity with no benefit.

### D5. `recentTrackedSeconds` on `ProjectDto` (instead of a new endpoint)
`index.get.ts` left-joins one grouped subquery: `time_entries ⋈ tasks` filtered by `userId` and `startedAt >= now() - interval '30 days'`, summing `extract(epoch from coalesce(stoppedAt, now()) - startedAt)` and grouped by `tasks.projectId`. That's one statement, served by the `time_entries (userId, startedAt)` index.
- *Alternative:* `GET /api/projects/recent`. Rejected because it's a second contract for the same list, and the client would have to merge two responses. The Projects page pays for a small aggregate it doesn't display. That's acceptable at this scale.

### D6. Typed mentions resolve only on exact normalized equality
- *Alternative:* resolve to the top-ranked match. Rejected because a silent wrong project bills time to the wrong client.
- *Alternative:* stored slugs. Rejected because of uniqueness, rename and migration costs. Normalized names give the same predictability with no state.

### D7. Chip state and commits
Each component holds `chipProject: { id, name } | null`.
- **Top bar:** `start(title, chip?.id ?? null, selectedTaskId)`. While running, a watch on `running` seeds the chip from `projectId`/`projectName`. Picking a project or removing the chip calls a `useTimer` update that sends `{ title, projectId }` with an explicit value. `updateTitle` gains an optional `projectId` argument, passed explicitly from the chip so retitles are deterministic.
- **Dialog:** tracks `selectedTask` like the top bar. On save it sends `{ taskId }` when the text still equals the picked name, otherwise `{ title, projectId }`.
- **Empty title with a chip:** starts untitled and clears the chip.
  - *Alternative:* block Start. Rejected because quick start must never be blocked.

### D8. Caret access
The `UInputMenu` template ref exposes its input element. The caret is read from `selectionStart` on `searchTerm` updates and on `keyup`/`click`, so arrowing back into a token re-enters project mode.

## Risks / Trade-offs

- [`UInputMenu` internals change (input ref, group items)] → Covered by Nuxt component tests on both surfaces and a UI e2e journey.
- [A user wants a literal `@Helios` in a title, which resolves typed] → Rare. Removing the chip after start/save re-homes the entry. Documented in REQ-375 as exact-only.
- [The chip for an untitled running entry isn't persisted] → It's lost on reload. Accepted because the data model cannot hold it (non-goal).
- [Duplicate project names across trackers] → The list shows the tracker name. Typed resolution treats them as ambiguous and keeps the text literal.
- [Aggregate cost on large histories] → The aggregate is bounded to 30 days by an indexed range. If it shows up in profiles, it can be restricted to callers that ask for it via a query flag.

## Migration Plan

No schema change. The field is additive to `ProjectDto`. Ship frontend and backend together. Rolling back means reverting the change.
