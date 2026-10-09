# Tasks

All work is frontend (`apps/web/app`, `apps/web/shared/utils`). There are no backend or API changes. The UI e2e specs (`apps/web/test/e2e/ui`) are the E2E suite for the user flows. The visual reference is `mockups/timer-and-sync.html`.

## 1. Shared column list (frontend)

- [ ] 1.1 Build the column-list primitive per D1, D2, D4 and D5. It needs a typed column definition (`track` as `rem` or `{ fr, min }`, header label, `headerSrOnly`, `align`) and a list container that renders `grid-template-columns`, `role="table"`, a header row (`sticky top-0` behind a `stickyHeader` prop, default `true`) and an `@container/list` wrapper. Row and cell parts use `grid-cols-subgrid` and take `col`/`to` typed as the list's key union. An expandable row keeps `aria-expanded`/`aria-controls`. `CompactExpandableRow.vue` and its spec are replaced. Verify with a Nuxt spec covering:
  - the generated template;
  - `table`/`row`/`columnheader`/`cell` roles;
  - an `sr-only` header;
  - the `stickyHeader` toggle;
  - expansion attributes;
  - an empty action cell that is still rendered.

  Also run `pnpm type-check`, where a wrong `col` key must be a type error.
- [ ] 1.2 Apply text-edge alignment (D3): the `InlineEditText` root gets `-ms-2 w-[calc(100%+0.5rem)]`, and `RemoteIssuePicker` gets `justify-start` on the linked id and `-ms-1` on its icon-only states. Verify with `inline-edit-text.spec.ts` and `remote-issue-picker.spec.ts` (extend them with the edge classes and the unchanged padding in edit mode) and `pnpm test:nuxt`.
- [ ] 1.3 Add a kebab-case e2e helper `test/e2e/ui/layout-geometry.ts` with `boundingBox()` checks:
  - start edges equal within 1px;
  - end edges equal;
  - a snapshot of column widths;
  - no horizontal overflow.

  Verify through its first use in 2.3.

## 2. Timer view (frontend)

- [ ] 2.1 Render `pages/index.vue` as one list with the Timer columns from D2 and the `timerView.columns.*` headers (Task/Project/Issue/Duration, `en`/`pl`). Each day becomes a heading row: an `h2` date inside `rowheader`, the Remote Sync link, and the total in the duration column. The skeleton is row-shaped, and load more and the sentinel stay after the list (REQ-503, D6). Keep `timer-day-*`, `timer-day-total-*` and `timer-day-remote-sync-*`. Verify with `timer-view.spec.ts`, updated to cover one table for all days and the day total in the duration cell, plus `pnpm lint` (i18n parity).
- [ ] 2.2 Rework `TimerTaskGroup.vue` into a group row of cells (REQ-501) and `TimerEntryRow.vue` into a detail row:
  - the title in the title column;
  - the time range ending at the issue column;
  - the duration and delete in their columns (REQ-502);
  - narrow placement per D5 (group: two lines; entry: times, duration and delete, then the title).

  Keep every `timer-group-*` and `timer-entry-*` hook and the live stop control. Verify with `timer-task-group.spec.ts` and `timer-entry-row.spec.ts`, updated without dropping any assertion.
- [ ] 2.3 Extend `timer-view-ui.spec.ts` with geometry checks using `layout-geometry.ts`:
  - the Task, Project and Issue header `x` equals the first content `x`;
  - day, group and entry durations share one end edge;
  - days share column edges;
  - column widths do not change after a title edit, after linking an issue or after load more;
  - the header stays visible after scrolling;
  - at 375px there is no overflow, and a group shows title and duration on its first line.

  Verify with `pnpm test:e2e:ui` (or `pnpm test:e2e:dev`).

## 3. Remote Sync day summaries (frontend logic)

- [ ] 3.1 Reduce `computeRemoteSyncDayTotals` to `{ dayTotal, toSend }` (REQ-508) and update `test/unit/remote-sync-day-totals.spec.ts`. The spec covers untitled, Sent and blocked time inside the day total, and Ready rows sending `0` outside to-send. Verify with `pnpm test:unit`.
- [ ] 3.2 Add the pure `computeInTrackerSummary(logStates, toSendSeconds)` from D8, returning `loading | unavailable | ready`. Verify with a unit spec covering:
  - logs plus to-send;
  - one log shared by two tasks counted once (`trackerId:remoteLogId`);
  - a log not created by an export, included;
  - any loading tracker → `loading`;
  - one failed and one loaded tracker → `unavailable`, with no partial sum;
  - an extension-unavailable error → `retryable: false`;
  - zero to-send lowering the total.

  Run `pnpm test:unit`.
