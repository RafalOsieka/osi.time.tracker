## 1. Frontend — replace native `title` hints

- [ ] 1.1 `RemoteIssuePicker`: drop HTML `title`; wrap linked `#id` (link and cached span) and the unlinked icon in `UTooltip` (`content.side = 'top'`), reusing `linkedTooltip` / unlinked copy; do not wrap the Edit/Unlink dropdown or the search popover
- [ ] 1.2 `TimerTaskGroup`: replace `:title` on the disabled project button and disabled remote-issue icon with `UTooltip` around a `tabindex="0"` span (sync-chip pattern); keep existing `aria-label`s
- [ ] 1.3 `SyncRowDetail`: wrap truncated remote-log comments in `OverflowTooltip` and remove `:title` (keep the comment as accessible name)

## 2. Frontend — icon-only tooltips

- [ ] 2.1 `RowActions`: wrap edit and delete in `UTooltip` whose text matches each button's `aria-label`
- [ ] 2.2 Timer chrome: wrap group expand/collapse, group play/stop, and entry delete in matching `UTooltip`s
- [ ] 2.3 Audit remaining icon-only / status-only controls under `app/` (at least `SyncDayHeader` prev/next and `AppTimer` toggle); wrap those that lack a visible label; do not add repeating tips on labeled buttons or expanded nav

## 3. Frontend tests (nuxt)

- [ ] 3.1 Update `test/nuxt/remote-issue-picker.spec.ts`: stub `UTooltip` with `data-tooltip-text`; assert linked/unlinked hints there, not on HTML `title`; drop `title` from `ButtonStub` if unused
- [ ] 3.2 Update `test/nuxt/timer-task-group.spec.ts`: disabled project/remote explanations and icon-only group actions expose `data-tooltip-text`; no HTML `title` hints
- [ ] 3.3 Update `test/nuxt/timer-entry-row.spec.ts`, `test/nuxt/shared-ui-components.spec.ts`, and sync-page coverage: entry delete / row actions / day-nav (if mounted) tooltips; truncated remote-log comments use overflow tooltip (`data-overflow-tooltip`) instead of `title`

## 4. Frontend — convention doc

- [ ] 4.1 Add a short UI bullet in `CODING_STANDARDS.md` §4: themed `UTooltip` for hints; no HTML `title`; icon-only matches `aria-label`; no repeating visible labels; disabled explanations wrap a focusable host; overflow uses `OverflowTooltip`

## 5. Verification

- [ ] 5.1 Run `pnpm lint`, `pnpm format:check`, `pnpm type-check`, `pnpm test:nuxt` (and `pnpm test:unit` if any unit file is touched)
