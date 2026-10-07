# Retired requirement codes

Requirement codes (`REQ-<NNN>`) in `openspec/specs` are never reused. When a requirement leaves the specs, its code is listed here so an old reference in code, tests, migrations or history can still be resolved.

| Code    | Was                                                      | Now                                                                                                                              |
| ------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| REQ-014 | platform-ci: pull-request and push triggers              | dropped: [`ci.yml`](../.github/workflows/ci.yml)                                                                                 |
| REQ-015 | platform-ci: parallel verify jobs                        | dropped: [`ci.yml`](../.github/workflows/ci.yml)                                                                                 |
| REQ-016 | platform-ci: frozen-lockfile install                     | dropped: [`ci.yml`](../.github/workflows/ci.yml)                                                                                 |
| REQ-017 | platform-ci: gated e2e jobs                              | dropped: [`ci.yml`](../.github/workflows/ci.yml)                                                                                 |
| REQ-018 | platform-ci: cancel superseded runs                      | dropped: [`ci.yml`](../.github/workflows/ci.yml)                                                                                 |
| REQ-020 | platform-ci: least privilege, pinned actions             | dropped: [`ci.yml`](../.github/workflows/ci.yml)                                                                                 |
| REQ-021 | platform-ci: Dependabot                                  | dropped: [`dependabot.yml`](../.github/dependabot.yml)                                                                           |
| REQ-022 | platform-ci: CodeQL                                      | dropped: GitHub default setup                                                                                                    |
| REQ-275 | platform-ci: build artifact reused by e2e                | dropped: [`ci.yml`](../.github/workflows/ci.yml)                                                                                 |
| REQ-276 | platform-ci: UI job installs Chromium                    | dropped: [`ci.yml`](../.github/workflows/ci.yml)                                                                                 |
| REQ-024 | platform-coverage: unit and nuxt coverage                | [`e2e-guideline.md`](./e2e-guideline.md#coverage)                                                                                |
| REQ-025 | platform-coverage: Codecov reporting                     | [`e2e-guideline.md`](./e2e-guideline.md#coverage)                                                                                |
| REQ-026 | platform-coverage: report-only coverage policy           | dropped: [`codecov.yml`](../codecov.yml)                                                                                         |
| REQ-277 | platform-coverage: API e2e coverage from Nitro           | [`e2e-guideline.md`](./e2e-guideline.md#coverage)                                                                                |
| REQ-278 | platform-coverage: Codecov flags                         | [`e2e-guideline.md`](./e2e-guideline.md#coverage)                                                                                |
| REQ-279 | platform-coverage: non-executable files excluded         | dropped: `apps/web/vitest.config.ts`                                                                                             |
| REQ-407 | platform-coverage: db e2e coverage                       | [`e2e-guideline.md`](./e2e-guideline.md#coverage)                                                                                |
| REQ-078 | platform-dev-trackers: opt-in `trackers` profile         | dropped: tested in `apps/dev-seed`                                                                                               |
| REQ-079 | platform-dev-trackers: trackers boot usable without UI   | dropped: tested in `apps/dev-seed`                                                                                               |
| REQ-080 | platform-dev-trackers: plain-HTTP local ports            | [`development.md`](./development.md#local-trackers-openproject-and-redmine)                                                      |
| REQ-081 | platform-dev-trackers: isolated volumes                  | dropped: tested in `apps/dev-seed`                                                                                               |
| REQ-082 | platform-dev-trackers: documented usage                  | dropped: the docs themselves                                                                                                     |
| REQ-347 | platform-dev-trackers: one seed command                  | dropped: tested in `apps/dev-seed`                                                                                               |
| REQ-348 | platform-dev-trackers: admin accounts and dev keys       | dropped: tested in `apps/dev-seed`                                                                                               |
| REQ-349 | platform-dev-trackers: project fixture                   | [`development.md`](./development.md#what-gets-seeded)                                                                            |
| REQ-350 | platform-dev-trackers: issue fixture                     | [`development.md`](./development.md#what-gets-seeded)                                                                            |
| REQ-351 | platform-dev-trackers: three months of logs              | dropped: tested in `apps/dev-seed`                                                                                               |
| REQ-352 | platform-dev-trackers: idempotent re-runs and reset      | dropped: tested in `apps/dev-seed`                                                                                               |
| REQ-052 | platform-e2e-harness: per-file database isolation        | [`e2e-guideline.md`](./e2e-guideline.md#running-the-suites)                                                                      |
| REQ-053 | platform-e2e-harness: parallel files with worker cap     | dropped: `apps/web/test/e2e/harness`                                                                                             |
| REQ-054 | platform-e2e-harness: two-mode server setup              | [`e2e-guideline.md`](./e2e-guideline.md#build-modes)                                                                             |
| REQ-055 | platform-e2e-harness: seeding helpers and guards         | dropped: `apps/web/test/e2e/harness`                                                                                             |
| REQ-056 | platform-e2e-harness: reliable teardown                  | dropped: `apps/web/test/e2e/harness`                                                                                             |
| REQ-057 | platform-e2e-harness: migrator on an empty database      | dropped: `apps/web/test/e2e/harness`                                                                                             |
| REQ-058 | platform-e2e-harness: `127.0.0.1` connection host        | dropped: `apps/web/test/e2e/harness`                                                                                             |
| REQ-271 | platform-e2e-harness: suite layout by runtime            | [`e2e-guideline.md`](./e2e-guideline.md#suites)                                                                                  |
| REQ-272 | platform-e2e-harness: user per test                      | [`e2e-guideline.md`](./e2e-guideline.md#running-the-suites)                                                                      |
| REQ-273 | platform-e2e-harness: in-file concurrency for API specs  | dropped: `apps/web/test/e2e/harness`                                                                                             |
| REQ-274 | platform-e2e-harness: historical migrations by prefix    | [`e2e-guideline.md`](./e2e-guideline.md#conventions)                                                                             |
| REQ-177 | platform-e2e-harness: extracted composables unit-tested  | [`coding-standards.md`](./coding-standards.md#10-testing)                                                                        |
| REQ-037 | (not retired) moved to platform-ci                       | `openspec/specs/platform-ci`                                                                                                     |
| REQ-280 | platform-lint-format: Oxlint then ESLint                 | dropped: `vite.config.ts` and the ESLint config                                                                                  |
| REQ-281 | platform-lint-format: overlapping ESLint rules off       | dropped: `vite.config.ts` and the ESLint config                                                                                  |
| REQ-282 | platform-lint-format: anti-slop rules fail lint          | dropped: `vite.config.ts` and the ESLint config                                                                                  |
| REQ-283 | platform-lint-format: Oxfmt is the formatter             | dropped: `vite.config.ts` and the ESLint config                                                                                  |
| REQ-083 | platform-toolchain: Nuxt 4.5 upgrade gates               | dropped: verification of a past upgrade                                                                                          |
| REQ-235 | platform-toolchain: zod 4 upgrade gates                  | dropped: verification of a past upgrade                                                                                          |
| REQ-305 | platform-toolchain: tracker package consumable alone     | dropped: root `package.json` scripts                                                                                             |
| REQ-306 | platform-toolchain: workspace workflows                  | dropped: root `package.json` scripts                                                                                             |
| REQ-370 | platform-toolchain: unified Vite+ toolchain              | [`AGENTS.md`](../AGENTS.md#upgrading-dependencies)                                                                               |
| REQ-155 | platform-type-safety: boundary shapes defined once       | [`coding-standards.md`](./coding-standards.md#6-boundary-types--validation)                                                      |
| REQ-157 | platform-type-safety: response DTOs typed as JSON        | merged into REQ-173 (core-api-conventions)                                                                                       |
| REQ-159 | platform-type-safety: explicit `any` is a lint error     | [`coding-standards.md`](./coding-standards.md#1-general-code-style)                                                              |
| REQ-036 | platform-type-safety: lint disables carry a reason       | [`coding-standards.md`](./coding-standards.md#1-general-code-style)                                                              |
| REQ-234 | platform-type-safety: zod 4 idiom, RFC-strict ids        | merged into REQ-172 (core-api-conventions); idiom in [`coding-standards.md`](./coding-standards.md#6-boundary-types--validation) |
| REQ-284 | platform-type-safety: unannotated `catch`                | [`coding-standards.md`](./coding-standards.md#1-general-code-style)                                                              |
| REQ-285 | platform-type-safety: no `typeof` narrowing              | dropped: enforced by `anti-slop/no-runtime-typeof`                                                                               |
| REQ-286 | platform-type-safety: primitive message params           | merged into REQ-171 (core-api-conventions)                                                                                       |
| REQ-238 | platform-type-safety: no double assertions in `app/`     | [`coding-standards.md`](./coding-standards.md#type-assertions)                                                                   |
| REQ-239 | platform-type-safety: assertion preference ladder        | [`coding-standards.md`](./coding-standards.md#type-assertions)                                                                   |
| REQ-240 | platform-type-safety: schema-typed UForm state           | [`coding-standards.md`](./coding-standards.md#reactive-state)                                                                    |
| REQ-241 | platform-type-safety: task-title menu items              | [`coding-standards.md`](./coding-standards.md#type-assertions)                                                                   |
| REQ-242 | platform-type-safety: task-keyed UI maps                 | [`coding-standards.md`](./coding-standards.md#reactive-state)                                                                    |
| REQ-243 | platform-type-safety: standards document Vue typing      | dropped: `coding-standards.md` itself                                                                                            |
| REQ-156 | (not retired) moved to core-api-conventions              | `openspec/specs/core-api-conventions`                                                                                            |
| REQ-158 | (not retired) moved to core-api-conventions              | `openspec/specs/core-api-conventions`                                                                                            |
| REQ-008 | core-authentication: protection of private endpoints     | merged into REQ-169 (core-api-conventions)                                                                                       |
| REQ-089 | workspace-projects: strict cross-user isolation          | merged into REQ-172 (core-api-conventions)                                                                                       |
| REQ-138 | workspace-tasks: strict cross-user isolation             | merged into REQ-172 (core-api-conventions)                                                                                       |
| REQ-248 | workspace-trackers: tracker isolation and auth           | merged into REQ-169, REQ-170 and REQ-172 (core-api-conventions)                                                                  |
| REQ-040 | core-persistence: unattended migrations under Compose    | merged into REQ-048 (platform-docker)                                                                                            |
| REQ-041 | core-persistence: migration tooling verification         | dropped: one-time check of a past change                                                                                         |
| REQ-259 | workspace-trackers: Trackers list on initial SSR render  | merged into REQ-391 (ui-routing)                                                                                                 |
| REQ-260 | workspace-projects: Projects list on initial SSR render  | merged into REQ-391 (ui-routing)                                                                                                 |
| REQ-174 | ui-shared-components: Nuxt UI components in dialog forms | [`coding-standards.md`](./coding-standards.md#4-vue-component-conventions); error announcement in REQ-002 (ui-accessibility)     |
| REQ-220 | (removed in #56) nearest-increment rounding              | now REQ-256 (workspace-trackers)                                                                                                 |
| REQ-221 | (removed in #56) never round a non-zero total to zero    | now REQ-257 (workspace-trackers)                                                                                                 |
| REQ-222 | (removed in #56) one-tap export-duration alternatives    | removed: Remote Sync offers no rounding alternatives (REQ-363, REQ-489)                                                          |
| REQ-132 | workspace-tasks: hard-delete lifecycle, merge invariant  | now REQ-491 (workspace-tasks), one garbage-collection rule for every operation                                                   |
| REQ-245 | workspace-trackers: create a tracker                     | now REQ-492 (workspace-trackers), without the obsolete `executionMode` rejection                                                 |
| REQ-249 | workspace-trackers: credentials never persisted          | now REQ-495 (workspace-trackers), without the removed server-mode rejection                                                      |
| REQ-314 | workspace-trackers: execution modes migrate              | dropped: one-time migration (`0020_direct_browser_access.sql`)                                                                   |
| REQ-364 | workspace-trackers: server mode migrates to client       | dropped: one-time migration (`0019_migrate_server_execution_mode.sql`)                                                           |
| REQ-399 | workspace-settings: user profile API                     | now REQ-493 (workspace-settings), without the former settings endpoint guarantee                                                 |
| REQ-400 | workspace-settings: profile page                         | now REQ-494 (workspace-settings), without the former settings page guarantee                                                     |
