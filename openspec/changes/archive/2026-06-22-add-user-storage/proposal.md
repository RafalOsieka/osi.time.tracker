## Why

The login endpoint (`server/api/auth/login.post.ts`) currently **trusts any well-formed input** — REQ-AUTH-002 deferred credential verification because there was *no user storage yet*. This change closes that gap by adding the project's **first domain table** (`users`) and verifying real, hashed credentials. It also sets the conventions every future table inherits (UUIDv7 IDs, camelCase columns).

## What Changes

- Add a `users` Drizzle table (`server/db/schema/users.ts`) with a committed SQL migration.
- Hash & verify passwords with the **already-installed** `nuxt-auth-utils` `hashPassword`/`verifyPassword` (scrypt) — no new dependency.
- Rework login to look up a user by **normalized (lowercased) email**, verify the password, and reject invalid credentials (timing-safe).
- **BREAKING**: replace the `username` field with `email` everywhere (endpoint, session payload, login UI, spec scenarios).
- Store `{ id, email, displayName }` in the session payload (`id` is the durable per-user scope key for NFR 8.7).
- Seed the first MVP user from environment variables (idempotent bootstrap) during the dedicated migrate step.
- Add a stricter rate-limit override on `POST /api/auth/login` via the installed `nuxt-security` `rateLimiter`.

## Non-goals

- Self-registration UI/endpoint (wbs 1.2), password reset (1.3), account deletion (1.4), profile management (1.5), 2FA (1.6), SSO (1.7).
- Email verification, password-reset token columns, and a multi-replica shared rate-limit store (documented as a follow-up).

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `authentication`: REQ-AUTH-002 upgrades from "credential verification out of scope" to verifying real, hashed, email-based credentials with a timing-safe failure and a `{ id, email, displayName }` session; adds a bootstrap-user requirement and refines login rate limiting (REQ-NFR-014 / NFR 8.3).
- `data-persistence`: establishes the first domain table convention — domain tables use `uuid PRIMARY KEY DEFAULT uuidv7()` (PostgreSQL ≥ 18 native generator) and camelCase columns.

## Impact

- Affected code: `server/api/auth/login.post.ts`, `server/db/schema/`, `server/db/migrate.ts`, `nuxt.config.ts` (security route override), login UI under `app/`, `.env.example`.
- **New deployment constraint:** requires **PostgreSQL ≥ 18** (native `uuidv7()`). Already satisfied by `docker-compose.yml` and the e2e harness (`postgres:18-alpine`).
