## 1. i18n preparation

- [x] 1.1 Frontend: Repurpose `settings.save` / `settings.saved` (and related) in `en.json` / `pl.json` for auto-apply error (and optional saving) copy; add keys for language/theme/section labels as needed; keep `en`/`pl` parity
- [x] 1.2 Frontend: Unit — catalog parity still passes (`pnpm test:unit` for i18n parity)

## 2. Project form dialog extraction

- [x] 2.1 Frontend: Extract smart `ProjectFormDialog` (form state, schema, tracker options fetch, detach confirm, save, server field errors, full-width controls, `sm:max-w-lg` modal); preserve existing `data-testid`s
- [x] 2.2 Frontend: Slim `projects.vue` to list/delete/open dialog + refresh on `saved`
- [x] 2.3 Frontend: Update `test/nuxt/projects.spec.ts` for dialog extraction (mount path / stubs) without weakening coverage
- [x] 2.4 Frontend: E2E — `test/e2e/projects-ui.spec.ts` still covers create/edit/delete flows end-to-end

## 3. Tracker form dialog extraction

- [x] 3.1 Frontend: Extract smart `TrackerFormDialog` (form state, secret handling, validation errors, save, full-width controls); preserve existing `data-testid`s
- [x] 3.2 Frontend: Slim `trackers.vue` to list/delete/open dialog + refresh on `saved`
- [x] 3.3 Frontend: Update `test/nuxt/trackers.spec.ts` for dialog extraction without weakening coverage
- [x] 3.4 Frontend: E2E — `test/e2e/trackers-ui.spec.ts` still covers create/edit/delete flows end-to-end

## 4. Settings auto-apply and preference hub

- [x] 4.1 Frontend: Rebuild `/settings` with language, theme, timezone, and week-start controls; remove Save button and success banner; wire immediate apply (cookies for locale/theme; partial `save({ ... })` for account fields with latest-write-wins); toast-only on account PATCH failure; full-width controls
- [x] 4.2 Frontend: E2E — update `test/e2e/user-settings-ui.spec.ts` for no-Save auto-persist of timezone/week-start (and language/theme apply if practical in browser tests)

## 5. Utility menu slim-down

- [x] 5.1 Frontend: Remove locale and theme groups from `AppUtilityMenu`; leave logout only
- [x] 5.2 Frontend: Update `test/nuxt/shell.spec.ts` (and related) so utility menu expectations match logout-only
- [x] 5.3 Frontend: E2E — `test/e2e/shell.spec.ts` / auth UI still reaches logout via utility menu; no reliance on menu locale/theme items

## 6. Backend verification (no contract change)

- [x] 6.1 Backend: Confirm `PATCH /api/user/settings` partial updates remain correct for single-field bodies (no code change unless a gap is found)
- [x] 6.2 Backend: E2E/API — `test/e2e/user-settings.spec.ts` still covers happy path and invalid timezone (and partial body if not already explicit)

## 7. Quality gate

- [x] 7.1 Frontend: Run lint, format check, type-check, and affected unit/nuxt/e2e suites green for this change
