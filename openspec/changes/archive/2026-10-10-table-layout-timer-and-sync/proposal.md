# Proposal

## Why

The Timer view and Remote Sync rows each size their own slots, so `#87` versus `#12345`, a state badge or a longer duration shifts the columns after it. Days and expanded entries do not line up. The client PDF report showed that a real column layout works, so both pages should follow it.

## What Changes

- Each page renders one column-aligned list. All its rows, including day headings, entries, remote logs and the untitled row, share the same columns. Column widths depend only on the list width, never on content, edits or load more.
- The first glyph of a cell sits on the column edge, level with the header. Control padding moves into the gap.
- Column headers are always visible and sticky, with table semantics.
- Below 40rem of list width (a container query), rows take two lines, or three for Sync, with durations and actions on a fixed right edge.
- Timer view: one table for all days. The day total sits in the duration column.
- Remote Sync: an icon state column with a reason tooltip, separate tracked and to-send columns, and details as rows under them. An activity error stays compact in its cell, with extension guidance in a full-width row.
- **BREAKING (UI contract):** the seven Remote Sync summaries become two: the day total, and **in tracker after export**. The second is the account's same-day logs on linked issues plus the Ready rows' to-send. It shows no number while logs are loading or after a failure.
- Visual reference: `mockups/timer-and-sync.html`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ui-shared-components`: the expandable-row shell becomes a column-aligned list, and the inline editor aligns its text with the column.
- `tracking-timer-view`: group, entry and day rows on shared columns.
- `remote-sync-review`: state and duration columns, detail rows, narrow layout, and the two summaries.

## Non-goals

- Using the column list on other pages.
- Changing row content, editing or export.
- Fetching logs for issues not linked to the day's tasks.
- A pixel-identical copy of the mockup.

## Impact

- `apps/web/app`: the row shell, the Timer and Sync pages and their row components, `RemoteIssuePicker.vue`, `InlineEditText.vue`.
- `shared/utils/remote-sync-day-totals.ts` and a new in-tracker sum.
- `en`/`pl` catalogs: column headers and the new summaries; the old summary keys are removed.
- Nuxt and e2e specs for both pages, plus geometry assertions.
