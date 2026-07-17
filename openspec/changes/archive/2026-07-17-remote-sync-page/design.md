# Design: remote-sync-page

## Context

Story 11a (`docs/user-stories.md`) adds a per-day, review-only **Remote Sync** page. The foundations exist: `RemoteSystemConfig` stores `roundingRule` (`none | up_15m | up_30m | up_1h`) and `requiredFieldDefaults` (REQ-TTR-101/103); the reusable remote-issue picker Popover ships with the Timer view (REQ-TTR-110); the OpenProject adapter core in `shared/utils/openproject-adapter.ts` is GET-only (title/ID search); remote calls run browser-side (`direct` transport) or via the server proxy (`proxied`); the Timer view already groups entries per day (`app/utils/timerViewGrouping.ts`). Push, push records, and locks are story 11b and out of scope.

## Goals / Non-Goals

**Goals:**

- A `/sync/[date]` page reachable from each Timer-view day header, listing **all** of that day's tasks with an explicit row state (read-only + reason, read-only-but-linkable, manageable).
- Original vs. editable rounded duration per manageable task; rounding applied **once** to the day's sum in a shared utility reused verbatim by 11b; `0` marks the task excluded from a future push.
- OpenProject **activity** selection per manageable task, options fetched via the adapter, pre-filled from `requiredFieldDefaults`.

**Non-Goals:**

- No push, no persistence of edited durations or selected field values, no locks, no previously-used-value pre-fill, no Redmine fetch support (redmine configs render as "not implemented"), no backend-side execution mode.

## Decisions

### D1: One server endpoint for the day-review payload

`GET /api/sync/day?date=YYYY-MM-DD` returns, per task with entries that day: task id/name, project + client names, summed original duration (seconds), the client's config surface needed for state derivation (`systemType`, `roundingRule`, `requiredFieldDefaults`, `transportMode`, `baseUrl`, config id), and the `RemoteIssueRef` (id + cached title) if any, plus the "(no task)" bucket total. The day boundary is computed server-side in the **user's configured timezone** (same rule the Timer view uses).

- *Alternative considered:* reuse the existing Timer-view entries endpoint and derive everything client-side. Rejected: the client would need to join configs and issue refs across several endpoints, and 11b will need the same server-side aggregate anyway.
- Durations are returned in seconds; no rounding server-side — rounding is a UI default computed by the shared utility so the user sees and edits it.

### D2: Row-state derivation is a pure shared function

A pure function maps `{ hasProject, hasClient, config?, systemType, hasIssueRef }` (and, from 11b, `pushed`) to a state enum: `no_client | no_config | system_not_implemented | unlinked | manageable` (11b adds `pushed`). Living in `shared/` keeps it unit-testable and reusable by 11b's push filter.

### D3: Rounding utility in `shared/utils`

`applyRoundingRule(totalSeconds, rule)` implementing the existing enum (`none` passthrough; `up_15m/up_30m/up_1h` round **up** to the next multiple, with an exact multiple unchanged, and `0` staying `0`). Pure, fully unit-tested; 11b reuses it byte-for-byte so the pushed default equals the reviewed default.

- *Alternative:* round server-side. Rejected — the value is a UI default the user may override; keeping the server payload raw avoids double-rounding bugs.

### D4: Editable rounded duration via the existing duration-input pattern

The rounded value renders in an editable duration field (reusing the shared duration/time input component conventions from `shared-ui-components`), committed on blur/Enter, invalid input reverting. `0` is valid and shows a translated "excluded from push" hint. Values are page state only (component state; lost on reload) — deliberately, since persistence is 11b's concern.

### D5: Activities fetched via a new adapter read surface

Extend the OpenProject adapter core with `buildTimeEntryActivitiesRequest(baseUrl)` + `parseTimeEntryActivitiesResults(payload)` targeting the global time-entries schema (`/api/v3/time_entries/schema`, `activity` allowed values), executed through the existing transport selection (direct browser call or server proxy) with the browser-held credential rules unchanged. Options are fetched **once per remote config** on page load and shared across that config's rows.

- *Alternative:* per-work-package form endpoint (`/api/v3/time_entries/form`), which can narrow activities per project. Rejected for 11a: N requests per page, needs a POST-form call, and the global schema is sufficient for a review-only default; 11b can refine if a push is rejected for an inapplicable activity.
- The activity control is a PrimeVue `Select` keyed by activity href/id, pre-selected from `requiredFieldDefaults.activity` when it matches a fetched option; fetch failure shows a translated inline error without blocking the rest of the row.

### D6: Page composition reuses existing pieces

New page `app/pages/sync/[date].vue` (private by default per the global guard), linked from each day header in the Timer view. The unlinked-row inline link action reuses the REQ-TTR-110 picker component; a successful link flips the row to manageable in place (refetch or local patch of the row).

## Risks / Trade-offs

- [Global activities may include options invalid for a specific project] → acceptable for review-only; revisit with the form endpoint in 11b if pushes fail.
- [Page state (edited durations, activities) lost on reload] → explicit 11a scope; a translated hint communicates the review-only nature.
- [Timezone edge: entries near midnight may appear on a different day than expected] → single server-side day-boundary rule shared with the Timer view; e2e coverage for a cross-midnight entry.
- [Config lookup fan-out for days spanning many clients] → one aggregate endpoint (D1) keeps it a single round-trip.

## Open Questions

- None blocking; per-project activity narrowing deferred to 11b.
