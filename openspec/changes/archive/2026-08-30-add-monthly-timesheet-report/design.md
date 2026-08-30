## Context

See proposal.md for motivation. `/reports` is a coming-soon placeholder; sidebar already links there. Local hours live in `time_entries` (UTC instants). Finalized pushes live in append-only `remote_exports` (`localDate`, `remoteLogId`, `exportDurationSeconds`) with no `trackerId`. Live remote hours exist only via the adapter, and today's `fetchTimeLogs` is one calendar day plus a required issue-id list — enough for Remote Sync, not for a month of “everything on my account.” Execution-mode and credential rules (`client` secret stays in the browser; `server` secret is per-request proxy) apply unchanged. Day math must use Temporal and the same timezone fallback as the timer feed (stored TZ, else `UTC` on the server).

## Goals / Non-Goals

**Goals:**

- Hub at `/reports` and monthly timesheet at `/reports/monthly`.
- Server-owned local + export aggregation for one month; client-owned live range fetch per tracker; App/Direct by `remoteLogId`.
- One new contract operation; both providers and the server-mode proxy implement it.
- Attention and `H:MM` as specified; no schema migration.

**Non-Goals:**

- Product non-goals in proposal.md (nested nav, other reports, click-through, cache, column hide).
- Changing same-day `fetchTimeLogs` semantics.
- Adding `trackerId` on `remote_exports` (live id-match is enough for App/Direct).

## Decisions

### 1. Routes: hub index + monthly child

| Option | Notes |
|--------|--------|
| **A. `app/pages/reports/index.vue` + `reports/monthly.vue`** | Replaces `reports.vue`; sidebar `/reports` stays; room for later reports | **chosen** |
| B. `/reports` is the monthly page | Blocks a hub without a breaking URL later |
| C. Query `?type=monthly` on one page | Mixes unrelated UIs |

Nuxt: remove `app/pages/reports.vue` so it does not conflict with the `reports/` directory.

### 2. Dedicated monthly aggregation endpoint

| Option | Notes |
|--------|--------|
| **A. `GET /api/reports/monthly?month=YYYY-MM`** | Server TZ bucketing, isolation, one round-trip | **chosen** |
| B. Client `GET /api/time-entries?from&to` + a new exports list | Duplicates feed-style TZ logic in the browser; large payloads |
| C. Client timezone query param | Spoofable window; rejected for the timer feed too |

Payload (zod in `shared/types`): `month`, `timezone`, `trackers[]` (active id+name), `days[]` `{ date, localSeconds }` only where local > 0, `exports[]` `{ localDate, remoteLogId, exportDurationSeconds }` for the month. Client unions local days with remote `spentOn` days. Validate `month` with a `YYYY-MM` calendar-month schema; 422 via `mapZodError`. `requireAuth`; `getDb()` once; no CSRF (GET).

Reuse `localDayKey` from `server/utils/timer-view-feed.ts` (or extract if that import is awkward). Month bounds: first instant of `YYYY-MM-01` through first instant of the next month in the feed timezone; select stopped entries with `startedAt` in that half-open range (a start just inside the month counts even if `stoppedAt` is after).

### 3. New adapter method, new proxy route

```
fetchTimeLogsInRange({ from: YYYY-MM-DD, to: YYYY-MM-DD, userId?: string })
  -> RemoteTimeLogDto[]
```

Keep `fetchTimeLogs({ spentOn, workPackageIds, userId? })` for Sync.

| Option | Notes |
|--------|--------|
| **A. Seventh contract operation + `POST /api/remote/time-logs-range`** | No issue-id filter; does not overload the existing body schema | **chosen** |
| B. Loop same-day fetch 28–31 times | Forbidden by spec; misses unlinked issues |
| C. Optional `from`/`to` on the existing time-logs POST | Dual-mode handler; easy to pass an empty issue list by mistake |

OpenProject: `spent_on` operator `<>d` with `[from, to]`; omit `entity_id`; keep `entity_type=WorkPackage` if meetings should stay out (same as same-day). Redmine: `from`/`to` plus `user_id=me` (or resolved id); omit `issue_id`. Same page cap (50) and page size as today. Wire `fetchTimeLogsInRange` through `useRemoteSyncClient` (or a thin reports client that shares adapter construction), `server-execution-adapter`, and both provider adapters.

### 4. App vs Direct in a pure helper

Input: month logs + set of `remoteLogId` from the aggregation `exports[]`. Per tracker per `spentOn`: App = sum of logs whose id is in the set; Direct = the rest. Do not sum `exportDurationSeconds` for App (re-exports and rounding would lie). Helper lives in `shared/utils` and is unit-tested. Attention helper is a second pure function (Direct, unexported, remote-only, fetch-failed); rounding-only is not attention.

### 5. UI composition

- Hub: Nuxt UI cards (`UPageCard` or dashboard card); one monthly card.
- Monthly: shared page header; prev/next + month label; `UTable` with grouped tracker headers. Format with `formatReportDuration(seconds)` → unpadded `H:MM` (floor to minutes). Do not reuse `formatDuration` (`HH:MM:SS`).
- Tracker fetch error: em-dash or error icon in that group, tooltip + `aria-label`, never `0:00`.
- Attention: warning color token + `i-lucide-*` icon + themed tooltip (REQ-269).
- Secrets: same as Sync — local table SSR via `useAsyncData` + `useRequestFetch`; remote columns hydrate client-side. Missing secret = per-tracker error state.

### 6. Tests

- Unit: month schema; local bucketing (midnight, running, isolation); range query builders; App/Direct; attention; `H:MM`.
- E2E API: monthly GET happy path, 422, 401, user isolation (mock remotes unused here).
- E2E UI: hub not placeholder; month default/query; empty state; table days/columns with seeded local data; `page.route` for range logs (App vs Direct). No live OpenProject/Redmine.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Range fetch volume / 50-page cap | Same bound as same-day; typical month << cap; surface truncation only if we later see it |
| `remote_exports` without `trackerId` | Match ids against each tracker's live logs; an id cannot appear on two systems |
| Client-mode secret missing | Column error, not zeros; same as Sync |
| Wide table with many trackers | Horizontal scroll; show/hide is a later non-goal |
| OpenProject `entity_type=WorkPackage` hiding meeting time | Consistent with same-day fetch; document; revisit if users log time on meetings |
| SSR UTC vs browser TZ when unset | Same as timer feed; saving TZ removes the gap |

## Migration Plan

No database migration. Deploy is backward compatible: old same-day proxy remains. Rollback is revert; `/reports` would become a hub-less tree only if the placeholder file is restored. Update shell e2e that waits on `placeholder-page-reports` in the same change.

## Open Questions

None that affect specs or the task breakdown. Nested sidebar grouping stays a later iteration as agreed.
