## Context

The `refactor-remote-adapter-layers` change established a four-layer remote architecture: feature composables (L1) → `RemoteTrackerAdapter` (L2, neutral) → provider client (L3) → `Transport` (L4). `OpenProjectAdapter`/`OpenProjectClient` are the only implementation; Redmine is a valid `systemType` gated by explicit `systemNotImplemented`/409/disabled-picker checks. Because the adapter lives in `shared/` and both execution-mode factories (`app/utils/remote/create-remote-adapter.ts`, `server/utils/remote/create-server-remote-adapter.ts`) reuse it, a `RedmineAdapter` + `RedmineClient` pair automatically works in both `client` and `server` execution modes.

Three "OpenProject-nesses" leaked into neutral layers and must be fixed as part of this change:
1. Both transports hard-code `Basic base64(apikey:<secret>)` auth.
2. `server/utils/remote-issue-refs.ts` derives issue URLs via the OpenProject-shaped `deriveIssueUrl` (`/work_packages/<id>`); Redmine needs `/issues/<id>`.
3. `normalizeBaseUrl` is generic but lives under `shared/remote/openproject/utils.ts`.

## Goals / Non-Goals

**Goals:**
- Full `RemoteTrackerAdapter` implementation for Redmine, behaviorally symmetric with OpenProject (same neutral DTOs, same error contract, same quirk conventions: 404-on-id → `null`, unauthorized/forbidden mapped to the shared error keys).
- Provider-agnostic transports; each L3 client owns its auth-header shape, keeping "the secret is attached in exactly one place" per provider.
- Abstraction-based (not if/else-based) issue-URL derivation.
- Identical rounding semantics across providers: rounding happens once, upstream, via `applyRoundingRule`; adapters only convert units at the wire.

**Non-Goals:**
- Per-project activity overrides; project-scoped Redmine metadata.
- Server-side credential storage or any auth-flow change beyond header construction.
- Rewriting `remote-sync-review`/`remote-issue-proxy` specs into fully provider-neutral wording (follow-up candidate).

## Decisions

### D1: Redmine endpoint mapping
| Neutral operation | Redmine REST endpoint | Notes |
| --- | --- | --- |
| `searchIssues(query)` | `GET /issues.json?subject=~<term>&status_id=*&limit=25` | plain JSON (no HAL); same 25-result cap as OpenProject; `status_id=*` includes closed issues |
| `getIssueById(id)` | `GET /issues/<id>.json` | 404 → `null` (same convention as OpenProject) |
| `getActivityOptions(remoteIssueId)` | `GET /enumerations/time_entry_activities.json` | global list; the `remoteIssueId` argument is accepted per the interface but unused |
| `getCurrentAccount()` | `GET /users/current.json` | name composed as `firstname + ' ' + lastname` |
| `fetchTimeLogs({spentOn, ids, userId})` | `GET /time_entries.json?spent_on=<date>&user_id=<id|me>&issue_id=<csv>` | offset/limit pagination driven by `total_count`; bounded page loop like OpenProject's `OPENPROJECT_TIME_LOGS_MAX_PAGES` |
| `createTimeEntry(...)` | `POST /time_entries.json` with `{ time_entry: { issue_id, spent_on, hours, activity_id, comments } }` | decimal hours (see D2) |

### D2: Duration conversion at the wire boundary only
Rounding remains exactly where it is today: `applyRoundingRule` (shared, `none`/`up_15m`/`up_30m`/`up_1h`) applied once upstream; the adapter receives already-rounded `durationSeconds`. The Redmine client converts on write with `hours = Math.round(durationSeconds / 36) / 100` (0.01 h precision) and on read with `seconds = Math.round(hours * 3600)`. All `up_*` rules produce exact 0.25-multiples, so conversion is lossless for them; only `none` can lose sub-36-second precision, which is acceptable because remote systems do not need second-level accuracy. The round-trip is stable at 0.01 h granularity, so sync-review comparisons do not flap.

### D3: Auth headers are the L3 client's responsibility
`RemoteRequest` drops `secret?: string | null` and gains `headers?: Record<string, string>`. Each provider client builds its own auth header in one private helper: OpenProject `Authorization: Basic base64("apikey:" + secret)` (the `btoa`/`Buffer` fallback moves from the transports to next to the OpenProject client), Redmine `X-Redmine-API-Key: <secret>`. Transports only merge `request.headers` into the outgoing request and keep `Accept`/`Content-Type` handling. Alternative considered: an `authScheme` hint on `RemoteRequest` interpreted by the transport — rejected because it keeps provider knowledge in L4 and grows a switch there. Credential-hygiene invariant unchanged: headers are never logged, serialized, or persisted.

### D4: Issue-URL derivation via a per-provider dispatch table
Add `shared/remote/issue-url.ts` exporting `deriveIssueUrl(systemType, baseUrl, remoteIssueId)` backed by a `Record<RemoteSystemType, (baseUrl, id) => string>` table (`openproject` → `/work_packages/<id>`, `redmine` → `/issues/<id>`). A data-driven table is the abstraction: adding provider #3 is one map entry, no if/else chains. `server/utils/remote-issue-refs.ts` switches to this helper using the row's `systemType`. Alternative considered: a `deriveIssueUrl` method on `RemoteTrackerAdapter` — rejected because the consumer only holds `systemType` + `baseUrl` from the DB and constructing a full adapter (transport included) just to build a string is disproportionate.

### D5: `normalizeBaseUrl` moves to a neutral shared location
Relocate to `shared/utils/` (imported by both provider utils, both factories, and the server transport); `shared/remote/openproject/utils.ts` keeps only genuinely OpenProject-shaped helpers (`parseOpenProjectDuration`, `formatOpenProjectDuration`, `hrefId`).

### D6: Gate removal is part of this change, not a follow-up
Factories gain `case 'redmine'`; `tasks/[id]/remote-issue-ref.post.ts` drops the `error.remoteIssueConfigNotOpenProject` 409 (linking requires any active supported configuration); `TimerTaskGroup.vue` drops the `isRedmineConfig` disabled state; the `editDisabledRedmine` key is removed from `en.json`/`pl.json` together. Spec-wise, REQ-TTR-110's "Redmine search is unavailable" scenario is replaced, not merely contradicted.

## Risks / Trade-offs

- [Redmine `subject=~` filter behavior varies slightly across versions] → verified against the pinned dev-environment image (`redmine:6`); unit tests assert our request shape, not Redmine internals.
- [Global activities may not match a project's overridden set] → accepted for MVP (decision); a wrong activity id yields a 422 from Redmine mapped to the shared translated error contract.
- [`none` rounding rule loses sub-36 s precision on export] → accepted (decision: seconds are not needed remotely); documented in D2.
- [Auth-header refactor touches the OpenProject path] → existing OpenProject unit/e2e suites guard against regression; the header value is byte-identical, only its construction site moves.
- [Offset/limit pagination can loop on inconsistent `total_count`] → bounded by a fixed max-pages constant mirroring the OpenProject client.
