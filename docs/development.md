# Development

How to set up a local development environment. Day-to-day commands (lint, tests, migrations) and coding rules are in [`AGENTS.md`](../AGENTS.md) and [`coding-standards.md`](./coding-standards.md).

## Prerequisites

- Node.js `^24.21` and pnpm `^12.8` (pinned in `devEngines` in the root `package.json`). Use `pnpm`, never `npm` or `yarn`.
- Docker with Compose v2, for PostgreSQL and the optional local trackers.
- Chromium for the UI e2e and extension browser tests only: `pnpm --filter @osi/time-tracker exec playwright install chromium`.

## First run

```bash
pnpm install            # also runs `nuxt prepare` for the web app
cp .env.example .env    # the defaults work for local development
docker compose up -d    # PostgreSQL 18 on :5432 and pgAdmin on :8080
pnpm db:migrate         # apply migrations and seed the BOOTSTRAP_USER_* user
pnpm dev                # http://localhost:3000
```

Log in with `BOOTSTRAP_USER_EMAIL` / `BOOTSTRAP_USER_PASSWORD` from `.env`.

The dev compose file is infrastructure only: the dev server and migrations always run on the host. `.env.example` groups every variable by who reads it (host tooling, dev compose, production compose) and documents it in place.

```bash
docker compose --profile trackers down     # stop all dev containers (keeps data)
docker compose --profile trackers down -v  # stop and delete ALL dev volumes (db, pgAdmin, trackers)
```

To wipe a single service, remove only its named volume (`docker volume ls`, `docker volume rm`).

## Local trackers (OpenProject and Redmine)

For adapter, sync and import work you can run real OpenProject and Redmine instances locally. **Never use them in production.**

```bash
docker compose --profile trackers up -d   # OpenProject :8090 + Redmine :8091 (first boot ~2 min)
pnpm trackers:seed                        # bootstrap accounts and seed the fixture (~30 s)
pnpm trackers:seed --dry-run              # print the plan, write nothing
pnpm trackers:seed --reset                # delete fixture time logs first, then re-seed
```

`pnpm trackers:seed` waits for both healthchecks, makes the `admin` accounts usable without any UI step (Redmine does this on boot; the OpenProject API token is installed through `rails runner`), removes OpenProject's demo projects and seeds the fixture. It is idempotent: a re-run creates only what is missing and never touches projects, issues or logs you made by hand. It ends by printing what to paste into the OSI tracker form:

| Tracker     | URL                     | Login           | API key (from `.env`)     | Sent as                    |
| ----------- | ----------------------- | --------------- | ------------------------- | -------------------------- |
| Redmine     | `http://localhost:8091` | `admin`/`admin` | `REDMINE_DEV_API_KEY`     | `X-Redmine-API-Key` header |
| OpenProject | `http://localhost:8090` | `admin`/`admin` | `OPENPROJECT_DEV_API_KEY` | HTTP Basic, user `apikey`  |

Both keys are valid only on these local instances. Ports and secrets can be overridden with the `OPENPROJECT_*` / `REDMINE_*` variables in `.env`.

### What gets seeded

One consultant, two clients:

- **Nordwind Logistics** on Redmine: `fleet-platform` → `dispatch` / `telemetry` → four leaf projects, plus `warehouse-scanner` and `internal-it`.
- **Helios Energy** on OpenProject: `solar-portal` → `customer-app` / `gateway` → four leaf projects, plus `grid-analytics` and `helios-internal`.

Every leaf and sibling project has 6–8 issues (older ones closed, two never logged). The `admin` account has three months of weekday time logs: Monday and Tuesday on Nordwind, Wednesday and Thursday on Helios, Friday on both, with one holiday week. Runs in the same calendar week produce identical logs; in a new week the window slides.

### Seed guarantees

The seed is tested in `apps/dev-seed`; keep these properties when changing it:

- **Isolated.** The trackers start only with `--profile trackers`, each on its own named volumes, separate from the dev database and the production stack. The seed never writes to the OSI database.
- **Fails loudly.** It waits a bounded time for both healthchecks and exits non-zero naming the tracker and step when one is down, unhealthy or rejects a request. A failure on one tracker does not stop the other from being seeded; a failed bootstrap skips that tracker's content.
- **Idempotent.** Existing state is read first and only missing items are created, keyed by project identifier, `(project, subject)` and `(issue, spent-on, comment)`. Matches are skipped, never updated, so hand-made projects, issues, logs and status changes survive. A run on a later date adds only the newly covered days.
- **Scoped reset.** `--reset` deletes only `admin` time logs that match a fixture key, never projects, issues or other logs. `--dry-run` prints creations, skips and deletions and writes nothing.
- **Keys follow `.env`.** The OpenProject token is created once and skipped while the key authenticates; changing `OPENPROJECT_DEV_API_KEY` replaces it. Redmine sets its key, password and REST API on every boot.
- **Deterministic.** Logs cover every weekday from 91 days to 1 day before the run, 3–4 per day totalling 6–8 h (5–6 h on Fridays), each with an activity, issue and comment. Every week has, per tracker, a comment repeated across days on one issue, two comments on one issue, one blank comment and one log in the internal project. The same calendar week always yields identical logs.

### Trying import

In OSI, add both trackers with the keys above, create a Project scoped to `fleet-platform` (Redmine) and one scoped to `solar-portal` (OpenProject), then use **Import history** for the last three months. Every routing rule shows up:

