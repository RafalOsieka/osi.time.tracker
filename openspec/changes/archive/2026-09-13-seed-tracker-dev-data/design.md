## Context

See proposal.md — Why. Facts established by spiking against the running `trackers` profile (Redmine 6.1.3, OpenProject 17.5.1):

- Both images expose `rails runner`. Redmine only through its entrypoint (`/docker-entrypoint.sh rails runner "…"`, ~5 s; bare `rails runner` lacks `secret_key_base`). OpenProject via `bundle exec rails runner "…"` in `/app` (~26 s cold boot per call).
- Redmine `Token#before_create` always regenerates `value`, but the column is plain text: `Token.create!(user:, action: 'api')` + `update_column(:value, KEY)` yields a stable key. REST API is off until `Setting.rest_api_enabled = '1'`; `admin` has `must_change_passwd`.
- OpenProject `Token::HashedToken#initialize_values` only generates when `value` is blank, so `Token::API.create!(user:, value: Token::API.hash_function(KEY))` validates a fixed plaintext. The HMAC pepper is `Setting.hashed_token_pepper` (in the DB), so the hash must be computed inside the container. `OPENPROJECT_SEED_ADMIN_USER_PASSWORD_RESET=false` disables the forced admin password change. There is no setting behind `OPENPROJECT_DEMO__DATA`; `RootSeeder#do_seed!` always runs `DemoDataSeeder` (`demo-project`, `your-scrum-project`). Basic seeds provide activities (Management … Other) and types (Task, Feature, Bug, …) regardless.
- Import (`remote-log-import`) only fetches the current account's logs, month by month, 100 per page with a 50-page cap; three months of a few hundred logs is far below that. Issue search on both adapters includes closed issues.
- `@osi/remote-trackers` adapters take a `Transport` (`execute(request, schema)`) and already implement `createTimeEntry`, `listActivities`, `deleteTimeEntry`; no fetch-based `Transport` exists outside the extension.

## Goals / Non-Goals

**Goals:**

- `docker compose --profile trackers up -d && pnpm trackers:seed` leaves both trackers ready: login works, API keys are known, projects/issues/time logs exist, and one "Import history" run in OSI exercises every routing rule.
- Deterministic, idempotent, re-runnable; never touches data the developer created by hand.
- Zero coupling to `apps/web`.

**Non-Goals:**

- Seeding OSI, a live e2e suite, or running the seed from compose (see proposal).

## Decisions

### D1: A separate workspace package, `apps/dev-seed`

`apps/*` is already a workspace glob. The package is a tsx CLI (`pnpm --filter @osi/dev-seed seed`, exposed at the root as `trackers:seed`) depending on `@osi/remote-trackers` (workspace) and nothing from `apps/web`. It provides a small Node-`fetch` `Transport` and uses the real adapters for activities and time-log create/delete, so seeded logs go through the same code path OSI uses to export; projects, issues and status changes use raw `fetch` against the same base URL, because OSI never creates those and the adapters must not grow write operations it does not need.

- *Alternative — script under `apps/web/server/db/` next to `migrate.ts`:* shortest path, but pulls Nuxt/Drizzle into a tool that only talks to trackers, and invites OSI-side seeding by accident. Rejected.
- *Alternative — Ruby seeding through `rails runner` only:* no auth problem at all, but Ruby in a TS repo, tied to tracker model internals, and does not exercise the REST paths OSI relies on. Rejected except for the two token/setting bootstraps that REST cannot do.

### D2: Account bootstrap split by what each image allows

Redmine: the compose entrypoint wrapper we already own (it runs `load_default_data`) gains one `rails runner` step, idempotent and run on every boot: set `admin` password to `REDMINE_ADMIN_PASSWORD` (default `admin`), `must_change_passwd = false`, `Setting.rest_api_enabled = '1'`, and ensure exactly one `api` token with value `REDMINE_DEV_API_KEY`. Redmine is REST-ready when its healthcheck passes; the script needs no `docker exec` for it.

OpenProject: no entrypoint hook we control, so the script runs `docker compose exec -T openproject bundle exec rails runner` once to ensure an API token for `admin` hashed from `OPENPROJECT_DEV_API_KEY` (delete other `Token::API` rows of that user first so re-runs converge). It skips the 26 s call when the key already authenticates (`GET /api/v3/users/me` returns 200). Compose adds `OPENPROJECT_SEED_ADMIN_USER_PASSWORD_RESET: 'false'` and drops `OPENPROJECT_DEMO__DATA`.

