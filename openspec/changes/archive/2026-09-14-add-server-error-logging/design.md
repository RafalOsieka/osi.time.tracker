## Context

See proposal.md — Why. Relevant facts observed in the current code and its dependencies:

- Nitro's production error handler (`nitropack/runtime/internal/error/prod.mjs`) calls `console.error` only when `error.unhandled || error.fatal`. h3 sets `unhandled` only for thrown values that are not `H3Error`, so every `createError(...)` — ours and `nuxt-security`'s — is silent. Unhandled throws (driver errors, `TypeError`) are already logged once as `[request error] [unhandled] [METHOD] url` with the stack.
- `createNitroApp` calls `hooks.callHookParallel('error', error, { event, tags })` for every h3 error before the error handler runs. A server plugin can subscribe with `nitroApp.hooks.hook('error', ...)`.
- `nuxt-security` 2.6 registers `xssValidator` middleware for `GET`/`POST`; it `JSON.stringify`s the body/query, runs it through the `xss` package (whose default `escapeHtml` rewrites `<`/`>`) and throws a bare `createError({ statusCode: 400 })` when the output differs. Reproduced locally with a `<` in a timer title.
- `consola` 3.4.2 is already in the lockfile as a Nitro/Nuxt dependency, but not resolvable from `apps/web` (no hoisting). Its default instance reads `CONSOLA_LEVEL` at import time with `Number.parseInt(...) ?? level`, so a non-numeric value yields `NaN`, not the default.
- The server has no logging of its own today except `migrate.ts`.

## Goals / Non-Goals

**Goals:**

- One place that sees every request error and logs it in a fixed, greppable shape.
- Plain `consola` calls anywhere in `server/` for progress/diagnostics, filtered by a single runtime level.
- Nothing secret can end up in a log line by construction (we never pass bodies, headers or config into the logger).

**Non-Goals:**

- A logger abstraction, structured/JSON output, request ids, access logging (proposal Non-goals).
- Replacing Nitro's error *response* handler; the `{ messageKey, params }` contract is untouched.

## Decisions

### D1. Nitro `error` hook in a server plugin, not middleware or a custom error handler

`server/plugins/error-logging.ts` subscribes to `nitroApp.hooks.hook('error', ...)`. It logs `H3Error`s (both 4xx and 5xx) and **skips** errors flagged `unhandled`/`fatal`, because Nitro already prints those once with the stack — this is what satisfies "logged exactly once" (REQ-355).

- *Middleware* runs before handlers and cannot observe a handler's throw. Rejected.
- *Custom `nitro.errorHandler`* would let us own both the log line and the response, but replaces Nitro's body formatting and 404/baseURL redirect logic — more surface for a logging change. Rejected; can be revisited if the hook proves insufficient.

The formatting lives in a pure function (`server/utils/request-error-log.ts`, e.g. `describeRequestError(error, { method, path })` → `{ level, message, error? }`) so it is unit-testable without booting Nitro; the plugin is glue.

`error.data` is `unknown` (`H3Error<DataT = unknown>`), so it is parsed with a small zod schema (`z.object({ messageKey: z.string().regex(...), params: z.record(...).optional() })`) rather than hand-rolled `typeof`/`in` narrowing — consistent with the project's boundary-parsing convention (CODING_STANDARDS) and required by the repo's anti-slop lint rules (`no-unknown-parameters`, `no-runtime-typeof`, `no-unsafe-dictionary-type` all reject ad hoc narrowing of an `unknown` value). The parse is atomic: if `data` matches the shape except for one non-primitive `params` value, the **whole** `data` is rejected (falling back to a bare `[METHOD] path -> status` line) rather than salvaging the valid parts — simpler than partial recovery and still safe, since nothing malformed ever reaches the log either way. An extra property alongside a valid `messageKey` (e.g. an accidentally-attached `apiKey`) is silently stripped by zod's default object parsing, not treated as a parse failure, so the messageKey itself still prints.

Line shape: `[POST] /api/trackers/abc/import -> 422 error.remoteLogImportProjectNotBound`. `messageKey` is read from `error.data` when it matches `ApiMessage`; `params` are appended when present (they are `string | number | boolean` by contract, never user secrets). Path comes from `event.path` with the query string stripped. Nothing else from the event is touched.

### D2. `consola` directly, added as a dependency of `apps/web`; no wrapper

`pnpm --filter @osi/time-tracker add consola` pins the version already in the lockfile. Code imports `consola` (or `consola.withTag('import')` where a prefix helps). A `server/utils/logger.ts` re-export would be a one-line wrapper with no behaviour — rejected per project style. Swapping to `pino` later is a mechanical import change.

