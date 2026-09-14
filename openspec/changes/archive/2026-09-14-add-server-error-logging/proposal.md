## Why

A production container currently logs nothing beyond "listening on :3000": Nitro only prints errors it considers *unhandled*, so every `createError` (ours and `nuxt-security`'s) is silent. Today an `Import history` run failed with a bare `400 Bad Request` and there was no way to tell why. The cause (reproduced locally with a `<` in a timer title) is itself a bug: `nuxt-security`'s `xssValidator` rejects any JSON body containing `<` or `>` (e.g. `List<T>`, `a > b` in a remote comment), which blocks both import and manual entry of ordinary IT text.

## What Changes

- **Server error logging.** A Nitro server plugin hooks `error` and logs every request error to stdout: method, path, status, and `messageKey` for 4xx (`warn`); stack and `cause` for 5xx and unhandled throws (`error`). Request bodies, headers, and cookies are never logged (they carry passwords and tracker API keys).
- **Direct logging in code** via `consola` (added as a direct dependency of `apps/web`, no wrapper): `debug`/`info`/`warn`/`error` where it helps investigation — DB pool failures, import/export summaries. Drizzle query logging is enabled at `debug` level only.
- **Log level from environment.** `CONSOLA_LEVEL` (default `info`) is documented in `.env.example` and wired through `docker-compose.prod.yml`, so a self-hoster can raise it to `debug`/`trace` without rebuilding.
- **Disable `xssValidator`.** Every API body is JSON stored verbatim and rendered through Vue templates (escaped on output) under CSP; the validator adds no protection and corrupts legitimate text. Free-text fields SHALL accept any characters.

## Capabilities

### New Capabilities

- `server-logging`: what the server logs on request errors and at each level, what is never logged, and how the level is configured at runtime.

### Modified Capabilities

- `api-endpoint-conventions`: free-text request fields accept any characters; no request-level content filtering rejects a body.
- `docker-deployment`: optional `CONSOLA_LEVEL` runtime variable (REQ-045 / REQ-346).

## Non-goals

- Access/request logging for successful requests.
- Structured JSON logs, log shipping, or a logger abstraction (`pino`, custom wrapper).
- Client-side sanitization or transformation of imported remote text.
- Request ids / correlation across log lines (can follow if debug logs prove hard to read).

## Impact

- `apps/web/nuxt.config.ts` (`security.xssValidator: false`), `apps/web/package.json` (`consola`), new `server/plugins/error-logging.ts`, `server/db/client.ts` (Drizzle logger at debug).
- `.env.example`, `docker-compose.prod.yml`, `README.md`.
- Tests: unit test for the error-hook formatting/redaction; e2e-api round-trip of a title and comment containing `<` and `>`.
