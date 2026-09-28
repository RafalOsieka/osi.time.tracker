# Design

## Context

See proposal.md (Why). Current layout, all inside `apps/web`:

```
server/db/schema/*.ts --drizzle-kit generate--> server/db/migrations/*.sql (+ meta/)
server/db/client.ts   createDatabaseClient(url, { max, logger })  (consola logger, typed schema)
server/db/migrate.ts  runMigrations(): drizzle migrator + bootstrap user
                      (imports client.ts, schema/users, @adonisjs/hash via createRequire)
```

Consumers of `migrate.ts`: the root `db:migrate` script (`tsx`), the prod compose `migrate` service (the whole Docker build stage), the e2e harness (`test/e2e/harness/database.ts` migrates the template database), and the `test/e2e/db` specs (`runMigrations` directly, and SQL files read from `process.cwd()/server/db/migrations` via `harness/migrations.ts`).

`nuxt-auth-utils` hashes with `@adonisjs/hash` scrypt, configured from `runtimeConfig.hash.scrypt`. This project sets no options, so its hashes use the scrypt defaults.

## Goals / Non-Goals

**Goals:**
- `@osi/migrator` depends on the SQL files and nothing else from `apps/web`.
- One runner implementation serves dev (`pnpm db:migrate`), tests and production.
- The migrator image holds the Node runtime, one bundled JS file and the SQL.

**Non-Goals:**
- A typed schema inside the migrator. It never queries domain tables beyond one insert.
- A CLI with flags or subcommands. It only applies migrations and seeds the bootstrap user.

## Decisions

### D1. `apps/migrator` owns the SQL; `apps/web` keeps the schema
The migrations and their `meta/` journal move with `git mv` to `apps/migrator/migrations/`. `apps/web/drizzle.config.ts` keeps `schema: ./server/db/schema/*.ts` and changes `out` to `../migrator/migrations`.
- *Alternative: shared `packages/db` (schema, client, migrations).* It's the cleanest ownership, but it moves every web schema import and adds a Nitro-bundled workspace package for no runtime gain. Rejected (proposal non-goal).
- *Alternative: runner only, SQL stays in web.* The image would copy files out of `apps/web`, and the package wouldn't be self-contained. Rejected.

Unchanged file contents keep their hashes, so the migrator's history table (`__drizzle_migrations`) recognizes already-applied migrations (core-persistence REQ-039).

### D2. Bootstrap user via plain SQL, not the web schema
`seedBootstrapUser(sql, { email, password })` trims and lowercases the email, then runs `INSERT INTO users ("email", "passwordHash") VALUES (…) ON CONFLICT ("email") DO NOTHING`. The `email` column is unique, so the insert is idempotent in one statement. Nothing is logged: postgres.js has no query logger unless one is configured.
- *Alternative: copy the Drizzle `users` table definition.* Typed, but it duplicates part of the web schema, which would then drift. Rejected; the SQL migrations are the contract.

The hash comes from `new Hash(new Scrypt({}))` imported normally from `@adonisjs/hash`, now a declared dependency. The defaults match the app's `hashPassword`. Scrypt strings are self-describing, so `verifyPassword` would still accept them even if the app later configured options.

### D3. Runner API and entry points
- `src/index.ts` exports `runMigrations(url, migrationsFolder = MIGRATIONS_FOLDER)`, `seedBootstrapUser` and `MIGRATIONS_FOLDER`. `MIGRATIONS_FOLDER` resolves `../migrations` from the module file, so the same path works from `src/` (dev, tests) and `dist/` (image).
- `src/cli.ts` loads the root `.env` when present, using `process.loadEnvFile` (built into Node, no `dotenv`). It reads `DATABASE_URL`, fails fast when it's missing (platform-docker REQ-048), migrates, seeds if both bootstrap variables are set, then exits 0 or 1.
- It uses a single connection (`max: 1`) and `drizzle(sql)` without a logger, only for `migrate()`.
- `package.json` `exports` points at the TypeScript source. The only in-repo consumer is the Vitest harness, which runs TS directly, so no build step is needed before tests. The published artifact is the bundle.
- *Alternative: export a `tsc`-built `dist/` like `remote-trackers`.* That would make the harness depend on a build step for a package nobody else imports. Rejected.

### D4. Bundle with `vp pack`, ship as a separate Dockerfile target
- `apps/migrator/vite.config.ts` sets `pack: { entry: ['src/cli.ts'], platform: 'node', deps: { alwaysBundle: ['drizzle-orm', 'postgres', '@adonisjs/hash'] } }`, producing a single `dist/cli.mjs` that needs no `node_modules`. The dependencies stay declared in `dependencies`.
- Dockerfile stages, with the runtime last so it remains the default target:
  1. `migrator-build` (Vite+ image): filtered install `--filter "@osi/migrator..."`, then `vp run --filter @osi/migrator build`.
  2. `migrator` (`node:24-alpine`): deletes the image's bundled npm, corepack and yarn (`platform-docker` REQ-048 forbids a package manager), copies `dist/cli.mjs` and `migrations/`, runs as `USER node`, `CMD ["node", "dist/cli.mjs"]`. *Alternative:* copy only the `node` binary into plain Alpine, as the Vite+ Docker guide does. It's smaller, but the Alpine tag must track the Node image's musl/libstdc++ versions exactly, or the binary breaks at runtime. Rejected for that coupling.
  3. The existing `build` and `runtime` stages, unchanged.
- The compose `migrate` service uses `target: migrator` and drops `command`.
- *Alternative: `vp pack --exe` single executable.* It needs Node ≥ 25.7 at build time (`devEngines` pins 24) and yields a larger binary than Node + one file. Rejected for now.

### D5. Web app and harness updates
- `apps/web` removes `server/db/migrate.ts`, the migrations folder and `@adonisjs/hash`. `createDatabaseClient` drops its `logger` option, along with the unit test for it.
- The harness and `db` specs import from `@osi/migrator` (a new `apps/web` devDependency). `harness/migrations.ts` defaults to `MIGRATIONS_FOLDER`.
- Root `db:migrate` becomes `vp run --filter @osi/migrator migrate` (`tsx src/cli.ts`); `db:generate` is unchanged.

## Risks / Trade-offs

- [Hash drift between the migrator and `nuxt-auth-utils`] → An API e2e test seeds via `seedBootstrapUser` and logs in through `/api/auth/login` (core-authentication REQ-012, "Seeded user can log in"). The `@adonisjs/hash` range matches the version `nuxt-auth-utils` resolves.
- [Bundling breaks a dependency, e.g. optional peers `argon2` / `bcrypt` or postgres.js dynamic requires] → Only the scrypt driver is imported. A task builds the image and runs it against a throwaway Postgres before merging.
- [`drizzle-kit` writing into a sibling package surprises developers] → Comments in `drizzle.config.ts` and AGENTS.md. The e2e migration specs fail if the folder is missing.
- [Cross-package coupling through table names in the raw `INSERT`] → A `users` rename would fail the bootstrap tests immediately. That's acceptable for one statement.

## Migration Plan

For self-hosters, redeploying with `docker compose -f docker-compose.prod.yml up -d --build` builds the new `migrator` target. Existing databases see no pending migrations (D1). To roll back, check out the previous commit and rebuild; the schema and history are untouched.
