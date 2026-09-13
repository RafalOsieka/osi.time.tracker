## MODIFIED Requirements

### Requirement: REQ-079 Demo data seeded on first boot
OpenProject SHALL boot with its built-in basic seeds (time-tracking activities, work package types and statuses) and with the forced admin password change disabled, so `admin` can log in and the seed command (`tracker-dev-seed`) can create the dev fixture without manual configuration. The stock demo projects that OpenProject seeds unconditionally SHALL be removed by the seed command; the dev compose file SHALL NOT claim to control demo-data seeding.

#### Scenario: Sample content available after first boot
- **WHEN** the instance finishes its first boot
- **THEN** time-tracking activities and work package types exist and `admin` logs in without a forced password change

#### Scenario: Fixture replaces demo content
- **WHEN** `pnpm trackers:seed` has run
- **THEN** only the Helios Energy fixture projects are present and the stock demo projects are gone

### Requirement: REQ-082 Documented usage
The repository SHALL document, in `AGENTS.md`, how to start and stop the local
OpenProject instance via the `trackers` profile, that `pnpm trackers:seed` bootstraps
the account and seeds the dev fixture, and where the dev API key comes from
(`OPENPROJECT_DEV_API_KEY` in `.env`).

#### Scenario: Docs describe bring-up, teardown, and API key
- **WHEN** a developer reads the "Build and Deployment" section of `AGENTS.md`
- **THEN** they find the profile-based start/stop commands, the seed command, and the dev API key variable to paste into OSI

### Requirement: REQ-099 Default data seeded on first boot
The Redmine instance SHALL seed built-in default data on first boot via
`REDMINE_LOAD_DEFAULT_DATA=true`, so roles, issue statuses, workflows, and
time-entry activities exist without manual configuration, and SHALL on every boot
complete the admin account: password set to `REDMINE_ADMIN_PASSWORD` (default
`admin`), forced password change cleared, REST web service enabled, and the API key
set to `REDMINE_DEV_API_KEY`. Sample projects, issues and time logs are seeded by the
seed command (`tracker-dev-seed`), not on boot.

#### Scenario: Default configuration available after first boot
- **WHEN** the instance finishes its first-boot seeding
- **THEN** default roles, issue statuses, and time-entry activities are present
  and visible after logging in

#### Scenario: API usable without the UI
- **WHEN** the container reports healthy
- **THEN** `GET /users/current.json` with `X-Redmine-API-Key: <REDMINE_DEV_API_KEY>` returns the admin user and no forced password change blocks the web login

#### Scenario: Bootstrap is idempotent across restarts
- **WHEN** the container restarts on an existing volume
- **THEN** the key and settings are unchanged and no duplicate API token exists

### Requirement: REQ-102 Documented usage and manual setup steps
The repository SHALL document, in `README.md`, how to start and stop the local
Redmine instance via the `trackers` profile and that `pnpm trackers:seed` replaces
the former one-time manual steps (password change, enabling the REST web service,
creating a sample project with issues, obtaining the API access key), stating the
dev key variable (`REDMINE_DEV_API_KEY`) and the header it is sent in.
`AGENTS.md` MAY mention the profile and the seed command only (e.g. in the Docker
Compose table) without extended setup instructions.

#### Scenario: Docs describe bring-up, teardown, and manual steps
- **WHEN** a developer reads the Deployment section of `README.md`
- **THEN** they find the profile-based start/stop commands, the seed command, the two dev key variables, and no remaining manual setup checklist
