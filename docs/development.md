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

After a schema change in `apps/web/server/db/schema`, run `pnpm db:generate` and commit the new migration from `apps/migrator/migrations`. Applied migrations are never edited.

## Continuous integration

The gates run in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml). The ruleset that blocks merges on `main` lives in the GitHub repository settings, not in this repository; every CI job, including `db`, `api` and `ui` separately, is a required check. Codecov's own statuses stay informational.

## Troubleshooting

- Set `CONSOLA_LEVEL=4` in `.env` to log every SQL statement from the dev server.
- E2E-specific problems (stale build cache, chunking errors) are covered in [`e2e-guideline.md`](./e2e-guideline.md).
