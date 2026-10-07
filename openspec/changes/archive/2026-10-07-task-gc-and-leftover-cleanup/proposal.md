# Proposal

## Why

Retitling an entry, or rebinding it to another task, leaves the previous task behind when that was its last entry, and the orphan keeps showing up in autocomplete. The spec states garbage collection per endpoint, not as one rule. The same audit found leftovers that serve nothing any more: dead rounding-suggestion code, PrimeVue lint config, an unused test hook, error keys named after the removed server mode, an `executionMode` guard, migration-only requirements, and tests that only prove deleted routes stay deleted.

## What Changes

- A task left with no entries is hard-deleted in the same transaction, whatever operation emptied it, including an entry patch. Existing orphans are not migrated away.
- The required merge checks include the package, extension, coverage and spec-validation checks.
- A tracker request carrying `executionMode` is treated like any other unknown field instead of being rejected.
- `/api/user/settings` and `/settings` stay absent, without dedicated guarantees or tests.
- `error.remoteServerMode*` keys are renamed to `error.remoteTracker*`.
- Removed without behavior change: rounding-suggestion helpers, PrimeVue ESLint entries, the hidden day-total hook on Remote Sync, the source-scanning zod idiom test and the `transportMode` absence test.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

OpenSpec cannot drop a scenario through MODIFIED, so a requirement that loses one is retired and re-added under the next free code.

- `workspace-tasks`: REQ-132 → REQ-491, one garbage-collection rule.
- `tracking-api`: REQ-447 gains scenarios for collecting the previous task.
- `platform-ci`: REQ-406 lists every required check.
- `workspace-trackers`: REQ-245 → REQ-492 and REQ-249 → REQ-495 without the scenarios about the removed server mode; migration-only REQ-314 and REQ-364 removed.
- `workspace-settings`: REQ-399 → REQ-493 and REQ-400 → REQ-494 without the former-settings guarantees.
- `core-i18n`: REQ-401 points to REQ-494.

## Non-goals

- Deleting orphan tasks that already exist.
- Other migration-only requirements (REQ-397, REQ-398, REQ-444) and the week-start scenarios.
- A wider dead-code scan (unused i18n keys or exports).
- Making coverage figures blocking.

## Impact

- Server: time-entry delete, reassign and patch handlers; profile handlers (REQ comments).
- Shared and app: tracker schema, rounding utilities, `use-rounded-durations`, the warmup plugin, the Remote Sync page.
- Packages: error keys in `remote-trackers` and `extension-protocol`; `en`/`pl` catalogs.
- Config and docs: `eslint.config.mjs`, `docs/development.md`, `docs/retired-requirements.md`.
- GitHub ruleset on `main`: the owner adds the new required checks.
