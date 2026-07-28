## Why

The only rounding rules available are `up_15m` / `up_30m` / `up_1h`, which always round up. For a 1h 03min total that produces 1h 15min — a 12-minute over-report the consultant has to correct by hand on every export, while 1h 11min → 1h 15min is exactly what they want. A "nearest" family of rules gives the correct answer in both cases, and one-tap alternatives in the review row make a wrong automatic pick cheap to fix.

## What Changes

- Add `nearest_15m`, `nearest_30m`, `nearest_1h` rounding rules to `remoteRoundingRuleSchema` and `applyRoundingRule` (half-up at the midpoint).
- Add a never-round-to-zero guard: a non-zero total below the increment rounds **up** to one increment instead of collapsing to `0` (which would silently exclude the task from export).
- Keep `none` and the existing `up_*` rules behaving exactly as today (no migration, no data change) — **not** a breaking change.
- Surface the rule in the Remote Sync row as one-tap export-duration suggestions: exact total, floor to increment, ceil to increment.
- Expose the new rules in the remote-system configuration form with translated labels (`en`/`pl`).

## Non-goals

- Per-day or per-task rounding-rule overrides (the rule stays per Client configuration; the user can still override the resulting duration per row).
- Configurable increments or a tolerance parameter on the `up_*` rules.
- Changing which duration is stored locally — rounding stays an export-time concern.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `remote-system-config`: the accepted `roundingRule` values gain the `nearest_*` family, and the rounding function's zero behaviour becomes normative.
- `remote-sync-review`: the manageable row gains rounding suggestions for the editable export duration.

## Impact

- `shared/types/remote-system-config.ts` — `remoteRoundingRuleSchema` enum.
- `shared/utils/rounding.ts` — `applyRoundingRule` (new branch + zero guard).
- `app/composables/useRoundedDurations.ts` — suggestion values per row.
- `app/pages/sync/[date].vue` — suggestion controls in the row.
- Remote-system config form + `i18n/locales/en.json` / `pl.json` labels.
- No database migration: `roundingRule` is stored as text and existing values stay valid.
