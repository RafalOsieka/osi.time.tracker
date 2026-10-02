## MODIFIED Requirements

### Requirement: REQ-082 Documented usage
The repository SHALL document, in `docs/development.md` only, how to start and stop the local trackers via the `trackers` profile, that `pnpm trackers:seed` bootstraps the accounts and seeds the dev fixture (replacing the former manual setup steps), what the fixture contains, and where the dev API keys come from (`OPENPROJECT_DEV_API_KEY`, `REDMINE_DEV_API_KEY` in `.env`, with the header each is sent in). `README.md` and `AGENTS.md` SHALL NOT carry this setup.

#### Scenario: Docs describe bring-up, teardown, and API keys
- **WHEN** a developer reads `docs/development.md`
- **THEN** they find the profile-based start/stop commands, the seed command, the fixture description, the two dev key variables with their headers, and no remaining manual setup checklist

#### Scenario: Setup lives in one place
- **WHEN** a developer reads `README.md` or `AGENTS.md`
- **THEN** neither repeats the local tracker setup; README links to `docs/development.md`
