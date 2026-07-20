## Why

The second remote-tracker adapter (Redmine) is next on the roadmap, and — exactly as with OpenProject — building and testing it requires a real local Redmine instance. Today the repo only provides `docker-compose.openproject.yml`; any Redmine integration work would need manual, non-reproducible external setup. Standing up a reproducible, opt-in Redmine dev environment now unblocks the `add-redmine-adapter` change and lets us verify integration realities (API-key auth, REST enablement, time-entry activities, decimal hours) early.

## What Changes

- Add a dedicated, opt-in `docker-compose.redmine.yml` that runs the official Redmine image with its own PostgreSQL container, for development only.
- Enable Redmine's built-in default data on first boot (`REDMINE_LOAD_DEFAULT_DATA=true`) so roles, issue statuses, workflows, and time-entry activities (Design/Development) exist without manual configuration.
- Map a non-conflicting host port (default `8091`, env-overridable) for plain-HTTP localhost access.
- Persist Redmine data in dedicated named volumes, isolated from the app's Postgres volumes and from the OpenProject dev volumes.
- Document usage in `README.md`: bring-up/tear-down commands plus the required one-time manual steps — admin password change, enabling the REST web service, creating a sample project with issues, and obtaining the API access key. `AGENTS.md` only lists the compose file.

## Capabilities

### New Capabilities
- `redmine-dev-environment`: A committed, reproducible local Redmine instance (via a separate Docker Compose file with default data) that developers can start on demand for building and testing the Redmine adapter.

### Modified Capabilities
<!-- None. This is dev tooling only; no runtime application behavior or existing spec requirements change. -->

## Impact

- **New file**: `docker-compose.redmine.yml` (kept separate from `docker-compose.yml`; not part of the default dev stack).
- **Docs**: `README.md` (Local Redmine setup); `AGENTS.md` compose-file table row only; possibly `.env.example` for optional overrides (port, database password).
- **No application code, schema, API, or dependency changes.** No CI changes (developer-invoked, not part of automated tests).
- **Non-goals**: No Redmine adapter, client, or app API calls — that is the separate `add-redmine-adapter` change. No automated seed script (`rails runner` seeding deferred; default data + documented manual steps suffice for MVP). No changes to the OpenProject dev environment.
