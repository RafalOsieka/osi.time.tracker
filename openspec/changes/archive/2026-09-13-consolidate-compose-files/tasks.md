No frontend or backend application code changes; all tasks are infrastructure and documentation. Verification is by running compose commands, since the compose files have no automated test coverage (see design.md — Context).

## 1. Dev compose (`docker-compose.yml`)

- [x] 1.1 Move the OpenProject service from `docker-compose.openproject.yml` into `docker-compose.yml` with `profiles: [trackers]`, keeping its volumes, healthcheck, and `OPENPROJECT_*` env overrides; verify `docker compose config --profiles` lists `trackers` and `docker compose config` (no profile) omits `openproject`
- [x] 1.2 Move the `redmine-db` and `redmine` services (including the entrypoint wrapper) from `docker-compose.redmine.yml` into `docker-compose.yml` under `profiles: [trackers]`; verify `docker compose config` (no profile) omits both and `docker compose --profile trackers config` includes them
- [x] 1.3 Delete `docker-compose.openproject.yml`, `docker-compose.redmine.yml`, and `docker-compose.local-prod.yml`; verify `git status` shows the three deletions and no file references them (`grep -r` over repo excluding `openspec/changes/archive`)

## 2. Prod compose (`docker-compose.prod.yml`)

- [x] 2.1 Rename `docker-compose.standalone.yml` to `docker-compose.prod.yml` (git mv), keeping service names and the existing named volumes so data survives the rename; verify `docker compose -f docker-compose.prod.yml config` succeeds with a filled `.env`
- [x] 2.2 Switch `POSTGRES_PASSWORD` and `PGADMIN_DEFAULT_PASSWORD` to `${VAR:?...}` and confirm `db` publishes no host port; verify `docker compose -f docker-compose.prod.yml config` fails naming each variable when it is unset and the rendered config has no `ports` on `db`

## 3. Environment file

- [x] 3.1 Regroup `.env.example` into three sections — host dev (`DATABASE_URL` on `localhost:5432`, dev `NUXT_SESSION_PASSWORD` marked dev-only, optional `BOOTSTRAP_USER_*`), dev compose overrides (commented `POSTGRES_*` / `PGADMIN_*` / `OPENPROJECT_*` / `REDMINE_*`), prod compose (commented `POSTGRES_PASSWORD` / `PGADMIN_DEFAULT_PASSWORD` with generation hints, `PORT`, `PGADMIN_PORT`); verify `cp .env.example .env && docker compose up -d && pnpm db:migrate && pnpm dev` works unchanged
- [x] 3.2 Verify the unedited example cannot start prod: with `.env` copied from the example, `docker compose -f docker-compose.prod.yml config` fails naming a required prod secret (compose reports `POSTGRES_PASSWORD` first, while interpolating `services.app.environment.DATABASE_URL`)

## 4. Documentation

- [x] 4.1 Update `README.md`: installation steps, Docker Compose table (two files + profile), Redmine/OpenProject setup under `--profile trackers`, prod quick-start (`cp .env.example .env`, set the prod section, `docker compose -f docker-compose.prod.yml up -d`), note on `down -v` scope, and a variable table stating which stack reads each variable; verify every compose command in the file runs as written
- [x] 4.2 Update `AGENTS.md`: setup commands, Docker Compose table, Additional Notes (profile-based tracker start/stop, API-key pointer per REQ-082); verify no reference to the deleted files remains
- [x] 4.3 Update the "Dev compose" row in `docs/e2e-guideline.md` to reference the `trackers` profile; verify with `grep -rn "docker-compose\." docs AGENTS.md README.md` showing only `docker-compose.yml` and `docker-compose.prod.yml`

## 5. End-to-end verification

- [x] 5.1 Cold-start the prod stack from a clean checkout with a filled `.env` (`docker compose -f docker-compose.prod.yml up -d --build`); verify `migrate` exits 0 before `app` starts, the app answers on `PORT`, pgadmin answers on `PGADMIN_PORT`, and `docker compose -f docker-compose.prod.yml down` + `up -d` keeps the bootstrap user
- [x] 5.2 Start the dev stack with `--profile trackers` on default ports; verify database, pgadmin, OpenProject (`:8090`), and Redmine (`:8091`) are all reachable with no port conflict, then `docker compose --profile trackers down -v` and confirm prod volumes are untouched (`docker volume ls`)
