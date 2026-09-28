# Tasks

All work is backend, build and deploy; this change has no frontend tasks.

## 1. Scaffold `apps/migrator`

- [x] 1.1 Create `apps/migrator` with `package.json` (`@osi/migrator`, private, `type: module`, `exports` pointing at `src/index.ts`; `dependencies`: `drizzle-orm`, `postgres`, and `@adonisjs/hash` on the version `nuxt-auth-utils` resolves; `devDependencies`: `tsx`, `typescript`, `@types/node`, `vite-plus`; scripts `migrate` = `tsx src/cli.ts`, `build` = `vp pack`, `type-check` = `tsc --noEmit`, `test:unit` = `vp test run`), `tsconfig.json`, and a `vite.config.ts` with the `pack` block from design D4 plus a `test` block. Verify `vp install` succeeds and `vp run --filter @osi/migrator type-check` passes on a placeholder `src/index.ts`.

## 2. Move the migrations and implement the runner (backend)

- [x] 2.1 Move `apps/web/server/db/migrations/` (SQL + `meta/`) to `apps/migrator/migrations/` with `git mv`, and point `out` in `apps/web/drizzle.config.ts` at `../migrator/migrations`, with a comment explaining the cross-package output. Verify that git records every moved file as a rename, so `git log --follow` keeps its history, and that `pnpm db:generate` reads the snapshots from the new folder and writes nothing under `apps/web`. (It cannot report "no changes": migrations 0015–0023 were hand-written without snapshots, so it diffs against 0014 and prompts. That behavior predates this change.)
- [x] 2.2 Implement `src/index.ts` per design D2–D3: `MIGRATIONS_FOLDER`, `runMigrations(url, folder)` (single connection, `drizzle(sql)` without a logger, `migrate()`, always closes the connection), and `seedBootstrapUser(sql, { email, password })` (trim and lowercase the email, scrypt hash, `INSERT … ON CONFLICT ("email") DO NOTHING`). Verify with unit tests in `apps/migrator/test/`: `MIGRATIONS_FOLDER` points at the committed folder containing `meta/_journal.json`; email normalization; the produced hash starts with `$scrypt$` and verifies with `@adonisjs/hash`.
- [x] 2.3 Implement `src/cli.ts`: load the root `.env` via `process.loadEnvFile` when present, fail fast with a clear message and exit code 1 when `DATABASE_URL` is missing or empty, run migrations, seed only when both bootstrap variables are non-empty, never print the password or hash, and exit 0 on success or 1 on failure. Verify with unit tests covering: missing `DATABASE_URL` → exit 1 with the variable named and no connection attempted; unset or empty bootstrap variables → seeding skipped.

## 3. Switch `apps/web` and the e2e harness to `@osi/migrator` (backend)

- [x] 3.1 Add `@osi/migrator` as an `apps/web` devDependency. Update `test/e2e/harness/database.ts`, `harness/migrations.ts` (default folder = `MIGRATIONS_FOLDER`) and every `test/e2e/db` spec that imports `server/db/migrate` or reads the old folder. Verify `pnpm test:e2e:db` passes, including the existing bootstrap-seeding scenarios (fresh DB creates user, existing user untouched, unset variables skip).
- [x] 3.2 Delete `apps/web/server/db/migrate.ts`, remove `@adonisjs/hash` from `apps/web/package.json`, drop the `logger` option from `createDatabaseClient` along with the unit test asserting it (keep the query-logger tests), and update the `client.ts` comments that mention the migrator. Verify that `pnpm type-check`, `pnpm lint` and `pnpm test:unit` pass, and that nothing under `apps/web` still references `@adonisjs/hash` outside the test helpers that resolve it through `nuxt-auth-utils`.
- [x] 3.3 Change the root `db:migrate` script to `vp run --filter @osi/migrator migrate`. Verify that `pnpm db:migrate` against the local dev database reports success with no pending migrations, and that a second run is also a no-op.

## 4. Bootstrap login compatibility (backend, API integration test)

- [x] 4.1 Add an API e2e spec (`apps/web/test/e2e/api/bootstrap-user-login.spec.ts`) that seeds a unique user through `seedBootstrapUser` on the test database, then covers:
  - login with that email in mixed case and the correct password succeeds and sets a session;
  - login with a wrong password is rejected with the standard credentials error;
  - a second seed call with a different password leaves the original password valid.

  Verify `pnpm test:e2e:api` passes.

## 5. Docker image and compose (build and deploy)

- [x] 5.1 Add the `migrator-build` and `migrator` stages to the `Dockerfile` ahead of the web stages (design D4), keeping the web runtime as the last and default stage. Allow the migrator's `package.json`, `tsconfig.json`, `vite.config.ts`, `src/` and `migrations/` in `.dockerignore`, and stop copying `apps/web/server/db/migrations` into the web image context. Verify that `docker build .` still produces the web runtime, and that `docker build --target migrator .` produces an image with no `node_modules`, pnpm or `vp`, checked by listing the image filesystem.
- [x] 5.2 Point the `migrate` service in `docker-compose.prod.yml` at `target: migrator` and remove its `command`. Verify against a throwaway Postgres 18 container:
  - migrations apply;
  - the bootstrap user is seeded when the variables are set;
  - a second run is a no-op;
  - a run without `DATABASE_URL` exits non-zero naming the variable;
  - `docker compose -f docker-compose.prod.yml config` validates.
- [x] 5.3 Update README (self-hosting and database sections), AGENTS.md (project structure, database commands, where migrations live) and any `.env.example` comments that reference the old migrate command or path. Verify that `rg "server/db/migrat"` finds no stale references outside `openspec/changes/archive`.

## 6. Integration checks

- [ ] 6.1 Run `pnpm lint`, `pnpm format:check`, `pnpm type-check` and `openspec validate extract-migrator-app --strict`, and confirm the CI jobs (unit, db, api, ui, package, extension) pass on the pull request.
