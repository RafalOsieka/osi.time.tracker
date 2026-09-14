All tasks are backend/infrastructure; there is no frontend code change. The e2e harness boots the server through `@nuxt/test-utils` without capturing its stdout, so log *content* is verified by unit tests on the pure formatting functions and the wiring is verified manually against a running server (tasks 5.x).

## 1. Fix: free text accepts `<` / `>` (REQ-353)

- [x] 1.1 Set `security.xssValidator: false` in `apps/web/nuxt.config.ts` with a comment pointing at REQ-353 and design D5; verify `pnpm dev` + `POST /api/time-entries` with title `a<b` returns 201 instead of 400
- [x] 1.2 Add e2e-api tests in `apps/web/test/e2e/api/time-entries.spec.ts` (title `Fix List<string> serialization > 0` round-trips on create and on `GET /api/time-entries/running`) and `trackers-import.spec.ts` (a log with comment `<review> a > b` imports and yields a task with that exact name); verify `pnpm test:e2e:api` passes
- [x] 1.3 Add an e2e-ui assertion in `apps/web/test/e2e/ui/projects-ui.spec.ts` that a project named `<script>alert(1)</script>` is created and rendered as literal text (no dialog, `textContent` equals the name); verify `pnpm test:e2e:ui` passes

## 2. Logging foundation

- [x] 2.1 Add `consola` to `apps/web/package.json` via `pnpm --filter @osi/time-tracker add consola` (same version as the lockfile already pins); verify `pnpm install --frozen-lockfile` succeeds and `pnpm type-check` resolves `import { consola } from 'consola'` from `server/`
- [x] 2.2 Create `apps/web/server/utils/request-error-log.ts` exporting `describeRequestError(error, { method, path })` per design D1: returns `null` for `unhandled`/`fatal` errors, `{ level: 'warn', message }` for 4xx, `{ level: 'error', message, error }` for 5xx; message shape `[METHOD] /path -> status messageKey {params}`; reads `messageKey`/`params` only from `error.data` when it matches `ApiMessage`; verify by the unit test in 2.3
- [x] 2.3 Add `apps/web/test/unit/request-error-log.spec.ts` covering: 400 without `data` (middleware rejection), 422 with `messageKey` + primitive `params`, 500 `createError` with `cause`, unhandled error returns `null`, non-`ApiMessage` `data` is ignored, and a body-like object passed as `data` never appears in the message; verify `pnpm test:unit` passes
- [x] 2.4 Create `apps/web/server/plugins/error-logging.ts`: on startup guard `consola.level` against `NaN` (fallback `3`), then `nitroApp.hooks.hook('error', ...)` that strips the query string from `event.path`, calls `describeRequestError` and emits via `consola.warn` / `consola.error`; verify with `pnpm dev`: `POST /api/projects` with an invalid body prints one `warn` line with `422` and its `messageKey`, and a thrown `TypeError` in a scratch route prints exactly one stack (Nitro's), not two
- [x] 2.5 Add `apps/web/test/unit/log-level.spec.ts` for the level guard (numeric env respected, non-numeric falls back to `3`) — extract the guard into `server/utils/log-level.ts` if needed to keep it testable without Nitro; verify `pnpm test:unit` passes

## 3. Database visibility

- [x] 3.1 In `apps/web/server/db/client.ts` pass a Drizzle `logger` whose `logQuery` calls `consola.debug` with the statement and parameters (design D4), and route postgres.js's `onnotice` through `consola.debug` too (a connection-level "error" hook doesn't exist in postgres.js — a failed query already surfaces as a thrown error through the normal request path and gets logged by the error-logging plugin); verified via the `createQueryLogger`/`createDatabaseClient` unit tests (task 3.2) and a manual run confirming the default level (`info`) produces no query output
- [x] 3.2 Extend `apps/web/test/unit/db-client.spec.ts`: the query logger forwards `(query, params)` to `consola.debug` and never includes the connection string; verify `pnpm test:unit` passes

## 4. Direct log calls (design D6)

- [x] 4.1 Emit a `consola.withTag('import').info` summary at the end of `POST /api/trackers/[id]/import` (dry-run flag, project count, imported/wouldImport/skippedExisting totals — the DTO's actual fields; no titles or comments); verified via `pnpm test:e2e:api` (`trackers-import.spec.ts`, 14/14 passing with the call in place) and a manual server start showing no crash
- [x] 4.2 Sweep every new `consola.*` call site (`grep -rn "consola\." apps/web/server`) for anything that could receive a body, API key, or password (REQ-356). Found: `migrate.ts`'s bootstrap-user insert binds `passwordHash` as a query parameter, which `createQueryLogger` would print at debug level. Fixed by giving `createDatabaseClient` a `logger?: boolean` option (default `true`) and having the migrator pass `{ logger: false }` (design D4); no other route binds a raw password or key into a query. Verified by `pnpm test:unit` (new `createDatabaseClient logger option` cases) and `pnpm test:e2e:db` (migrator still bootstraps correctly with logging off)

## 5. Runtime configuration and docs

- [x] 5.1 Add `CONSOLA_LEVEL: ${CONSOLA_LEVEL:-3}` to the `app` service in `docker-compose.prod.yml` and a commented `# CONSOLA_LEVEL=3` entry with the `0..5` mapping in the production section of `.env.example` (REQ-354); verify `docker compose -f docker-compose.prod.yml config` renders the variable with and without it set in `.env`
- [x] 5.2 Document the variable and the log line shape in `README.md` (environment table + a short "Troubleshooting: reading container logs" note) and add the `CONSOLA_LEVEL` row to the `AGENTS.md` environment table; verify `pnpm format:check` and `pnpm lint` pass
- [x] 5.3 End-to-end manual check on the prod stack: `docker compose -f docker-compose.prod.yml up -d --build`, trigger a 422 and a title with `<`, and confirm `docker logs` shows the `warn` line for the 422 and nothing for the successful `<` request; then set `CONSOLA_LEVEL=4`, restart only `app`, and confirm SQL statements appear without a rebuild (REQ-357, REQ-354)
