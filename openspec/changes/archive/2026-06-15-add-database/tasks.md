## 1. Dependencies & Configuration (Backend)

- [x] 1.1 Add `drizzle-orm`, `postgres`, and `drizzle-kit` to `package.json` via pnpm
- [x] 1.2 Add `DATABASE_URL` to runtime config / `.env` example and document it
- [x] 1.3 Create `drizzle.config.ts` pointing at the schema and `server/db/migrations` output, reading `DATABASE_URL`

## 2. DB Client (Backend)

- [x] 2.1 Create `server/db/index.ts` exporting a shared Drizzle client initialized from `DATABASE_URL`
- [x] 2.2 Make client initialization fail fast with a clear error when `DATABASE_URL` is missing
- [x] 2.3 Unit test: client module fails fast (throws clear error) when `DATABASE_URL` is unset
- [x] 2.4 Integration test: client connects to a test Postgres and runs a trivial `SELECT 1`

## 3. Migration Workflow (Backend)

- [x] 3.1 Add `db:generate` and `db:migrate` scripts to `package.json`
- [x] 3.2 Create the migrator runner (`server/db/migrate.ts`) using `drizzle-orm` migrator
- [x] 3.3 Integration test: running migrate against a fresh test DB applies all pending migrations
- [x] 3.4 Integration test: running migrate twice is idempotent (second run applies nothing, exits success)
- [x] 3.5 Integration test: a deliberately broken migration causes migrate to exit non-zero

## 4. End-to-End Verification (Backend)

- [x] 4.1 Define a throwaway fake-table schema and run `db:generate` to produce a SQL migration
- [x] 4.2 Run `db:migrate` and confirm the fake table exists in the database (proves generate→migrate pipeline)
- [x] 4.3 Remove the fake-table schema and its verification-only migration so committed schema has no throwaway tables

## 5. Docker Compose Migration Step (Backend, planned)

- [x] 5.1 Document the dedicated migrate step model (init/migrate step runs `db:migrate` before app serves traffic; halts on failure)
- [x] 5.2 Integration/smoke test: simulate the startup sequence — migrate runs to completion before the app accepts requests, and a migration failure blocks startup with non-zero exit
