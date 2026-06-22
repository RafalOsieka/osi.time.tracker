## 1. Schema & migration (backend)

- [x] 1.1 Create `server/db/schema/users.ts` with the `users` table (UUIDv7 PK `DEFAULT uuidv7()`, `email` unique, `passwordHash`, nullable `displayName`, `createdAt`/`updatedAt`), camelCase columns
- [x] 1.2 Export the `users` table from the schema barrel so the shared Drizzle client and migrator pick it up
- [x] 1.3 Run `pnpm db:generate` and verify the emitted SQL migration contains `uuid ... DEFAULT uuidv7()` and camelCase column names; commit it
- [x] 1.4 Add a unit/integration test asserting an inserted user (id omitted) receives a UUIDv7 and that the `email` UNIQUE constraint rejects duplicates (case-folded)

## 2. Password & lookup helpers (backend)

- [x] 2.1 Add a `server/utils/users.ts` (or similar) helper to find a user by normalized email and to create a user with a hashed password using `nuxt-auth-utils` `hashPassword`/`verifyPassword`
- [x] 2.2 Add a constant dummy hash used for timing-safe verification when the email is unknown
- [x] 2.3 Unit-test the helpers: email normalization, successful verify, failed verify, and dummy-hash path

## 3. Login endpoint rework (backend)

- [x] 3.1 Rewrite `server/api/auth/login.post.ts` to read `email` + `password` (remove `username`), normalize email to lowercase, look up the user, verify the password, and on failure verify against the dummy hash (timing-safe)
- [x] 3.2 On success call `setUserSession` with payload `{ id, email, displayName }`; return generic invalid-credentials error on failure
- [x] 3.3 Update the session type definition to `{ id, email, displayName? }`
- [x] 3.4 Add integration tests for `POST /api/auth/login`: valid login, wrong password, unknown email (indistinguishable), case-insensitive email match

## 4. Bootstrap user (backend)

- [x] 4.1 In `server/db/migrate.ts` add idempotent seeding from `BOOTSTRAP_USER_EMAIL` + `BOOTSTRAP_USER_PASSWORD` (skip if unset, skip if user exists, never reset existing password, hash before insert, lowercase email, never log the password)
- [x] 4.2 Add tests: fresh DB + vars set creates user, existing user untouched, unset vars skip silently

## 5. Rate limiting (backend)

- [x] 5.1 Add a stricter `nuxt-security` `rateLimiter` per-route override for `POST /api/auth/login` in `nuxt.config.ts`
- [x] 5.2 Add an integration test asserting excessive login attempts are throttled while normal usage is unaffected

## 6. Frontend

- [x] 6.1 Update the login UI to use an `email` field (remove `username`) and submit via the CSRF-aware fetch helper
- [x] 6.2 Add an E2E test for the login flow (valid login succeeds, invalid credentials show an error)

## 7. Configuration & docs

- [x] 7.1 Add `BOOTSTRAP_USER_EMAIL` / `BOOTSTRAP_USER_PASSWORD` and the PostgreSQL ≥ 18 note to `.env.example`
- [x] 7.2 Document the PostgreSQL ≥ 18 minimum requirement in `README.md`
- [x] 7.3 Run `openspec status --change add-user-storage` to confirm all `applyRequires` artifacts are done
