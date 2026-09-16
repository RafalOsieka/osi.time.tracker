# platform-dev-trackers Specification

## Purpose
Define the committed, reproducible local remote-tracker instances (OpenProject and Redmine) that developers start on demand from the dev `docker-compose.yml` behind the opt-in `trackers` profile, and the `pnpm trackers:seed` command (package `apps/dev-seed`) that bootstraps their admin accounts, installs the fixed dev API keys and seeds the Nordwind/Helios fixture. Each instance is isolated from the application's dev database, from the other tracker, and from the production stack.

## Requirements

### Requirement: REQ-078 Opt-in local tracker services behind the `trackers` profile
The dev `docker-compose.yml` SHALL define a local OpenProject service and a local Redmine instance (official image plus a dedicated PostgreSQL service), all assigned to the `trackers` compose profile, so they are NOT started by the default `docker compose up -d` and require the profile to be activated explicitly.

#### Scenario: Not started by the default stack
- **WHEN** a developer runs `docker compose up -d` (default file, no profile)
- **THEN** only the app development infrastructure (database, pgadmin) starts and no OpenProject, Redmine, or Redmine database container is started

#### Scenario: Started explicitly on demand
- **WHEN** a developer runs `docker compose --profile trackers up -d`
- **THEN** local OpenProject and Redmine instances start alongside the default services and become reachable on their configured host ports

### Requirement: REQ-079 Trackers boot usable without manual UI setup
Each tracker SHALL come up with the built-in data needed for time tracking and an admin account usable by the seed command without any manual UI step. OpenProject SHALL boot with its basic seeds (time-tracking activities, work package types and statuses) and with the forced admin password change disabled. Redmine SHALL seed its default data on first boot via `REDMINE_LOAD_DEFAULT_DATA=true` (roles, issue statuses, workflows, time-entry activities) and SHALL on every boot complete the admin account: password set to `REDMINE_ADMIN_PASSWORD` (default `admin`), forced password change cleared, REST web service enabled, and the API key set to `REDMINE_DEV_API_KEY`. Sample projects, issues and time logs are seeded by the seed command (REQ-347 and following), not on boot; the stock demo projects that OpenProject seeds unconditionally SHALL be removed by the seed command, and the dev compose file SHALL NOT claim to control demo-data seeding.

#### Scenario: Time-tracking primitives exist after first boot
- **WHEN** either instance finishes its first boot
- **THEN** its time-tracking activities and issue/work-package types and statuses exist and `admin` logs in without a forced password change

#### Scenario: Redmine API usable without the UI
- **WHEN** the Redmine container reports healthy
- **THEN** `GET /users/current.json` with `X-Redmine-API-Key: <REDMINE_DEV_API_KEY>` returns the admin user

#### Scenario: Redmine bootstrap is idempotent across restarts
- **WHEN** the Redmine container restarts on an existing volume
- **THEN** the key and settings are unchanged and no duplicate API token exists

#### Scenario: Fixture replaces OpenProject demo content
- **WHEN** `pnpm trackers:seed` has run
- **THEN** only the Helios Energy fixture projects are present in OpenProject and the stock demo projects are gone

### Requirement: REQ-080 Local plain-HTTP access on non-conflicting ports
Each instance SHALL be reachable over plain HTTP on a fixed localhost port that does not conflict with the default dev services or with the other tracker: OpenProject with `OPENPROJECT_HTTPS=false` and a fixed host name/port so login and redirects work without TLS termination, and Redmine on `8091` by default (overridable via `REDMINE_PORT`).

#### Scenario: Login over plain HTTP succeeds
- **WHEN** a developer opens either configured `http://localhost:<port>` URL and logs in with the default admin credentials
- **THEN** authentication succeeds and no HTTPS redirect breaks the session

#### Scenario: Runs alongside the other dev stacks
- **WHEN** the dev stack is started with the `trackers` profile and default ports
- **THEN** database, pgadmin, OpenProject, and Redmine all start and no host-port conflict occurs

### Requirement: REQ-081 Isolated persistent storage per tracker
Each tracker's services SHALL persist their data in dedicated named volumes separate from the app dev database volume, from the other tracker's volumes, and from every production stack volume, so each can be inspected and wiped independently.

