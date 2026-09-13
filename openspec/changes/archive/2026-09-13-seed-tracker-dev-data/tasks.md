No frontend work: every task below is backend/tooling (a Node CLI package, compose, env, docs). Unit tests fake the tracker HTTP boundary (`Transport` / `fetch`); there is no live suite (design.md — D7). Steps 5–6 are verified by running the commands against the local `trackers` profile.

## 1. Package skeleton and tracker access

- [x] 1.1 Create `apps/dev-seed` (`@osi/dev-seed`, private, `type: module`, tsx, Vitest, depends on `@osi/remote-trackers` and `zod`), wire root `trackers:seed` script and add the package to root `test:unit` / `type-check`; verify `pnpm trackers:seed --help` prints usage and `pnpm type-check` passes
- [x] 1.2 Implement `src/env.ts` (load `<repo>/.env`, resolve `OPENPROJECT_PORT`, `REDMINE_PORT`, `OPENPROJECT_DEV_API_KEY`, `REDMINE_DEV_API_KEY`, `REDMINE_ADMIN_PASSWORD` with the compose defaults) and `src/transport.ts` (Node `fetch` `Transport` for `@osi/remote-trackers`); verify both adapters can call `listActivities` through it against the running trackers
- [x] 1.3 Unit tests for 1.2: env defaults and overrides; transport maps status/JSON/non-JSON bodies and never adds credentials itself
- [x] 1.4 Implement `src/health.ts`: bounded wait on `docker compose ps --format json` for `openproject`/`redmine` healthy, clear error naming the missing/unhealthy service (REQ-347); unit test with a faked `ps` output for healthy, starting, and absent services

## 2. Account bootstrap

- [x] 2.1 Extend the Redmine entrypoint wrapper in `docker-compose.yml` with an idempotent `/docker-entrypoint.sh rails runner` step (admin password from `REDMINE_ADMIN_PASSWORD`, `must_change_passwd = false`, `Setting.rest_api_enabled = '1'`, single `api` token set to `REDMINE_DEV_API_KEY`); verify `GET /users/current.json` with the key returns admin after `docker compose --profile trackers up -d --force-recreate redmine` and again after a restart (REQ-099)
- [x] 2.2 OpenProject compose env: add `OPENPROJECT_SEED_ADMIN_USER_PASSWORD_RESET: 'false'`, remove `OPENPROJECT_DEMO__DATA`; verify `docker compose --profile trackers config` renders it and a fresh volume boots with admin login not forcing a password change (REQ-079)
- [x] 2.3 Implement `src/openproject/bootstrap.ts`: probe `GET /api/v3/users/me` with the dev key; when it fails, run `docker compose exec -T openproject bundle exec rails runner` that replaces admin's `Token::API` rows with one hashed from `OPENPROJECT_DEV_API_KEY`, then re-probe and fail loudly if still unauthenticated (REQ-348)
- [x] 2.4 Unit tests for 2.3 with faked probe and faked exec: skip when key works, exec once when it does not, error when the re-probe fails
- [x] 2.5 Add `REDMINE_DEV_API_KEY`, `OPENPROJECT_DEV_API_KEY`, `REDMINE_ADMIN_PASSWORD` to the trackers block of `.env.example` (uncommented, dev-only comment); verify `cp .env.example .env` still starts the dev stack unchanged

## 3. Fixture and generator

- [x] 3.1 Write `src/fixture/nordwind.ts` and `src/fixture/helios.ts`: typed project trees (identifier, name, parent, internal flag), 6–8 issues per leaf/sibling project with subject, arc slot and a comment pool per issue, per REQ-349/REQ-350 and design.md — D4
- [x] 3.2 Unit test the fixture data: every tree is three levels deep with the required siblings and internal project, every leaf/sibling has 6–8 issues with distinct subjects, ≥2 `open-unlogged` issues per project, internal projects have a logged issue
- [x] 3.3 Implement `src/generator/calendar.ts` (weekdays in `[D−91, D−1]`, holiday week, weekly tracker split, per-day log counts and hour budgets) and `src/generator/logs.ts` (seeded `mulberry32`, arc-driven issue selection, per-week pattern guarantees: repeated comment, sibling comments, one blank, one internal) producing `{ trackerKey, spentOn, issueRef, activityIndex, durationSeconds, comment }[]` (REQ-351)
- [x] 3.4 Unit tests for 3.3: no weekend logs, exact holiday gap, Mon/Tue vs Wed/Thu vs Fri split, per-day totals within bounds, every week satisfies all four patterns per active tracker, identical output for identical run date, different day shifts the window only

