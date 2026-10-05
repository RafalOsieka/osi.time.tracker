# Spec Delta

## ADDED Requirements

### Requirement: REQ-407 Database e2e coverage from the in-process db project
The `db` CI job SHALL collect Vitest `v8` coverage while running the `db` e2e project, which exercises server utilities and schema in the test process against Postgres. That report SHALL use the same first-party sources and exclude list as the unit+nuxt run (REQ-024, REQ-279). The job SHALL upload it to Codecov with flag `e2e-db`. The unit+nuxt `test:coverage` script SHALL still not run the db project.

#### Scenario: Db tests credit server utilities
- **WHEN** the db job runs a spec that calls a `server/utils` function against Postgres
- **THEN** the lines that function executed SHALL appear as covered in the uploaded `e2e-db` report

#### Scenario: Db report omits non-executable sources
- **WHEN** the db job writes its lcov
- **THEN** that lcov SHALL NOT list migration SQL/JSON or the bundler-warmup plugin, and SHALL NOT list test files

#### Scenario: Unit-nuxt run is unchanged
- **WHEN** `pnpm test:coverage` runs
- **THEN** it SHALL NOT start Postgres or run the db project

#### Scenario: Db test failure is not masked by coverage
- **WHEN** a db spec fails
- **THEN** the db job SHALL fail as a required check, and SHALL NOT upload a coverage report for that run

## MODIFIED Requirements

### Requirement: REQ-278 Codecov flags merge unit-nuxt and e2e-api
The unit+nuxt `coverage` job SHALL upload its lcov with Codecov flag `unit-nuxt`. The `api` job SHALL upload its Nitro-derived lcov with flag `e2e-api`. The `db` job SHALL upload its in-process lcov with flag `e2e-db` (REQ-407). Codecov SHALL combine those flags for the PR comment and default-branch totals. Coverage SHALL remain informational (REQ-026); no flag SHALL become a merge-blocking threshold.

#### Scenario: PR comment includes both flags
- **WHEN** the `coverage`, `api` and `db` jobs upload successfully on a pull request
- **THEN** the Codecov comment SHALL report coverage that includes the in-process unit/nuxt hits, the e2e-api Nitro hits and the e2e-db hits

#### Scenario: Api job failure does not block on coverage policy
- **WHEN** the api tests themselves fail
- **THEN** the `api` job SHALL be red as a required check (REQ-406) for the tests, independent of the informational coverage flags

#### Scenario: A missing flag upload keeps the last known flag coverage
- **WHEN** one flag's upload is absent on a pull request (for example, its job was skipped)
- **THEN** Codecov SHALL carry that flag forward from the base commit instead of reporting its files as uncovered
