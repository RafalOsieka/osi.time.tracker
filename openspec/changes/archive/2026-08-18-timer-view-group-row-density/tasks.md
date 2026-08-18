## 1. Compact TimeInput

- [x] 1.1 Frontend: In `TimeInput.vue`, replace compact `width: 5.5ch` with a min-width that shows a full `HH:mm` plus default `UInput` padding/border; keep parser/commit/cancel unchanged
- [x] 1.2 Frontend tests: Extend `test/nuxt/shared-ui-components.spec.ts` so compact `TimeInput` does not use a `5.5ch` outer width and a committed `09:00` remains fully specified (class/style contract)

## 2. Entry row slots

- [x] 2.1 Frontend: In `TimerEntryRow.vue`, drop `ch`-based title widths; put title and start/stop in stable slots (`min-w-0` / reserved time width matching compact `TimeInput`); `UTooltip` on display title; duration span uses `min-w-[4.5rem] font-mono tabular-nums`; keep `combineWithEntryDay` (no date field)
- [x] 2.2 Frontend tests: Update `test/nuxt/timer-entry-row.spec.ts` — long title has tooltip/accessible full name, activating title/time does not apply `ch` widths, time edit still PATCHes time only on the same local day

## 3. Task group density

- [x] 3.1 Frontend: In `TimerTaskGroup.vue`, drop `ch` widths; title `flex-1 min-w-0` + project `w-48` `UPopover` listbox; two-line header below `lg`; numeric `UBadge` left of title (`9+`); live group uses shell stop control; untitled groups share named chrome (no bulk-assign button; project disabled without title); compact `xs` row chrome
- [x] 3.2 Frontend tests: Update `test/nuxt/timer-task-group.spec.ts` — long title/project tooltip, count badge, unlinked/disabled remote icons, live stop, untitled title assign, existing rename/project/reassign cases still pass

## 5. Follow-up UI (post-apply)

- [x] 5.1 Frontend: `RemoteIssuePicker` — linked `#id` + hover Edit dropdown; unlinked `i-lucide-link-2-off`; shared `w-6` slot; disabled icon when no tracker; sentence tooltip
- [x] 5.2 Frontend: Entry start/stop stay in a `10ch` slot; compact `TimeInput` remains outlined `xs`; display uses matching type size/padding so digits do not jump
- [x] 5.3 Frontend tests: `test/nuxt/remote-issue-picker.spec.ts` and `test/nuxt/timer-entry-row.spec.ts` cover overlay edit, slot width, and time-slot swap

## 4. E2E and verification

- [x] 4.1 Frontend e2e: Extend `test/e2e/timer-view-ui.spec.ts` — group count badge is visible, unlinked status is an icon (not the phrase), inline title and start/stop edits still commit (time stays on the same date)
- [x] 4.2 Frontend: `pnpm lint`, `pnpm format:check`, `pnpm type-check`, `pnpm test:nuxt` (and `pnpm test:e2e` for timer-view) stay green
