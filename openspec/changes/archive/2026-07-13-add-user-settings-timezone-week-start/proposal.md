# Proposal: add-user-settings-timezone-week-start

## Why

Story 7 (WBS 7.1, 7.2 — both red priority): all times are stored in UTC, but the app currently renders them only in the **browser-local** timezone via plain `Date` getters. Users working across machines or travelling need times displayed in a chosen timezone and weekly grouping honoring their week-start day — persisted on the account, not per device. Story 8 (reports) depends on both preferences.

## What Changes

- Add account-level user settings: **timezone** (IANA identifier) and **week start day** (Monday/Sunday), stored on the user record and exposed via the session/API.
- New `GET`/`PATCH /api/user/settings` endpoints (auth + CSRF, `{ messageKey, params }` errors, zod-validated shared boundary types).
- Turn the `/settings` placeholder page into a Preferences form: filterable IANA timezone `Select` (from `Intl.supportedValuesOf('timeZone')`, with detected-timezone hint) and a week-start `SelectButton`.
- Default timezone is browser-detected on first use and persisted; default week start is Monday.
- Replace browser-local date math (`app/utils/timerViewGrouping.ts`, `formatDate.ts`, timer components) with timezone-aware logic: **Temporal via `temporal-polyfill`** for arithmetic (day keys, day boundaries, wall-clock↔instant), `Intl` with `timeZone` for formatting; thin adapters at the PrimeVue `DatePicker` boundary.
- Changing settings takes effect by pure re-render — UTC-on-the-wire invariant is unchanged.

## Capabilities

### New Capabilities

- `user-settings`: account-persisted preferences (timezone, week start), their defaults, the settings API, and the `/settings` preferences page.

### Modified Capabilities

- `time-tracking`: timer view day grouping, day windows, entry editors, and the running-entry start popover use the user's configured timezone instead of the browser-local timezone (REQ-TTR-046 and related).
- `frontend-shell`: the Settings destination ceases to be a placeholder and routes to the real preferences page (REQ-AUTH-011).

## Non-goals

- Default rounding rule (WBS 7.3, yellow) and per-target rounding overrides.
- Migrating locale/theme (cookie-based, device-local) into account settings.
- Server-side report aggregation (story 8); this change only makes the client timezone-aware and stores the preferences it will need.
- Arbitrary week-start days beyond Monday/Sunday.

## Impact

- DB: new columns on `users` (or a `user_settings` table) + Drizzle migration.
- API: new `/api/user/settings` handlers; session payload extended with settings.
- Frontend: `/settings` page, date utils rewritten on Temporal, timer view/components touch-ups.
- Dependencies: adds `temporal-polyfill` (~20 kB, drops out as browsers ship Temporal natively).
- i18n: new keys in `en`/`pl` catalogs (parity enforced).
