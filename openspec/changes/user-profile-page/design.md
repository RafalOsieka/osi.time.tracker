# Design

## Context

See proposal.md (Why). This is the state today:

- `users.displayName` and `users.timezone` are nullable text columns. `seedBootstrapUser` (`apps/migrator/src/index.ts`) inserts only the email and password hash. `createUser` (`server/utils/users.ts`) and the e2e `seedUser` / `seedUsers` helpers default `displayName` to `null`.
- The session user is `{ id, email, displayName?: string | null, settings?: { timezone: string | null } }` (`shared/types/auth.d.ts`). The login handler fills it, and `PATCH /api/user/settings` refreshes it.
- `useUserSettings` resolves the effective timezone as the stored value, otherwise `UTC` until mount, otherwise the browser zone. `settings.vue` hides its controls behind `preferencesReady` while the color-mode and timezone sources settle. The server falls back with `?? 'UTC'` in `day-boundary.ts`, `monthly.get.ts` and the feed.
- `AppUserFooter.vue` has a one-group dropdown (Log out) and chooses between the display name and the email for the primary line.

## Goals / Non-Goals

**Goals:**

- The type system guarantees a display name and a timezone everywhere: `string`, never `string | null`. Every fallback branch is deleted rather than kept "just in case".
- The profile page follows the same save rule as the rest of the app: changes save on commit, and there is no Save button.

**Non-Goals:**

- A generic "user preferences" store or table. Two columns stay on `users`.
- Detecting the browser timezone at first login, or prompting for it.

## Decisions

### D1. Backfill, then `NOT NULL`, in one hand-checked migration

`pnpm db:generate` produces the `ALTER ... SET NOT NULL` statements. The backfill is added above them in the same SQL file:

```sql
UPDATE users SET "displayName" = split_part(email, '@', 1)
  WHERE "displayName" IS NULL OR btrim("displayName") = '';
UPDATE users SET "timezone" = 'UTC' WHERE "timezone" IS NULL;
```

An email local part is at most 64 characters, so it always meets the 100-character limit. No database default is added. A default would let a code path forget the value, while REQ-397 and REQ-398 require every creation path to pass one.

*Alternative:* nullable columns plus app-level fallbacks. Rejected, because that is exactly the complexity this change removes.

### D2. Seed variables validated before migrating

`readBootstrapUser(env)` returns `{ email, password, displayName, timezone }`. It applies the defaults (email local part, `UTC`) and throws an `Error` naming the variable when the timezone is not in `Intl.supportedValuesOf('timeZone')` or the display name is longer than 100 characters. `cli.ts` already calls it before `runMigrations`, so a bad value fails before any migration is applied (REQ-012). The seeded values go into the existing `INSERT ... ON CONFLICT DO NOTHING`, so existing users stay untouched.

*Alternative:* default the timezone to the container's `TZ`. Rejected: Docker images are usually UTC anyway, and the value would depend silently on the host setup.

### D3. One `profileSchema` and a flat session user

`shared/types/user-settings.ts` becomes `shared/types/profile.ts`:

- `displayNameSchema = z.string().trim().min(1).max(100)`, with error keys `errors.profile.displayNameRequired` and `errors.profile.displayNameTooLong` (`params.max`).
- `profileSchema = z.strictObject({ displayName, timezone }).partial()`. Its fields are non-nullable, so `null` is rejected (REQ-399).
- `ProfileDto = { displayName: string; timezone: string }`.

The session user flattens to `AuthUser = { id: string; email: string } & ProfileDto`, and `auth.d.ts` declares the same shape. The nested `settings` object goes away. Consumers such as `user.settings?.timezone` become `user.timezone`, and the type checker lists every site. The migrator keeps its own validation because it does not depend on `apps/web`, and the shared limit is defined in one place on each side.

*Alternative:* keep `settings: { timezone }` to reduce churn. Rejected: D4 invalidates every session anyway, so changing the shape is free now, and the nested object no longer means anything.

### D4. Invalidate pre-change sessions by renaming the session cookie

Set `runtimeConfig.session.name = 'osi-session'` in `nuxt.config.ts`. Old `nuxt-session` cookies are then ignored, so no code ever reads a session with null fields, and SSR, `requireAuth` and the session endpoint are all covered with no new code path. The e2e assertions on `nuxt-session` are updated.

*Alternative:* validate `session.user` with zod in `requireAuth` and in a `sessionHooks` fetch hook. Rejected: it adds two code paths and still misses SSR page rendering that reads the session directly.

### D5. Display name field: `UFormField` + `UInput`, commit on blur or Enter

The profile page uses a full-width labelled `UInput` with `maxlength="100"`, not `InlineEditText`. That component is built for dense table rows, and REQ-403 asks for a form-width control. Its commit logic mirrors `TimerTaskGroup.commitTitle`. When the draft is trimmed and empty, or equal to the stored value, the field reverts and nothing is sent. Otherwise it sends the PATCH. On failure it shows a toast and reverts. Escape reverts. The existing `accountPatchGeneration` counter keeps last-write-wins, and it is shared by the name and timezone fields because both go through one endpoint. The `preferencesReady` / `waitForColorMode` code goes away along with the detected-timezone watcher, because the page no longer has a theme control or an unsaved timezone.

### D6. Theme submenu in the account dropdown

`AppUserFooter.vue` menu items become two groups:

1. `{ label: Profile, icon: 'i-lucide-user', to: '/profile' }` and `{ label: Theme, icon: 'i-lucide-sun-moon', children: [light, dark, system] }`. Each child is `type: 'checkbox'`, with `checked: colorMode.preference === value` and `onSelect` setting the preference. This is the Nuxt UI dashboard `UserMenu` pattern, and Reka's checkbox items expose `aria-checked` (REQ-402).
2. Log out.

The menu content renders only when opened, so `colorMode.unknown` during SSR never reaches the markup. The footer drops its email fallback: the primary line is `displayName` and the secondary line is `email`.

### D7. `useUserSettings` becomes `useProfile`

`useProfile()` returns `{ profile, effective, save }`. `effective.timeZone` is `user.timezone`, with no `useState` or `onMounted`. The current users of `effective` switch to the new name, and the old composable and its spec are deleted. The server's `?? 'UTC'` fallbacks and `day-boundary.ts`'s nullable parameter are removed.

### D8. Spec renumbering

Requirements that lose scenarios are REMOVED and re-ADDED under new numbers (REQ-398…405). Requirements that only cite them are MODIFIED. This follows `timer-view-navigation-performance` D7. Code comments and test titles that cite the old numbers are updated in the task that touches each file.

## Risks / Trade-offs

- [A user who relied on browser detection sees UTC after the upgrade] → The profile page shows the stored timezone prominently. The README upgrade note says to set it once.
- [Everyone is logged out once (D4)] → This is acceptable for a self-hosted single-user tool and costs one login.
- [Bookmarks to `/settings` return 404] → Accepted as a non-goal. The account menu is the only entry point.
- [Blur-save of a name the user did not mean to commit] → Escape reverts the edit, and the next blur saves a correction. There is no destructive side effect.

## Migration Plan

1. Deploy: the `migrate` service applies the backfill and `NOT NULL` migration, then seeds the user with the new variables. The app then starts with the renamed cookie.
2. Rollback: restore the previous image. Old code reads non-null columns without problems, and old sessions are already gone. No down-migration is needed.
