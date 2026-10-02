# Proposal

## Why

`displayName` and `timezone` are nullable, and the bootstrap user is seeded without them. The display name cannot be edited anywhere. Because the timezone can be missing, the app carries a "UTC on first paint, browser zone after mount" fallback through the composable, the settings page and its spec. Timezone, language and display name are all personal preferences, so they belong on a profile reached from the account menu rather than on a "Settings" destination in the main navigation. This change brings the display-name part of WBS 1.5 (🟡 User profile management) forward by explicit product decision. Email and avatar stay deferred.

## What Changes

- **BREAKING (data):** `users.displayName` and `users.timezone` become `NOT NULL`. A migration backfills existing rows with the email local part and `UTC`. The unsaved-timezone fallback (`UTC` → browser-detected upgrade, the "detected" hint) is removed.
- The bootstrap seed accepts optional `BOOTSTRAP_USER_DISPLAY_NAME` (default: the email local part) and `BOOTSTRAP_USER_TIMEZONE` (default: `UTC`). The migrate step fails before seeding when the timezone is not a valid IANA id.
- **BREAKING (API):** `GET/PATCH /api/user/profile` (`{ displayName, timezone }`) replaces `/api/user/settings`.
- **BREAKING (route):** a new `/profile` page replaces `/settings`, with no redirect. It shows the display name (saved on blur or Enter, with no Save button), the read-only email, the timezone, and the language (still cookie-backed, for this browser).
- The sidebar no longer has a Settings link. The account menu gains a Profile item and a Theme submenu (Light / Dark / System) above Log out. Theme leaves the settings page.
- Sessions sealed before the change, which lack a display name or timezone, are treated as unauthenticated, so the user logs in once more.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

A MODIFIED requirement cannot drop scenarios, so requirements that lose scenarios are renumbered (REMOVED + ADDED), as `timer-view-navigation-performance` did.

- `workspace-settings`: REQ-165/166/167 become REQ-398 (required timezone), REQ-399 (profile API) and REQ-400 (profile page). New REQ-397 (required display name).
- `core-authentication`: non-null `displayName` and stale-session clearing (REQ-007), seed defaults and validation (REQ-012).
- `core-i18n`: REQ-262 becomes REQ-401 (language control on `/profile`).
- `ui-theming`: REQ-163 becomes REQ-402 (theme submenu in the account menu).
- `ui-shell`: REQ-064 (theme only in the account menu), REQ-065 becomes REQ-404 (no Settings link), REQ-069 becomes REQ-405 (account menu), REQ-301 (Profile title).
- `ui-shared-components`: REQ-263 becomes REQ-403 (full-width controls on `/profile`).
- `ui-routing` (REQ-061), `tracking-api` (REQ-395), `tracking-timer-view` (REQ-396), `tracking-timer-widget` (REQ-146): updated citations, and the dead timezone fallback wording is dropped.

## Non-goals

- Changing the email or password, an avatar, or account deletion.
- Persisting the locale or theme on the account.
- A `/settings` → `/profile` redirect.
- Rewording the remaining fallback text in REQ-289 (monthly report) and REQ-388 (client report title page: email when the display name is empty). These branches become unreachable but stay true.

## Impact

- DB: a migration (backfill + `NOT NULL`) in `apps/migrator/migrations`, and seed changes in `apps/migrator/src`.
- API: `server/api/user/profile.{get,patch}.ts` replaces `settings.*`. Session validation on fetch. `createUser` now requires `displayName` and `timezone`.
- Web: `pages/profile.vue` replaces `settings.vue`. Changes to `AppUserFooter.vue`, `AppSidebar.vue`, `useUserSettings` (simplified) and the `en`/`pl` catalogs.
- Config: `.env.example`, `docker-compose.prod.yml`, `README.md`.
