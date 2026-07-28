## 1. Shared derivation helpers

- [ ] 1.1 Add `computeRemoteSyncDayTotals` to `shared/utils/remote-sync-day-totals.ts` returning `{ dayTotal, tracked, toSend, blocked, excluded, untitled, delta }` from injected per-row predicates and durations
- [ ] 1.2 Unit-test `computeRemoteSyncDayTotals`: the `dayTotal = tracked + blocked + excluded + untitled` invariant, positive and negative deltas, included-but-blocked rows, untitled-only day, empty day
- [ ] 1.3 Add `findDuplicateRemoteLog(exportSeconds, logs)` to `shared/utils/` returning the colliding log or `null`
- [ ] 1.4 Unit-test `findDuplicateRemoteLog`: equal duration match, different duration, empty log list, multiple candidates

## 2. Page shell, day navigation and summaries

- [ ] 2.1 Extract a `SyncDayHeader` component rendering the date heading, previous/next/today actions and the calendar jump, emitting the target date
- [ ] 2.2 Wire navigation to `/sync/<iso>` in `app/pages/sync/[date].vue` and reset per-day review state (selections, activity choices, duration overrides) when the date changes
- [ ] 2.3 Render day total, tracked, to send, the signed delta and the blocked/excluded/untitled amounts as labelled chips with `data-testid="remote-sync-total-*"` hooks
- [ ] 2.4 Add all new `remoteSync.*` i18n keys (summaries, deltas, navigation, bulk actions, duplicate warning, log comment placeholder) to `en.json` and `pl.json` in parity

## 3. Expandable table layout

- [ ] 3.1 Replace the flat list in `app/pages/sync/[date].vue` with a `UTable` of collapsed summary rows (inclusion control, task name, issue, activity select, tracked → to send, state badge) plus a footer repeating the three totals
- [ ] 3.2 Extract a `SyncRowDetail` component for the expanded region (entry selection list, editable export duration with reset, remote-log context) and render it through the table's expanded slot
- [ ] 3.3 Group non-exportable rows apart from exportable rows and render the untitled bucket as a non-selectable table row
- [ ] 3.4 Re-attach every pre-existing `data-testid` to its equivalent element and add the new hooks for expansion, totals, bulk actions and warnings
- [ ] 3.5 Render the state column as a `UBadge` with an `i-lucide-*` icon plus the existing translated reason text

## 4. Row detail features

- [ ] 4.1 Render each remote log's comment with a translated placeholder when absent and accessible truncation for long values
- [ ] 4.2 Add per-task select-all / deselect-all entry actions and day-level include-all / exclude-all task actions, skipping read-only rows
- [ ] 4.3 Render the dismissible possible-duplicate warning (icon + text, names the colliding log) without affecting pushability
- [ ] 4.4 Show per-row tracked and to-send durations with the signed delta in both the collapsed row and the detail region

## 5. Accessibility and tests

- [ ] 5.1 Verify keyboard operability and expansion `aria` state; keep live regions on activity and remote-log loading/errors
- [ ] 5.2 Add nuxt component tests for the summary chips (reconciliation), the state badge text, the log-comment placeholder and the duplicate warning
- [ ] 5.3 Audit existing Remote Sync E2E specs and insert explicit row-expansion steps where they interact with detail controls, without weakening assertions
- [ ] 5.4 Add E2E coverage for day navigation (prev/next/calendar/today, empty day, no state carry-over) and for bulk selection updating the three summaries

## 6. Verification

- [ ] 6.1 Run `pnpm lint`, `pnpm format:check`, `pnpm type-check`
- [ ] 6.2 Run `pnpm test:unit`, `pnpm test:nuxt`, `pnpm test:e2e`