- *`@nuxt/kit` `useLogger`*: build-time only, not available in the Nitro runtime bundle. Rejected.
- *`pino`*: structured JSON and redaction built in, but a new dependency and a second logging style next to Nitro's own consola output. Not needed until logs are shipped somewhere. Rejected for now.

### D3. Level from `CONSOLA_LEVEL`, sanitized at startup

consola's own env handling is used (no custom parsing): `0` fatal/error, `1` warn, `2` log, `3` info (default), `4` debug, `5` trace. The error-logging plugin guards the `NaN` case once at startup (`if (!Number.isFinite(consola.level)) consola.level = 3`) so a typo degrades to `info` rather than to silence (REQ-357 "invalid level falls back"). `.env.example` documents the numeric mapping; `docker-compose.prod.yml` forwards `CONSOLA_LEVEL: ${CONSOLA_LEVEL:-3}` to `app`.

- *A named level (`LOG_LEVEL=debug`) mapped to numbers*: friendlier, but that is a wrapper again and diverges from what consola documents. Rejected.

### D4. Drizzle query logging via a two-line `Logger` calling `consola.debug`

`createDatabaseClient` gains a `logger?: boolean` option (default `true`) and, when enabled, passes `{ logger: { logQuery(query, params) { consola.debug(...) } } }`. Drizzle's `DefaultLogger` writes through `console.log` unconditionally, so it cannot be gated by level; a custom logger routes through consola and inherits the filter. Statements and bound parameters are logged; the connection string is never part of a query so it never appears.

The migrator (`migrate.ts`) passes `{ logger: false }` and keeps its explicit `console.*` lines — it is a separate process with its own lifecycle. This is not optional: the implementation sweep (tasks 4.2) found that the bootstrap-user insert in `migrate.ts` binds the new user's `passwordHash` as a query parameter, which the debug-level query logger would otherwise print verbatim. A password hash is a credential-derived secret REQ-356 forbids logging at any level, so the migrator's client opts out of query logging entirely rather than trying to redact individual parameter values (the `Logger.logQuery(query, params)` interface gives positional values with no column names, so column-aware redaction isn't possible at this layer). Application routes never bind a raw password or hash into a query outside this one insert (login compares in-process against the selected hash; no route updates it), so no equivalent opt-out is needed there.

### D5. Disable `xssValidator` globally

`security: { xssValidator: false }` in `nuxt.config.ts`. Every API body is JSON persisted verbatim; output goes through Vue template interpolation (escaped) under the existing CSP (REQ-011). The validator provides no protection for this shape of app and rejects ordinary text (`List<T>`, `a > b`).

- *Route-rule disable for `/api/**` only*: keeps the validator on SSR page requests, which carry no bodies we read. Same effect with more config. Rejected for simplicity.
- *Client-side rewriting of `<`/`>` before submit*: corrupts stored data and task names, and does not fix typed titles. Rejected.

### D6. Direct log calls added in this change

Kept deliberately small: `info` summary at the end of a remote-log import (counts per outcome, no titles), `error` when the Postgres pool reports a connection error, and `warn` in the auth helper when a session is present but the user row is missing (if such a branch exists at implementation time). Further call sites are added ad hoc as investigations need them.

## Risks / Trade-offs

- [Two consola instances: Nitro's bundled copy vs ours, so `consola.level` set in the plugin might not affect Nitro's own output] → Same package/version resolves once in the Nitro bundle; verify in the e2e test that a level change affects both our lines and Nitro's. If they diverge, fall back to setting the level via the env var only (which both instances read).
- [Noise from 404s on unknown paths and from rate-limit 429s appearing as `warn`] → Acceptable for a single-user instance; the line shape is greppable. Downgrade 404 to `info` if it proves annoying.
- [`callHookParallel` swallows hook rejections with a console message] → The hook never awaits anything and formats defensively (`error.data` may be anything), so it cannot reject.
- [Disabling `xssValidator` removes a defence layer] → It was never a layer for this app: input is JSON, output is escaped, CSP forbids inline script. A round-trip e2e test with `<script>` in a project name plus a UI assertion that it renders as text pins the actual defence.
- [Debug-level query logging on a busy instance is verbose] → Off by default; documented as troubleshooting-only.

## Migration Plan

No data migration. Deploy: rebuild the image (new dependency, new plugin), add the optional `CONSOLA_LEVEL` line to `.env`. Rollback: previous image; the env var is ignored by it.
