## Why

The Remote Sync page renders every task fully expanded in one flat list: a ten-task day is a wall of checkboxes, selects and log lists with no way to scan what will actually be pushed. It also shows a single "day total", so the user cannot see how much time will really leave the machine after rounding and manual adjustments, remote-log comments are fetched but never displayed, and switching days means going back to the Timer view.

## What Changes

- Replace the flat list with a dense expandable table: one summary line per task (selection, name, issue, activity, tracked → to send, state) and the entries, export duration, and remote logs inside the expanded row.
- Add day navigation on the page itself — previous/next day plus a free calendar jump — instead of routing through the Timer view.
- Show **three** day-level summaries side by side: **day total** (all time tracked that day), **tracked** (the selected entries behind the export), and **to send** (what will actually be pushed after rounding and overrides), with the tracked → to-send delta and badges for blocked, excluded and untitled time.
- Render each task's tracked → to-send pair with its own delta hint. Day-level totals appear once above the table (not repeated in a footer).
- Convey row state as an icon **plus** text badge, and group the day's rows so blocked rows are visually separated from ready ones.
- Display the comment of every fetched remote log next to its duration and activity.
- Warn (never block) when a linked issue already has a remote log for that day with the same duration — a possible duplicate.
- Add bulk selection: select/deselect all entries of a task, and select/deselect all exportable tasks of the day.
- Keep every existing `data-testid` stable so current tests keep addressing the same rows, states and fields.

## Non-goals

- Multi-day or weekly export (REQ-111 keeps the page single-day).
- The export review/progress/report modal, per-task retry, and the editable export comment — those are `remote-sync-export-review`.
- New rounding rules — those are `remote-rounding-nearest-rules`.
- Mutating or deleting remote logs; they stay informational (REQ-118).
- A "days with entries" endpoint; the calendar allows jumping to any date.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `remote-sync-review`: adds the table layout with expandable rows, on-page day navigation, the three day summaries with per-row deltas, remote-log comments, duplicate warnings and bulk selection; extends the accessibility and testability requirement to cover the new controls.

## Impact

- `app/pages/sync/[date].vue` — rewritten as an expandable `UTable` with page-header day totals (no table footer).
- New presentational components under `app/components/sync/` for the row body and the summary header.
- `app/composables/useRemoteDayLogs.ts` — expose the already-parsed `comment`; derive duplicate candidates.
- New pure helpers in `shared/utils/` for the three day totals and duplicate detection (unit-testable).
- `i18n/locales/en.json` / `pl.json` — new keys for summaries, deltas, log comments, duplicate warning, bulk actions, day navigation.
- No server or database change: `GET /api/sync/day` and `RemoteDayLogDto` already carry everything needed.
