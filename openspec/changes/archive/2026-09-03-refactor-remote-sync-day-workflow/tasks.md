## 1. Shared compact row shell

- [x] 1.1 Frontend: Add a presentational compact expandable-row shell with slots for expansion, title, secondary, meta, duration, actions, and detail; two-line named grid below the shell `lg` breakpoint and `lg:flex` above; empty actions region keeps icon-button min-width (REQ-303). Verify the component file exists and type-checks.
- [x] 1.2 Frontend tests: Nuxt-mount the shell at wide and narrow classes and verify one-line vs two-line areas, `aria-expanded` / `aria-controls` on the expansion control, and that an empty actions slot does not collapse relative to a slot with an `xs` square button.

## 2. Shared ghost inline-edit

- [x] 2.1 Frontend: Extract the none/ghost `UInput` + overflow tooltip + Enter/blur commit / Escape revert pattern into a shared inline-edit control (REQ-178). Verify timer titles can be wired to it without `ch` widths.
- [x] 2.2 Frontend tests: Nuxt-test display vs edit, commit on Enter/blur, revert on Escape, and overflow tooltip only when truncated. Verify `pnpm test:nuxt` for that file.

## 3. Timer group header onto the shell

- [x] 3.1 Frontend: Switch `TimerTaskGroup.vue` onto the shared shell (secondary=project, meta=issue, duration=total, actions=play/stop) and group/entry titles onto the shared inline-edit (REQ-265). Verify existing timer group/entry behavior is unchanged in the browser-equivalent nuxt tests.
- [x] 3.2 Frontend tests: Update `test/nuxt/timer-task-group.spec.ts` (and `timer-entry-row.spec.ts` if titles moved) so density, live stop, untitled assign, and tooltips still pass.

## 4. Export set: Ready vs Sent

- [x] 4.1 Frontend: Treat `exports.length > 0` as Sent; `isPushable` only for Ready rows (linked, activities, no provenance, non-zero to-send, activity selected). Export sends all completed entry ids for those rows. Drop include-checkbox and per-entry selection state (REQ-112, REQ-117, REQ-119). Verify day totals helper counts sent vs tracked vs blocked vs untitled (REQ-225) — unit-test `computeRemoteSyncDayTotals` (or its successor) for the new buckets.
- [x] 4.2 Frontend tests: Unit-test row kind derivation (Ready / Sent / blocked) including “later local entries on a Sent row stay unsent”. Verify `pnpm test:unit` for those files.

## 5. Compact Remote Sync rows

- [x] 5.1 Frontend: Replace `UTable` with a list of `SyncDayRow` shells: badge, in-place title-to-send, activity `USelect` xs, duration cluster (tracked → editable to-send, signed delta on tooltip), empty actions slot; two-line below `lg`. Drop State column. i18n `en`/`pl` for badges and retired include/state/entry copy (REQ-223, REQ-113, REQ-232). Verify the page no longer renders `remote-sync-table` / include / state hooks.
- [x] 5.2 Frontend tests: Rewrite `test/nuxt/remote-sync-page.spec.ts` for collapsed cluster, Ready editors vs Sent read-only, no include/entry/rounding hooks, title-to-send not calling reassign.

## 6. Details panes and export dialog

- [x] 6.1 Frontend: Slim `SyncRowDetail.vue` to read-only local entries + remote logs; two columns at `lg`, stacked below; `UAlert` for duplicate warning; no duration/comment/rounding/entry-selection editors (REQ-304). Strip review-dialog skip-because-unchecked and repeat-because-reselected copy; skip Sent/blocked with reasons (REQ-229). Verify expanded details and dialog review in nuxt tests.
- [x] 6.2 Frontend e2e: Update `test/e2e/ui` Remote Sync journeys — Export sends only never-exported Ready rows, duration cluster on the row, details have no entry checkboxes, Sent row is not exported after a successful run. Verify `pnpm test:e2e:ui` for those specs.

## 7. Verification

- [x] 7.1 Frontend: `pnpm lint`, `pnpm format:check`, `pnpm type-check`, `pnpm test:unit`, `pnpm test:nuxt` green. No backend or API files changed.
