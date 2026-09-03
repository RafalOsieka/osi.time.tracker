## Context

See `proposal.md` for motivation. The Remote Sync day page is a large orchestrator (`sync/[date].vue` + `SyncRowDetail.vue`) on `UTable` with include checkboxes, per-entry selection, a State column, and a detail pane that duplicates editors. The timer group header already has the two-line compact grid we want. Finalize (`POST /api/sync/export`) already accepts `entryIds`; adapters still only create logs.

## Goals / Non-Goals

**Goals:**

- One compact expandable-row shell and one ghost inline-edit control shared by timer groups and Remote Sync rows.
- Client-side export set: Ready = linked + activities + no provenance for that task/date; Export sends all of that task's day entry ids.
- Details as two informational panes; reserved empty actions slot.

**Non-Goals:**

- New endpoints, adapter DELETE, or provenance schema changes.
- Extracting timer *entry* rows into the shell.
- A generic period-navigation or table-header redesign.

## Decisions

### Shared shell with named slots, not a domain row

Extract a presentational shell whose regions are expansion, title, secondary, meta, duration, actions, and detail. Timer fills secondary=project, meta=issue, duration=one total, actions=play/stop. Remote Sync fills secondary=issue, meta=activity, duration=tracked → to-send with delta on a tooltip, actions=empty. Domain logic stays in `TimerTaskGroup` and a new `SyncDayRow`.

**Alternative considered:** one `TaskDayRow` that takes a mode prop. Timer and sync do not share enough middle content; the prop API would be larger than two call sites.

### Ghost inline-edit as a second shared control

Lift the none/ghost `UInput` + overflow tooltip + Enter/Escape/blur commit used by `TimerTaskGroup` and `TimerEntryRow` into a shared control. Remote Sync title-to-send uses it. To-send duration uses the same compact time slot as entry start/stop (`TimeInput` when editing). Project and activity stay a button+popover (REQ-178).

**Alternative considered:** keep copy-pasted inputs per page. That is what we already have and it is why the sync duration editor does not match the timer.

### Sent = any `exports.length > 0` for the task/date

Ignore leftover unexported entries on that row. `isPushable` requires Ready and no provenance. Finalize still receives every completed entry id of that task/day.

**Alternative considered:** export only never-exported entries (rule B). Rejected as more states for an end-of-day flow.

### Drop `UTable` on this page

`UTable` cells are padded and nowrap and cannot do the two-line named-area layout. The page becomes a list of shells. Day summaries stay as chips above the list. `table-expand-map` can be replaced by a plain `Record<string, boolean>` on this page.

**Alternative considered:** one table column containing the grid. Headers would not align; still a table for no benefit.

### Details: CSS two-column grid

`md`/`lg` (shell rail breakpoint) `grid-cols-2`; stacked below. Local entries are read-only lines (start–stop, duration). Remote logs stay the existing fetch. Duplicate warning is `UAlert` spanning the top of the detail region.

**Alternative considered:** `UCard` per pane. Extra chrome on a compact row.

### Actions slot always rendered

Give the actions region a min-width matching an `xs` square icon button. No placeholder icon. Undo is the next change.

### No backend change

Rounding, activity, comment, and finalize stay as they are. Tests that assume include checkboxes, re-export, or per-entry picking change on the client.

## Risks / Trade-offs

- [Timer visual regression while extracting the shell] -> Switch `TimerTaskGroup` onto the shell first; keep existing nuxt density tests green before restyling Remote Sync.
- [Title-to-send looks like renaming the local task] -> Accessible name states it is the comment sent to the tracker; no reassign call on commit.
- [Sent row with extra local time looks “wrong”] -> Duration cluster still shows tracked > to-send; monthly report already flags drift. Undo is the follow-up.
- [Empty actions slot wastes width on mobile] -> Same reserved width the timer already spends on play/stop; keeps the two pages aligned.
- [Export dialog still mentions repeats] -> Strip skip-because-unchecked and repeat-because-reselected copy; keep skip-for-Sent/blocked.

## Migration Plan

Frontend-only. Deploy with the app. Rollback is reverting the Vue/i18n/test files. No data migration. Existing provenance rows become Sent on next load.

## Open Questions

None. Undo target (latest log vs pick from details) is deferred to the next change.
