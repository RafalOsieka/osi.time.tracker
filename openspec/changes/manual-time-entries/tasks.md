## 1. Backend — shared types & validation

- [x] 1.1 Extend `startTimeEntrySchema` in `shared/types/time-entry.ts` with an optional `startedAt`/`stoppedAt` pair (both ISO datetime, both-or-neither, `startedAt <= stoppedAt`, `startedAt` not in the future with clock-skew tolerance), with `{ messageKey }` error keys
- [x] 1.2 Extend `updateTimeEntrySchema` with an optional `startedAt` (ISO datetime), with error keys
- [x] 1.3 Unit tests for both schema extensions (valid pair, missing half, inverted pair, future start, `startedAt` on update)

## 2. Backend — API endpoints

- [x] 2.1 Extend `POST /api/time-entries` to create an already-stopped entry when the manual pair is present (skip stop-on-new-start, keep title resolution) per REQ-TTR-036
- [x] 2.2 E2E tests for manual creation: happy path (with/without title), running entry untouched, invalid pair rejected with `{ messageKey, params }`
- [x] 2.3 Extend `PATCH /api/time-entries/[id]` to accept `startedAt`, validating the effective post-patch state (`startedAt <= stoppedAt` when stopped; `startedAt <= now` + tolerance when running) per REQ-TTR-039
- [x] 2.4 E2E tests for `startedAt` patch: stopped-entry edit, running-entry edit rebasing elapsed, future start rejected, start-after-stop rejected, overlap accepted, 404 for foreign/unknown id
- [x] 2.5 Implement `DELETE /api/time-entries/[id]` (`requireAuth` + CSRF) deleting the entry and hard-deleting its task when it was the last referencing entry, in one transaction, per REQ-TTR-050
- [x] 2.6 E2E tests for delete: entry with sibling entries (task kept), last entry (task GC'd), untitled entry, 404 for foreign/unknown id, unauthenticated 401

## 3. Frontend — timer view: manual entry creation

- [x] 3.1 Add "+ add entry" action to each day section opening a manual-entry form (title autocomplete, start time, end time; date fixed by the day), converting local times to instants and POSTing per REQ-TTR-046
- [x] 3.2 Client-side validation: end before start blocked with an inline error; a11y labels and i18n strings (`en`/`pl` parity)
- [x] 3.3 On success insert the created entry into the correct day/task group (or refetch the affected window)
- [x] 3.4 E2E test: add a manual entry from a day section and see it grouped correctly; inverted times blocked without a request

## 4. Frontend — timer view: inline edit & delete

- [x] 4.1 Extract a per-entry row component and make start time, stop time, and title editable inline (commit on blur/Enter, cancel on Escape) via PATCH per REQ-TTR-046
- [x] 4.2 Handle retitle-splits (entry regroups under the resolved task) and cross-midnight `startedAt` edits (entry regroups under the other day); update row/group/day totals from the response
- [x] 4.3 Add per-entry delete action with confirmation calling `DELETE /api/time-entries/[id]`; remove the entry and collapse emptied groups on success
- [x] 4.4 A11y (labelled inline controls, keyboard operable, `aria-invalid`/`aria-describedby` for errors) and i18n strings in `en`/`pl` parity
- [x] 4.5 Nuxt component tests for the entry row: inline commit/cancel behavior, delete confirmation flow
- [x] 4.6 E2E tests: edit an entry's times inline, retitle splits it to another group, delete an entry garbage-collecting its emptied task group

## 5. Frontend — topbar running-entry start edit

- [x] 5.1 Make the timer widget's elapsed-time display an activatable control opening a PrimeVue popover with a date field and one hours+minutes input seeded with the running entry's local start, per REQ-NFR-026
- [x] 5.2 Commit PATCHes `startedAt`; block future instants client-side with an inline error; on success update `running` via `useTimer` so the elapsed ticker rebases
- [x] 5.3 A11y (focus management for the popover, labelled fields, keyboard operable trigger) and i18n strings in `en`/`pl` parity
- [x] 5.4 Nuxt component tests for the popover: seeding, future-start blocking, commit updates the widget
- [x] 5.5 E2E test: edit the running entry's start (including a previous date) and see the elapsed time rebase, entry still running

## 6. Documentation & quality gates

- [x] 6.1 Update `docs/user-stories.md` story 6 acceptance criteria to mention the topbar running-entry start edit
- [x] 6.2 Run `pnpm lint`, `pnpm format:check`, `pnpm test:unit`, `pnpm test:nuxt`, `pnpm test:e2e` and fix any failures (including i18n parity test)
