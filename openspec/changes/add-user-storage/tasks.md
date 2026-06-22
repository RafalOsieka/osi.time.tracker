## 1. Schema & migration (backend)

- [ ] 1.1 Create `server/db/schema/users.ts` with the `users` table (UUIDv7 PK `DEFAULT uuidv7()`, `email` unique, `passwordHash`, nullable `displayName`, `createdAt`/`updatedAt`), camelCase columns
- [ ] 1.2 Export the `users` table from the schema barrel so the shared Drizzle client and migrator pick it up
- [ ] 1.3 Run `pnpm db:generate` and verify the emitted SQL migration contains `uuid ... DEFAULT uuidv7()` and camelCase column names; commit it
- [ ] 1.4 Add a unit/integration test asserting an inserted user (id omitted) receives a UUIDv7 and that the `email` UNIQUE constraint rejects duplicates (case-folded)

## 2. Password & lookup helpers (backend)

- [ ] 2.1 Add a `server/utils/users.ts` (or similar) helper to find a user by normalized email and to create a user with a hashed password using `nuxt-auth-utils` `hashPassword`/`verifyPassword`
- [ ] 2.2 Add a constant dummy hash used for timing-safe verification when the email is unknown
- [ ] 2.3 Unit-test the helpers: email normalization, successful verify, failed verify, and dummy-hash path

## 3. Login endpoint rework (backend)

- [ ] 3.1 Rewrite `server/api/auth/login.post.ts` to read `email` + `password` (remove `username`), normalize email to lowercase, look up the user, verify the password, and on failure verify against the dummy hash (timing-safe)
- [ ] 3.2 On success call `setUserSession` with payload `{ id, email, displayName }`; return generic invalid-credentials error on failure
- [ ] 3.3 Update the session type definition to `{ id, email, displayName? }`
- [ ] 3.4 Add integration tests for `POST /api/auth/login`: valid login, wrong password, unknown email (indistinguishable), case-insensitive email match

## 4. Bootstrap user (backend)

- [ ] 4.1 In `server/db/migrate.ts` add idempotent seeding from `BOOTSTRAP_USER_EMAIL` + `BOOTSTRAP_USER_PASSWORD` (skip if unset, skip if user exists, never reset existing password, hash before insert, lowercase email, never log the password)
- [ ] 4.2 Add tests: fresh DB + vars set creates user, existing user untouched, unset vars skip silently

## 5. Rate limiting (backend)

- [ ] 5.1 Add a stricter `nuxt-security` `rateLimiter` per-route override for `POST /api/auth/login` in `nuxt.config.ts`
- [ ] 5.2 Add an integration test asserting excessive login attempts are throttled while normal usage is unaffected

## 6. Frontend

- [ ] 6.1 Update the login UI to use an `email` field (remove `username`) and submit via the CSRF-aware fetch helper
- [ ] 6.2 Add an E2E test for the login flow (valid login succeeds, invalid credentials show an error)

## 7. Configuration & docs

- [ ] 7.1 Add `BOOTSTRAP_USER_EMAIL` / `BOOTSTRAP_USER_PASSWORD` and the PostgreSQL ≥ 18 note to `.env.example`
- [ ] 7.2 Document the PostgreSQL ≥ 18 minimum requirement in `README.md`
- [ ] 7.3 Run `openspec status --change add-user-storage` to confirm all `applyRequires` artifacts are done
