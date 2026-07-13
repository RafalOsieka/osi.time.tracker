## Why

Upcoming remote-integration work (user stories 9–11: remote system configuration, issue browse/link, and time push against Redmine/OpenProject) needs a real remote tracker to develop and test against. Today the repo has no local OpenProject instance, so any of that work would require manual, non-reproducible external setup. Standing up a reproducible OpenProject dev environment now unblocks that work and lets us discover integration realities (auth, CORS, CSP, time-tracking activities) early.

## What Changes

- Add a dedicated, opt-in `docker-compose.openproject.yml` that runs the official OpenProject all-in-one image locally for development only.
- Enable built-in demo data on first boot (`OPENPROJECT_DEMO__DATA=true`) so a sample project with work packages and time-tracking activities exists without manual clicking.
- Configure the instance for local dev correctness: fixed host name / port and `OPENPROJECT_HTTPS=false` so logins and redirects work over plain HTTP.
- Persist OpenProject data in its own dedicated named volume, isolated from the app's Postgres volumes.
- Document usage in `AGENTS.md` (bring-up/tear-down commands, how to obtain the API key) and, if needed, `.env.example` variables.

## Capabilities

### New Capabilities
- `openproject-dev-environment`: A committed, reproducible local OpenProject instance (via a separate Docker Compose file with demo data) that developers can start on demand for building and testing remote-tracker integration.

### Modified Capabilities
<!-- None. This is dev tooling only; no runtime application behavior or existing spec requirements change. -->

## Impact

- **New file**: `docker-compose.openproject.yml` (kept separate from `docker-compose.yml`; not part of the default dev stack).
- **Docs**: `AGENTS.md` (a "Local OpenProject" subsection under Docker Compose Files / Development Workflow); possibly `.env.example` for optional overrides (port, admin password).
- **No application code, schema, API, or dependency changes.** No CI changes (the instance is developer-invoked, not part of automated tests).
- **Non-goals**: No RemoteSystemConfig schema, no adapters, no API calls from the app, no CORS/CSP changes in `nuxt.config.ts`, and no user-story-9 work — those are separate future changes. No seed script or committed DB snapshot (relying on the demo-data flag). Redmine is out of scope for this change.
