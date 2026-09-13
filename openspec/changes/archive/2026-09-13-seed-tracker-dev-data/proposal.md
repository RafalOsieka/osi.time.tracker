## Why

`docker compose --profile trackers up -d` boots OpenProject and Redmine, but neither is usable with OSI until a developer clicks through setup: Redmine needs the forced password change, the REST API switch, a project, issues and an API key; OpenProject needs an API token. Neither holds a single time log, so "Import history" (WBS 5.18) has nothing to show.

## What Changes

- New workspace package `apps/dev-seed` (`@osi/dev-seed`) with a root script `pnpm trackers:seed` that turns the running `trackers` profile into a ready dev environment: bootstraps admin accounts and fixed dev API keys, then seeds a designed fixture over each tracker's REST API.
- The fixture models one consultant with two clients: **Nordwind Logistics** on Redmine and **Helios Energy** on OpenProject. Each tracker gets a three-level project tree, sibling top-level projects and one "internal" project never scoped in OSI, 6–8 issues per leaf with a lifecycle arc (closed → in progress → untouched), and three months of weekday time logs whose comment patterns exercise every import routing rule (reused Task, sibling Tasks, `empty`, unmatched).
- Redmine account bootstrap (stable admin password, REST API on, fixed key from `REDMINE_DEV_API_KEY`) moves into the existing compose entrypoint wrapper. OpenProject's fixed token (`OPENPROJECT_DEV_API_KEY`) is set by the script via `rails runner`; compose gains `OPENPROJECT_SEED_ADMIN_USER_PASSWORD_RESET=false` and loses the dead `OPENPROJECT_DEMO__DATA` line (OpenProject 17 seeds demo data unconditionally; the script deletes the two demo projects).
- Idempotent re-runs (create-if-missing by project identifier, issue subject, `(issue, date, comment)`); `--reset` removes only fixture time logs; `--dry-run` prints the plan.
- `.env.example`, `README.md`, `AGENTS.md` document the two-command flow and the keys to paste into the OSI tracker form.

## Capabilities

### New Capabilities

- `tracker-dev-seed`: seed command, account bootstrap, fixture shape, idempotency/reset, failure behaviour.

### Modified Capabilities

- `tracker-dev-environments`: REQ-079 (demo data replaced by the fixture), REQ-099 (Redmine boot completes the admin account and REST setup), REQ-082 and REQ-102 (docs describe the seed step and dev keys).

## Impact

- New: `apps/dev-seed/` (tsx CLI; `@osi/remote-trackers` for activities and time logs, raw fetch for projects/issues), root script.
- Changed: `docker-compose.yml`, `.env.example`, `README.md`, `AGENTS.md`.
- Untouched: `apps/web`, adapters, CI, e2e harness. Nothing is written to OSI's database.

## Non-goals

- Seeding OSI itself; the API secret is browser-held (REQ-249), so the last step stays "paste the key".
- A live e2e suite against the seeded trackers.
- Running the seed from `docker compose up`.