- *Alternative — script does both bootstraps:* symmetric, but Redmine would be unusable between `up` and `seed` for no reason. Rejected.
- *Alternative — generated keys printed once:* no fixed value in the repo, but every re-create of the volume means a new key to paste, and docs cannot name it. Rejected; the keys are dev-only and documented as such.

### D3: Fixed dev keys live in `.env.example`

`REDMINE_DEV_API_KEY` (40 hex) and `OPENPROJECT_DEV_API_KEY` (`opapi-` + 64 hex, matching OpenProject's own format) ship uncommented in the dev-compose section of `.env.example` with a "local trackers only" comment. Compose and the script read the same `.env`, so the documented value is what actually works. Anyone who edits them is still covered: the script prints the effective keys and base URLs at the end.

### D4: Fixture is a typed data module plus a deterministic generator

`fixture/` holds the hand-written content: the two client trees (identifiers, names, parents), 6–8 issues per leaf with an `arc` slot (`closed-early`, `closed-mid`, `in-progress`, `open-unlogged`), and a pool of work-note style comments per issue. `calendar.ts` turns that into concrete logs: for each weekday in `[today − 91 days, today − 1]`, the weekly pattern (Mon/Tue Nordwind, Wed/Thu Helios, Fri one log each), 2–3 logs per day summing 6–8 h (Fri 5–6 h), one holiday week ~6 weeks back, and per-week guarantees of the four routing patterns (a comment repeated on consecutive days, two comments on one issue, one blank comment, one log in the internal project). Durations and picks come from a seeded `mulberry32`, so the same day always produces the same logs; only the window slides with the date. Issue statuses follow the arc (closed issues get `Closed`/`Closed` status via the tracker's own status list).

- *Alternative — random logs each run:* simpler, but breaks idempotency and makes bug reports non-reproducible. Rejected.
- *Alternative — fixed absolute dates:* perfectly stable, but "Import history" defaults to recent months and a stale fixture would look empty. Rejected.

### D5: Idempotency keys and `--reset`

Existing state is read first, then a plan is computed (`ensure` operations), then executed. Keys: project → identifier; issue → `(project, subject)`; time log → `(issue, spent_on, comment)` for the admin user. Anything matching is skipped, never updated, so hand edits survive. `--reset` deletes admin time logs that match a fixture key (via `deleteTimeEntry`) before re-seeding; it never deletes projects or issues. `--dry-run` prints the plan and exits 0. Deleting the two OpenProject demo projects is part of the plan (`DELETE /api/v3/projects/{id}`, then poll until they are gone) and is skipped once absent.

### D6: Execution shape

Steps run in order — wait for both healthchecks (`docker compose ps --format json`, bounded wait), bootstrap, plan, execute — with per-tracker isolation: a failure on one tracker reports the step and continues with the other, then exits non-zero. Redmine writes run sequentially; OpenProject with concurrency 4 (form validation + create per log). Progress is printed per step with counts.

### D7: Testing

Unit tests (Vitest, package project added to `pnpm test:unit`) cover the generator (calendar bounds, weekday-only, holiday gap, per-week pattern guarantees, determinism, totals in range) and the planner (given fake remote state → expected create/skip/delete operations, `--reset`, demo-project removal). Tracker HTTP is faked at the `Transport` / `fetch` boundary, consistent with the rest of the repo. No live suite — same stance as `docs/e2e-guideline.md`.

## Risks / Trade-offs

- [OpenProject cold `rails runner` ~26 s] → run at most once per seed and skipped when the key already works.
- [Tracker image upgrades change model internals used by the bootstrap] → both snippets are three lines, pinned image tags, and the script verifies the key with a real API call before seeding.
- [Fixed keys in the repo] → only valid on the local `trackers` instances, which the compose file already labels dev-only.
- [~200 OpenProject logs at ~300 ms] → ~1 min with concurrency 4; acceptable for a first-run tool, reported with progress.
- [Fixture window shifts daily] → new day = one more day of logs on re-run; idempotency keys keep earlier days untouched.

## Migration Plan

1. Add `apps/dev-seed`, root script, `.env.example` keys, compose changes.
2. Docs (README quick-start, AGENTS.md setup + Additional Notes).
3. Rollback: revert the commit; existing tracker volumes keep whatever was seeded, `docker compose --profile trackers down -v` wipes it.