## 4. Planner and executors

- [x] 4.1 Implement `src/planner.ts`: given current remote state (projects, issues, admin logs, demo projects) and the fixture + generated logs, produce ordered operations (`deleteDemoProject`, `ensureProject`, `ensureIssue`, `closeIssue`, `deleteLog` when `--reset`, `createLog`) with skips for existing keys (REQ-352); print as `--dry-run`
- [x] 4.2 Unit tests for 4.1: fresh state → full plan; fully seeded state → zero creations; `--reset` deletes only matching admin logs; hand-made project/issue/log untouched; next-day run adds only the new day; hand-changed issue status is not reverted
- [x] 4.3 Implement `src/redmine/state.ts` + `src/redmine/execute.ts`: read projects (`projects.json`, all pages), issues per project (`status_id=*`), admin time entries for the range (`time_entries.json`, `user_id=me`), closed status id and trackers from enumerations; execute `ensureProject` (identifier, parent, `enabled_module_names` incl. `time_tracking`), `ensureIssue`, `closeIssue`, and logs via `RedmineAdapter.createTimeEntry` / `deleteTimeEntry`, sequentially
- [x] 4.4 Unit tests for 4.3 with faked responses: state parsing incl. pagination, request bodies for each operation, error surfaced with tracker + step
- [x] 4.5 Implement `src/openproject/state.ts` + `src/openproject/execute.ts`: read projects (`api/v3/projects` incl. parent links), work packages per project, admin time entries for the range, closed status and default type; execute `deleteDemoProject` (DELETE + poll until absent), `ensureProject` (identifier, parent, time-tracking module active), `ensureIssue` (work package with type), `closeIssue` (PATCH with `lockVersion`), and logs via `OpenProjectAdapter.createTimeEntry` / `deleteTimeEntry` with concurrency 4
- [x] 4.6 Unit tests for 4.5 with faked responses: parent link parsing, demo deletion polling, `lockVersion` on close, concurrency bound, error surfaced with tracker + step
- [x] 4.7 Implement `src/cli.ts` orchestration: parse `--dry-run` / `--reset` / `--help`, health wait, bootstrap, per-tracker plan + execute with isolation (one failing tracker does not stop the other, exit code 1), progress lines with counts, final summary with base URLs and keys (REQ-347); unit test the orchestration with faked steps for success, one-tracker failure, dry-run

## 5. Documentation

- [x] 5.1 `README.md`: replace the Redmine manual setup checklist and the OpenProject API-token step with the two-command flow (`docker compose --profile trackers up -d`, `pnpm trackers:seed`), the key variables and headers, `--reset` / `--dry-run`, and a note on what the fixture contains and how to scope a Project to exercise import (REQ-102)
- [x] 5.2 `AGENTS.md`: setup commands and Build and Deployment bullets mention the seed command and dev key variables; Docker Compose table row for `docker-compose.yml` notes the seed (REQ-082)
- [x] 5.3 `.env.example` and `docker-compose.yml` header comments mention `pnpm trackers:seed`; verify `grep -rn "Access tokens\|Enable REST web service" README.md AGENTS.md` shows only the new wording

## 6. End-to-end verification (manual, local trackers)

- [x] 6.1 `docker compose --profile trackers down -v && docker compose --profile trackers up -d && pnpm trackers:seed`: verify exit 0, trees and issue counts on both trackers, log count per tracker roughly 90–110, no weekend logs, demo projects gone; run again and verify zero creations
- [x] 6.2 In OSI (`pnpm dev`): add both trackers with the printed keys, scope a Project to `fleet-platform` and one to `solar-portal`, run Import history for the last 3 months on each; verify reused Tasks, sibling Tasks, an `empty` Task, and the internal project reported as unmatched; then `pnpm trackers:seed --reset` and verify hand-made logs survive
