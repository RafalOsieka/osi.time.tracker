# Design: add-user-settings-timezone-week-start

## Context

All timestamps are stored in UTC and travel as ISO 8601 strings; conversion happens only at display. Today that conversion is hard-wired to the **browser-local** timezone: `app/utils/timerViewGrouping.ts` (`localDayKey`, `computeWindowRange`, `combineLocalDateAndTime`, `isoToLocalTime`) and the timer components use plain `Date` local getters, and `formatDate.ts`/`formatDuration.ts` use `toLocale*` without a `timeZone` option. Plain `Date` can only represent two zones (UTC and browser-local), so a user-chosen timezone cannot be honored with the current primitives. The `/settings` page is an empty placeholder; locale and theme are cookie-based device-local preferences in the utility menu.

## Goals / Non-Goals

**Goals:**

- Account-persisted timezone (IANA) and week-start (Monday/Sunday) settings with sensible defaults.
- All time display and day/week bucketing honor the configured timezone, including DST-safe wall-clock↔instant conversion when editing entries.
- Establish `/settings` as the home for account-level preferences.

**Non-Goals:**

- Rounding rules (WBS 7.3), server-side report aggregation (story 8), migrating locale/theme to the account, week-start days other than Monday/Sunday.

## Decisions

### D1: Temporal (`temporal-polyfill`) for timezone-aware date arithmetic

Use the TC39 Temporal API via the `temporal-polyfill` package for all foreign-zone arithmetic (day keys, day boundaries, week windows, "wall clock in user TZ → UTC instant"). Formatting stays on `Intl.DateTimeFormat`/`toLocale*` with an explicit `timeZone` option.

- **Alternatives considered:**
  - *Luxon*: first-class TZ support but ~70 kB, not tree-shakeable, effectively in maintenance mode; stays a dependency forever.
  - *date-fns + `@date-fns/tz`*: small and tree-shakeable, but two-package coordination and immutability-by-convention; also a permanent dependency.
  - *Plain `Date` + `Intl` round-trips*: zero bundle cost but error-prone (DST edges, manual offset math) — the class of bugs this change exists to avoid.
- **Rationale:** greenfield app with few call sites (~6 utils + 3 components) — migration cost is at its minimum now; the domain (UTC instants projected into an arbitrary user zone, day/week bucketing) is exactly Temporal's model (`Temporal.Instant`, `ZonedDateTime`, `.startOfDay()`, `dayOfWeek`); the polyfill (~20 kB) becomes a no-op as browsers ship Temporal natively (Firefox already does) and can eventually be dropped. It also runs in Node/Nitro, so story 8 can reuse the same logic server-side.

### D2: Settings stored as columns on `users`

Add `timezone` (text, IANA identifier) and `week_start` (text enum `monday`/`sunday`) columns to the existing `users` table rather than a separate `user_settings` table.

- **Alternative:** a `user_settings` 1:1 table — cleaner separation but adds a join/upsert path for two scalar preferences. Revisit if settings grow (rounding, integrations).
- Defaults at the DB level: `week_start = 'monday'`; `timezone` nullable — `NULL` means "not yet chosen".

### D3: Browser-detected timezone default, persisted on first save

When `timezone` is `NULL`, the client falls back to `Intl.DateTimeFormat().resolvedOptions().timeZone` for display and pre-selects it (with a "detected" hint) on the settings page. Persisting happens only when the user saves — no silent writes on login.

- **Alternative:** auto-persist detected TZ at first login — fewer states, but writes data the user never confirmed and surprises multi-device users.

### D4: API surface and delivery to the client

`GET /api/user/settings` and `PATCH /api/user/settings` (auth + CSRF, zod-validated `shared/types/user-settings.ts` boundary types, `{ messageKey, params }` errors). Timezone values validated against `Intl.supportedValuesOf('timeZone')`. Settings are also embedded in the session payload (`AuthUser`) so the app has them on first render without an extra request; a `useUserSettings` composable exposes them app-wide with an optimistic update on save.

- **Alternative:** fetch-only (no session embedding) — simpler invalidation but a flash of browser-local rendering on every page load.

### D5: PrimeVue `DatePicker` boundary adapter

PrimeVue `DatePicker` works with `Date` objects interpreted in browser-local time. Introduce a small adapter pair ("wall-clock in user TZ" ↔ "fake local `Date`") used only at picker edges; all other code passes ISO instants or `Temporal` types. This isolates the impedance mismatch to ~10 lines.

### D6: Timezone change is a pure re-render

Because UTC-on-the-wire is unchanged, switching timezone or week start only re-runs grouping/formatting with new parameters — no data migration, no server recomputation. Grouping utils take `{ timeZone, weekStart }` as explicit parameters (pure functions, unit-testable) rather than reading global state.

## Risks / Trade-offs

- [Polyfill maturity/size] `temporal-polyfill` is spec-compliant and widely used, but is ~20 kB → Mitigation: it is loaded once, shrinks to zero as native support lands, and is confined behind our date utils so it could be swapped.
- [DST edge cases in entry editing] Ambiguous/skipped wall-clock times when combining date+HH:mm → Mitigation: use Temporal's explicit disambiguation (`'compatible'`) and cover DST transitions in unit tests.
- [Stale settings in sealed session cookie] Session payload copies settings; a PATCH must refresh the session → Mitigation: PATCH handler re-seals the session with updated settings; client composable updates local state from the response.
- [Picker adapter confusion] "Fake local `Date`" objects leaking beyond the adapter → Mitigation: keep adapters private to the components using `DatePicker`; lint-visible naming (`toPickerDate`/`fromPickerDate`).

## Migration Plan

1. Drizzle migration adds the two columns (nullable TZ, defaulted week start) — backward compatible, no backfill needed.
2. Deploy code; existing sessions lacking settings fields fall back to detected TZ + Monday until refreshed.
3. Rollback: revert code; columns are additive and can remain.

## Open Questions

- None blocking — server-side aggregation reuse (story 8) confirmed as nice-to-have and deferred.