- [ ] 3.3 Replace the seven summary badges in `pages/sync/[date].vue` with two cards (REQ-508, REQ-509, REQ-510):
  - `remote-sync-total-day`;
  - `remote-sync-total-in-tracker`, with its parts and `-loading`/`-unavailable` states, naming each failed tracker and reusing the remote-logs retry.

  Remove the retired summary keys and tooltips from `en`/`pl`. Verify with `remote-sync-page.spec.ts` (the summaries part rewritten for the three states) and `pnpm lint` (i18n parity and unused keys).

## 4. Remote Sync list (frontend)

- [ ] 4.1 Render the Sync list with the D2 columns and the `remoteSync.columns.*` headers (the state header `sr-only`). Rework `SyncDayRow.vue` into cells:
  - a state icon with a distinct icon per kind, its accessible name "label: reason", and a `UPopover` `mode="hover"` `enable-touch` reason (D7, REQ-504);
  - an issue with the pinned `(#id)`;
  - a content-wide activity button;
  - tracked and to-send cells, the delta tooltip on to-send;
  - an empty actions cell.

  The untitled row places its duration in the tracked column. Use the three-line narrow placement (REQ-505). Keep the `remote-sync-row-*`, `remote-sync-state-*`, `remote-sync-tracked-*`, `remote-sync-to-send-*` and `remote-sync-row-delta-*` hooks. Verify with `remote-sync-page.spec.ts`, updated without dropping any row assertion.
- [ ] 4.2 Show activity errors in compact form (REQ-506): an alert icon whose accessible name and popover carry the message, and a short retry. The extension guidance and `ExtensionApprovalRequest` move to a full-width row directly after the task row. Keep the `remote-sync-activity-error-*`, `-retry-*` and `-request-*` hooks. Verify with `sync-row-extension-errors.spec.ts`:
  - the guidance row is visible while the row is collapsed;
  - the column template is unchanged;
  - a successful retry removes both.
- [ ] 4.3 Make `SyncRowDetail.vue` emit detail rows (REQ-507):
  - local entries with their duration in the tracked column;
  - logs with the link-state icon, `#id · comment`, activity, duration in the to-send column, and the link/delete action in the actions column;
  - loading, error with retry and empty as full-width rows;
  - no logs section for unlinked rows.

  Keep the `remote-sync-entries-*`, `remote-sync-entry-*` and `remote-sync-remote-log*` hooks. Verify with the detail assertions in `remote-sync-page.spec.ts` and `sync-row-extension-errors.spec.ts`.
- [ ] 4.4 Update `remote-sync-ui.spec.ts`:
  - rewrite the summary assertions to the two cards, including a delayed logs route (loading) and a failing one (unavailable, then retry);
  - add geometry checks: the Title, Issue and Activity header `x` equals the content `x`, and detail entry and log durations share the end edges of tracked and to send;
  - the state accessible name gives label and reason;
  - at 375px a row has three lines with no overflow.

  Verify with `pnpm test:e2e:ui`.

## 5. Spec bookkeeping (docs)

- [ ] 5.1 Add REQ-303, REQ-457, REQ-486, REQ-488, REQ-363 and REQ-225 to `docs/retired-requirements.md` with their replacements (see the REMOVED Migration lines), and point the REQ-222 row from REQ-363 to REQ-507. Verify that `grep -rn "REQ-\(303\|457\|486\|488\|363\|225\)\b" apps packages openspec/specs` finds nothing, and that `openspec validate table-layout-timer-and-sync --strict` passes.

## 6. Integration check

- [ ] 6.1 Run `pnpm lint`, `pnpm format:check`, `pnpm type-check`, `pnpm test:unit`, `pnpm test:nuxt` and `pnpm test:e2e`. Then compare `/` and `/sync/<day>` in `pnpm dev` with `mockups/timer-and-sync.html`:
  - at list widths 343, 600, 720, 912 and 1100, in light and dark theme;
  - with the extension tracker unapproved;
  - keyboard-only;
  - tapping state icons in touch emulation.

## Workflow follow-up

- Archive the change after review, which syncs the deltas into the main specs.
