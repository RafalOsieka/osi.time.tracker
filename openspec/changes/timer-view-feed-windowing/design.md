## Context

See proposal.md for motivation. Today `app/pages/index.vue` builds a client-only, week-aligned window via `computeWindowRange` + `GET /api/time-entries/latest` + `GET /api/time-entries?from&to`, with an anchored-week banner and always-visible load more. `weekStart` exists on `users`, session, and settings primarily for that window. Timezone **is** already stored (`users.timezone`, session); feed day math will use it (else `UTC`).

## Goals / Non-Goals

**Goals:**
- Server-owned timer feed: 30 calendar days → newest activity day fallback → empty.
- Activity-day pagination (7 days with entries) + `hasMore`.
- SSR initial feed; page-level add entry with date + smart include.
- Remove weekStart end-to-end and client anchor/banner machinery.

**Non-Goals:**
- Group/row/bulk UX polish; auto-save browser TZ; weekly reports; full hydration perfection for null TZ beyond existing UTC-then-upgrade pattern.

## Decisions

### 1. Dedicated feed endpoint vs overloading range list

| Option | Notes |
|--------|--------|
| **A. `GET /api/time-entries/feed`** | Clear contract: `entries`, `hasMore`, `nextBefore`; server TZ day logic isolated | **chosen** |
| B. Query flags on `GET /api/time-entries` | Couples pure range (REQ-148) to feed semantics; harder to evolve |
| C. Client multi-fetch until 7 activity days | Bad UX under sparse history; many round-trips |

Keep REQ-148 range endpoint for any non-feed callers; timer view uses only the feed. Remove `GET /api/time-entries/latest` once unused.

### 2. Feed timezone

- Stored `user.timezone` if set, else **`UTC`** (same as SSR effective timezone when unset).
- Do **not** accept a client-supplied timezone query for MVP (avoids spoofed windows; user can save TZ in settings).
- After client mount with null TZ, display regroup may differ slightly from SSR UTC buckets — accepted; fix later if painful.

### 3. Cursor shape

- Prefer `nextBefore` = exclusive upper bound for older pages: ISO instant of the start of the oldest **loaded** local day (or min `startedAt` on that day). Load-more selects activity days with day-start `< cursor`.
- Document as opaque-to-client: client only round-trips the string.

### 4. Initial algorithm (server)

```
if no entries → empty
else
  entries30 = entries with localDay in [today-29, today]
  if entries30 non-empty → return entries30 + hasMore
  else → return all entries on localDay(max(startedAt)) + hasMore
```

"All entries on day" includes multiple tasks that day.

### 5. Client page model

- `useAsyncData` + `useRequestFetch` for initial feed (SSR).
- Client state: `entries[]`, `hasMore`, `nextBefore`; load more appends + dedupes by id.
- Drop: `windowDays`, `anchorStartedAt`, `forceCurrentWeek`, banner, empty-window state, per-day add.
- Header: reuse `TableHeader` (title + create).
- `TimerAddEntryDialog`: add date field (default today via effective TZ); parent opens without pre-set day; on `added`, merge/smart-include day then refresh running if needed.
- Running entry still merged into display list from `useTimer` as today.

### 6. weekStart removal

- Drizzle schema drop `week_start` + SQL migration.
- Session/login DTO, zod schemas, settings UI/i18n, `DateTimeSettings.weekStart`, `computeWindowRange` week alignment (replace with simple rolling-day helpers used only if still needed client-side; prefer server feed so client may only group).
- Tests/e2e that set `weekStart` updated.

### 7. Smart include

After successful manual create: if `localDayKey(entry)` not in loaded days, append entry to client list (and optionally light refresh of feed metadata / recompute `hasMore` via small refetch or leave `hasMore` unchanged if new day is newer than cursor). Prefer: merge entry into local array + if day was older than current oldest and we didn't load intermediates, still show that day (sparse list OK); re-fetch `hasMore` only when uncertain — simplest reliable approach is **refresh initial feed or append + call feed with `before` only when needed**. Practical MVP: **merge entry into list** and if its day is outside loaded set, keep `hasMore` as-is unless the new day is older than oldest loaded day (then that day is now loaded; `hasMore` = EXISTS older — best-effort `GET feed?before=` head or dedicated flag later). Spec requires visibility; implementers may full-refresh feed after add if simpler and still SSR-compatible on next navigation.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Null TZ → SSR UTC vs browser day shift | Documented; encourage saving TZ; same pattern as shell |
| Activity-day SQL cost | Index on `(userId, startedAt)`; implement day walk carefully (fetch candidates by startedAt desc, bucket in app code) |
| Breaking settings clients expecting weekStart | Single-app; migration + session shape update in one deploy |
| Smart-include edge cases | Prefer correct visibility over perfect hasMore; tests for out-of-window date |

## Migration Plan

1. Ship migration dropping `week_start` with app that no longer reads it (same release).
2. Deploy feed + page; remove latest route.
3. No data backfill required for entries.
4. Rollback: reverse migration only if old binary still required (avoid dual-write complexity; treat as forward-only).

## Open Questions

None material — deferred: whether to delete REQ-148 range usage entirely if no remaining callers (cleanup if grepping finds none).