#### Scenario: Teardown of the dev stack never touches production
- **WHEN** a developer runs `docker compose --profile trackers down -v`
- **THEN** the dev volumes (including both trackers') are removed and the production stack's volumes are untouched

#### Scenario: Teardown removes only one tracker's data
- **WHEN** a developer removes only one tracker's named volumes
- **THEN** the app dev database volume and the other tracker's volumes keep their data

### Requirement: REQ-082 Documented usage
The repository SHALL document how to start and stop the local trackers via the `trackers` profile and that `pnpm trackers:seed` bootstraps the accounts and seeds the dev fixture, replacing the former one-time manual steps (password change, enabling the REST web service, creating a sample project with issues, obtaining the API access key). `AGENTS.md` ("Build and Deployment") SHALL state the profile-based commands, the seed command, and where the dev API keys come from (`OPENPROJECT_DEV_API_KEY`, `REDMINE_DEV_API_KEY` in `.env`, with the header each is sent in); `README.md` (Deployment) SHALL carry the extended setup description.

#### Scenario: Docs describe bring-up, teardown, and API keys
- **WHEN** a developer reads the "Build and Deployment" section of `AGENTS.md` or the Deployment section of `README.md`
- **THEN** they find the profile-based start/stop commands, the seed command, the two dev key variables, and no remaining manual setup checklist

### Requirement: REQ-347 One command seeds the running local trackers
The repository SHALL provide a root script `pnpm trackers:seed` that seeds the local OpenProject and Redmine instances started by `docker compose --profile trackers up -d`. The command SHALL wait (bounded) for both tracker healthchecks, SHALL read the tracker ports and dev API keys from the same `.env` compose reads, and SHALL finish by printing, for each tracker, the base URL and the API key to paste into the OSI tracker form. It SHALL exit non-zero with a message naming the tracker and step when a tracker is not running, does not become healthy in time, or rejects a request. Nothing SHALL be written to the OSI database.

#### Scenario: Fresh trackers become ready
- **WHEN** a developer runs `docker compose --profile trackers up -d` and then `pnpm trackers:seed` on a fresh volume
- **THEN** the command completes with exit code 0, both trackers hold the fixture, and the output lists `http://localhost:<port>` and the dev API key for each

#### Scenario: Trackers profile not running
- **WHEN** `pnpm trackers:seed` runs while the `trackers` services are not up
- **THEN** the command exits non-zero within the wait bound and names the missing service

#### Scenario: One tracker fails mid-way
- **WHEN** a request to one tracker fails while the other succeeds
- **THEN** the other tracker is still seeded, the failure is reported with the tracker and step, and the exit code is non-zero

#### Scenario: Dry run
- **WHEN** `pnpm trackers:seed --dry-run` runs against healthy trackers
- **THEN** the planned creations, skips and deletions per tracker are printed and no write is sent

### Requirement: REQ-348 Admin accounts and fixed dev API keys are bootstrapped without the UI
Both local trackers SHALL be usable through their REST APIs with a documented, fixed dev API key and a working `admin` login without any manual UI step. Redmine SHALL complete its own bootstrap on container boot: `admin` password set to the configured dev password with the forced password change cleared, the REST web service enabled, and an API key equal to `REDMINE_DEV_API_KEY`. OpenProject SHALL have the forced admin password change disabled at boot, and the seed command SHALL ensure an API token for `admin` whose plaintext equals `OPENPROJECT_DEV_API_KEY`, skipping the step when that key already authenticates. Both keys SHALL be present with working defaults in `.env.example`, marked as valid for the local dev trackers only.

#### Scenario: Redmine is API-ready when healthy
- **WHEN** the Redmine container reports healthy after a first boot
- **THEN** a request with the `X-Redmine-API-Key` header set to `REDMINE_DEV_API_KEY` succeeds and `admin` can log in without a forced password change

#### Scenario: OpenProject token is created once
- **WHEN** the seed command runs twice against the same OpenProject volume
- **THEN** the second run does not re-create the token, and HTTP Basic `apikey:<OPENPROJECT_DEV_API_KEY>` authenticates before and after

#### Scenario: Key changed in `.env`
- **WHEN** a developer changes `OPENPROJECT_DEV_API_KEY` in `.env` and re-runs the seed
- **THEN** the new key authenticates afterwards and the previous seeded token no longer does

#### Scenario: Bootstrap failure is visible
- **WHEN** the token step fails (for example the container is stopped mid-run)
- **THEN** the seed reports the bootstrap step for that tracker and does not proceed to seed content for it

### Requirement: REQ-349 Project fixture with three-level nesting, siblings, and an unscoped project
Each tracker SHALL receive a fixed project fixture modelling one client: Redmine models **Nordwind Logistics** (root `fleet-platform` with children `dispatch` and `telemetry`, each with two leaf children; siblings `warehouse-scanner` and `internal-it`), OpenProject models **Helios Energy** (root `solar-portal` with children `customer-app` and `gateway`, each with two leaf children; siblings `grid-analytics` and `helios-internal`). Every project SHALL have a stable identifier and a human-readable name, and the `*-internal`/`internal-it` project SHALL exist so that logs in it are unmatched in OSI until a developer scopes it. On OpenProject the seed SHALL remove the stock demo projects (`demo-project`, `your-scrum-project`) so the fixture is the only content. Time tracking SHALL be enabled on every seeded project.

#### Scenario: Tree shape on Redmine
- **WHEN** the seed has run
- **THEN** `GET /projects.json` shows `dispatch-web` with parent `dispatch`, `dispatch` with parent `fleet-platform`, and `warehouse-scanner` and `internal-it` without a parent

#### Scenario: Tree shape on OpenProject
- **WHEN** the seed has run
- **THEN** the project catalog fetched by OSI (REQ-318) shows `customer-web` under `customer-app` under `solar-portal`, and `grid-analytics` and `helios-internal` at the root

#### Scenario: Demo projects removed
- **WHEN** the seed runs on a fresh OpenProject volume
- **THEN** `demo-project` and `your-scrum-project` are absent afterwards and a re-run reports nothing to delete

#### Scenario: Hand-made project is left alone
- **WHEN** a developer created an extra project in either tracker before re-running the seed
- **THEN** that project is neither modified nor deleted

### Requirement: REQ-350 Issue fixture with a lifecycle arc
Every leaf project and every sibling project SHALL receive between six and eight issues (Redmine issues, OpenProject work packages) with domain-specific, distinct subjects. Each issue SHALL carry an arc slot that determines its status after seeding and whether it receives logs: `closed-early` and `closed-mid` issues SHALL be closed, `in-progress` issues SHALL be open and logged up to the end of the range, and at least two issues per project SHALL be open and never logged so they can be linked from OSI without prior history. The `internal` projects SHALL hold at least one logged issue.

#### Scenario: Issue counts and statuses
- **WHEN** the seed has run
- **THEN** each leaf and sibling project lists 6–8 issues, closed ones have the tracker's closed status, and at least two per project have no time logs

#### Scenario: Subjects are searchable from OSI
- **WHEN** a user searches issues by title in OSI for a scoped project
- **THEN** the fixture issues of that project (open and closed) appear in the results

#### Scenario: Re-run keeps existing issues
- **WHEN** the seed runs again
- **THEN** no duplicate issue is created for an existing `(project, subject)` and an issue whose status a developer changed by hand keeps that status

### Requirement: REQ-351 Three months of realistic, importable time logs
The seed SHALL create time logs for the `admin` account covering every weekday in the inclusive range from 91 days before the run date to the day before it, with no logs on weekends and exactly one full-week gap roughly six weeks back. Days SHALL follow a weekly split — Monday and Tuesday on the Redmine client, Wednesday and Thursday on the OpenProject client, Friday one log on each — with three to four logs per day totalling 6–8 hours (5–6 on Fridays), each log carrying a spent-on date, a duration, a fixture activity of that tracker, an issue, and a comment. Every week SHALL contain, per active tracker: a comment repeated on at least two days for the same issue, two different comments on one issue, exactly one log with a blank comment, and one log in the `internal` project. Logs SHALL be generated deterministically from a fixed seed per calendar week, so a given calendar day yields the same logs for every run within the same calendar week; the frame that positions weeks in the arc moves once a week.

#### Scenario: Range and rhythm
- **WHEN** the seed has run on date D
- **THEN** every weekday from D−91 to D−1 has logs on exactly one tracker (both on Fridays) except the holiday week, and no Saturday or Sunday has any

#### Scenario: One import exercises every routing rule
- **WHEN** a developer scopes an OSI Project to a fixture root project and runs Import history for the range on that tracker
- **THEN** the import creates Tasks reused across days, sibling Tasks on one issue, a Task named `empty`, and reports the `internal` project's logs as unmatched

#### Scenario: Determinism
- **WHEN** the generator is invoked twice with the same run date
- **THEN** it yields identical logs (date, issue, duration, activity, comment) in identical order

#### Scenario: Activity is always present
- **WHEN** any seeded log is fetched through the OSI adapters
- **THEN** it carries a non-null activity id and name belonging to that tracker

### Requirement: REQ-352 Idempotent re-runs and scoped reset
The seed SHALL read existing tracker state first and create only what is missing, keyed by project identifier, `(project, subject)` for issues, and `(issue, spent-on date, comment)` for the admin account's time logs; matches SHALL be skipped and never updated. `pnpm trackers:seed --reset` SHALL delete only the admin account's time logs that match a fixture key and then re-seed; it SHALL NOT delete projects, issues, or any log that does not match the fixture. A run on a later date SHALL add only the newly covered days.

#### Scenario: Second run is a no-op
- **WHEN** the seed runs twice on the same day against the same volumes
- **THEN** the second run reports zero creations and the log counts on both trackers are unchanged

#### Scenario: Hand-made log survives reset
- **WHEN** a developer logged time by hand on a fixture issue with a comment not in the fixture and then runs `--reset`
- **THEN** that log still exists while fixture logs are recreated

#### Scenario: Run later in the same week
- **WHEN** the seed runs one day after a previous run in the same calendar week
- **THEN** only the logs for the newly covered weekday (if any) are created