- the same note across days reuses one Task;
- two notes on one issue become sibling Tasks;
- a blank note becomes the Task `empty`;
- `internal-it` / `helios-internal` logs are reported as unmatched until you scope a Project to them.

## Browser extension

Build the extension and load it unpacked:

```bash
pnpm build:packages
pnpm --filter @osi/extension build
```

Load `apps/extension/dist` via `chrome://extensions` → **Developer mode** → **Load unpacked**, approve `http://localhost:3000` and the local tracker URLs in its options page, and turn off **Direct browser connection allowed** on the trackers that should use it. After a rebuild, click **Reload** on the extension card and refresh the OSI tab. The full user-facing flow is in [`self-hosting.md`](./self-hosting.md#browser-extension-chrome--edge).

Isolated fake trackers for extension tests live in `apps/extension/test/browser/harness`; do not point the unpacked extension at real trackers from CI.

## Database and migrations

Drizzle (`drizzle-orm` with the `postgres` driver) is the only data-access layer; server code reaches it through `getDb()` (see [`coding-standards.md`](./coding-standards.md#5-server--api-conventions)). The schema lives in `apps/web/server/db/schema`. After a schema change, `pnpm db:generate` runs `drizzle-kit` and writes a new SQL migration to `apps/migrator/migrations`; commit it. `pnpm db:migrate` applies pending migrations with the `drizzle-orm` migrator and seeds the bootstrap user. Applied migrations are never edited. Column names are camelCase and primary keys are `uuid DEFAULT uuidv7()`.

## Toolchain

Commands and the upgrade procedure are in [`AGENTS.md`](../AGENTS.md#vite-vp). The rules behind them:

- One toolchain: build, test, lint and format run through Vite+ (`vp`). [`pnpm-workspace.yaml`](../pnpm-workspace.yaml) pins one `vite-plus` version in the catalog together with the `vite`, `vitest` and `@vitest/coverage-v8` versions that release supports, and its overrides resolve every `vite` and `vitest` in the tree (including transitive ones) to those entries. Bump them only together through `vp migrate`; a lone `vitest` or coverage bump is a defect.
- The CI setup action and the Docker build image run the same `vite-plus` version as the catalog; Node.js and pnpm come from `devEngines` in the root `package.json`.
- Root scripts build the workspace libraries first (`build:packages`, cached, in dependency order) and fail when a library build or type check fails, instead of running against stale output.
- `packages/remote-trackers` is consumed only through its public exports. It builds, type-checks and runs its provider tests without the web app or generated Nuxt types (`pnpm package:check`), and needs no Node-only globals in the browser; a deep import of an unexported module must fail.

## Continuous integration

The merge rules are a spec (`openspec/specs/platform-ci`): every quality gate must pass, the PR title follows Conventional Commits, merges are squash-only. How the gates run lives in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) and [`pr-title.yml`](../.github/workflows/pr-title.yml); read those for job names, actions and versions.

- Pull requests to `main` and pushes to `main` run the workflow. A newer run on the same ref cancels the older one.
- Cheap checks (lint, format, type check, package, unit, extension, nuxt, build) run as parallel jobs, each its own status check.
- The `db`, `api` and `ui` e2e jobs start only after the cheap checks pass, so a red lint never boots Docker or Playwright. `db` does not wait for `build`; `api` and `ui` reuse the `build` job's `.output` artifact instead of building again, and fail (not skip) when it is missing. Missing Docker or Chromium fails these jobs in CI.
- Every job installs with a frozen lockfile; Node.js and pnpm come from `devEngines` in the root `package.json`.
- The workflow token is read-only by default, third-party actions are pinned, and secrets (`NUXT_SESSION_PASSWORD`, `CODECOV_TOKEN`) are never logged.
- The merge-blocking ruleset on `main` lives in the GitHub repository settings, not in this repository. Its required checks must list `db`, `api` and `ui` separately.
- Dependabot ([`.github/dependabot.yml`](../.github/dependabot.yml)) covers npm, GitHub Actions and Docker. It skips the Vite+ toolchain (which moves through `vp migrate`, see [`AGENTS.md`](../AGENTS.md#upgrading-dependencies)) and groups `nuxt` with `@nuxt/*`. A PR that bumps the `vite-plus` catalog version without the Docker build image tag, or the reverse, must not be merged.
- CodeQL runs through GitHub default setup; findings appear in the Security tab.

### Coverage

Coverage is informational only: it never fails a check and is not a required gate ([`codecov.yml`](../codecov.yml) sets every status to `informational`). The `coverage`, `api` and `db` jobs upload the flags `unit-nuxt`, `e2e-api` and `e2e-db`, which Codecov combines for the PR comment and the README badge; a missing flag carries forward from the base commit. How each flag is measured is in [`e2e-guideline.md`](./e2e-guideline.md#coverage).

- Sources are first-party `app/`, `server/` and `shared/` only. Migration SQL/JSON, other `*.sql`/`*.json` and the never-executed bundler-warmup plugin are excluded (`apps/web/vitest.config.ts`).
- A failing test still fails its job, independent of coverage; a failed db test uploads no report.
- Reports go to git-ignored `coverage*/` directories. A public-repo upload may be tokenless; `CODECOV_TOKEN` is used when set and never logged.

## Troubleshooting

- Set `CONSOLA_LEVEL=4` in `.env` to log every SQL statement from the dev server.
- E2E-specific problems (stale build cache, chunking errors) are covered in [`e2e-guideline.md`](./e2e-guideline.md).
