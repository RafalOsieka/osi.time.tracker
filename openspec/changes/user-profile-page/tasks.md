# Tasks

## 1. Required columns and bootstrap seed (backend)

- [ ] 1.1 Make `displayName` and `timezone` `.notNull()` in `server/db/schema/users.ts`. Run `pnpm db:generate` and prepend the D1 backfill to the generated SQL. Make `createUser` require both fields and update the e2e `seedUser` / `seedUsers` helpers (defaults: `Test User <n>` / `UTC`). Verify with a `test/e2e/db` spec: a null name or blank name is backfilled to the email local part, a null timezone becomes `UTC`, and an insert without either column is rejected.
- [ ] 1.2 Extend `readBootstrapUser` and `seedBootstrapUser` per design D2 (defaults, validation naming the variable, insert of both columns, existing user untouched). Verify with `apps/migrator/test/index.spec.ts` and `cli.spec.ts`: defaults, explicit values, invalid timezone and too-long name exit non-zero before migrating, unset email or password still skips silently with an invalid timezone, and an existing user is unchanged.
- [ ] 1.3 Add `BOOTSTRAP_USER_DISPLAY_NAME` / `BOOTSTRAP_USER_TIMEZONE` to `.env.example`, the `migrate` service in `docker-compose.prod.yml`, and the README env table plus an upgrade note (timezone becomes UTC, one forced re-login). Verify that `docker compose -f docker-compose.prod.yml config` lists both variables and that `pnpm format:check` passes.

## 2. Profile types, session and API (backend)

- [ ] 2.1 Replace `shared/types/user-settings.ts` with `shared/types/profile.ts` (design D3). Flatten `AuthUser` and `auth.d.ts` to `{ id, email } & ProfileDto`. Update the login handler to fill the flat payload. Verify with `test/unit/profile.spec.ts`: trimming, empty/too-long name with `messageKey` and `max`, `null` rejected, unknown timezone rejected, unknown keys rejected.
- [ ] 2.2 Rename the session cookie to `osi-session` (design D4) and update the `nuxt-session` assertions in `test/e2e/api/auth.spec.ts` and `bootstrap-user-login.spec.ts`. Verify with an added API e2e case: a request carrying only a sealed `nuxt-session` cookie gets 401 from a protected route, and login returns a payload with a non-null `displayName` and `timezone`.
- [ ] 2.3 Replace `server/api/user/settings.{get,patch}.ts` with `profile.{get,patch}.ts` (`readZodBody` + `profileSchema`, session refresh, `ProfileDto` response). Remove the `?? 'UTC'` fallbacks in `day-boundary.ts`, `feed.get.ts` and `monthly.get.ts`, and fix the REQ-165 citations in comments. Rename `test/e2e/api/user-settings.spec.ts` to `profile.spec.ts`, covering: read, name PATCH trims and refreshes the session (verified by a follow-up `GET /api/auth/session`), timezone PATCH, invalid name or timezone returns 422 with nothing persisted, `null` returns 422, `/api/user/settings` returns 404, and unauthenticated or missing-CSRF requests are rejected.
- [ ] 2.4 Replace the `errors.userSettings.*` keys with `errors.profile.*` (`invalidTimezone`, `displayNameRequired`, `displayNameTooLong`) in `en.json` / `pl.json`, and verify that `pnpm lint` (i18n parity) passes.

## 3. Profile composable (frontend, non-UI logic)

- [ ] 3.1 Replace `use-user-settings.ts` with `use-profile.ts` (design D7) and update every consumer (`AppTimer`, `TrackerImportDialog`, `use-client-report-export`, the index / projects / trackers / sync / client-report pages and their nuxt specs). Drop the `|| email` fallback in `use-client-report-export` and its builder test. Verify with `test/nuxt/use-profile.spec.ts`: `effective.timeZone` equals the session timezone on first render with no post-mount change, and `save` updates the session user. Also verify that `pnpm type-check` passes with no `settings?.` access left.

## 4. Profile page (frontend)

- [ ] 4.1 Replace `pages/settings.vue` with `pages/profile.vue` (Account section: display name per design D5, read-only email, timezone select; Preferences section: language with the "this browser" hint; no theme control). Add `nav.profile` / `profile.*` strings to both catalogs. Verify with `test/nuxt/profile-page.spec.ts` (replacing `settings-page.spec.ts`): stored values shown with no detected hint, blur and Enter send a trimmed PATCH, unchanged / empty / Escape send nothing and revert, a failed PATCH toasts and reverts, timezone change PATCHes, no theme control or Save button, and the title is `Profile | OSI Time Tracker`.
- [ ] 4.2 Rename `test/e2e/ui/user-settings-ui.spec.ts` to `profile-ui.spec.ts`. Cover: open Profile from the account menu, edit the display name and blur, see the sidebar footer update without a reload and the value persist after a reload, change the timezone and see times re-render, change the language. Also check that `/settings` renders the not-found page. Verify that `pnpm test:e2e:ui` passes.

## 5. Account menu and sidebar (frontend)

- [ ] 5.1 Update `AppUserFooter.vue` per design D6 (Profile item, Theme submenu with checkbox items, separate Log out group, no email fallback) and remove the Settings link from `AppSidebar.vue`. Add `layout.profile` / `layout.theme` strings in both catalogs. Verify with `test/nuxt/AppUserFooter.spec.ts` and `shell.spec.ts`: menu order, the active theme exposed as checked, selecting Dark sets the preference, the collapsed avatar opens the same menu, the footer shows name + email, and the sidebar has no Settings or Profile link (update the REQ-065 / REQ-069 citations to REQ-404 / REQ-405).
- [ ] 5.2 Extend `test/e2e/ui/shell.spec.ts`: using only the keyboard, open the account menu, open Theme and choose Dark, then reload and assert dark mode persists. Also assert the account menu has no language options. Verify that `pnpm test:e2e:ui` passes.

## 6. Docs and integration

- [ ] 6.1 Update `docs/wbs.md` (1.5 partly delivered: display name; 7.4 language stays cookie-only, now on Profile; 7.6 theme in the account menu) and `docs/user-stories.md` (story 7 becomes profile: display name, timezone, language). Verify that `pnpm format:check` passes.
- [ ] 6.2 Run `pnpm lint`, `pnpm format:check`, `pnpm type-check`, `pnpm test:unit`, `pnpm test:nuxt` and `pnpm test:e2e`. Then, on a local database with a null-name / null-timezone user, run `pnpm db:migrate` and confirm that the old session cookie no longer logs in, that after logging in the footer shows the email local part, and that `/profile` shows `UTC`.
