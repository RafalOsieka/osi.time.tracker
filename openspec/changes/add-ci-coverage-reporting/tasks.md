## 1. Coverage tooling & config (tooling)

- [x] 1.1 Add `@vitest/coverage-v8` as a devDependency matching the installed Vitest 4 major; run `pnpm install` and commit the updated `pnpm-lock.yaml` (REQ-NFR-030)
- [x] 1.2 Add a `coverage` block to `vitest.config.ts`: `provider: 'v8'`, reporters `['text', 'json-summary', 'lcov']`, `reportsDirectory: 'coverage'`, `include: ['app/**', 'server/**', 'shared/**']`, and excludes for `test/**`, config files, generated Nuxt output, and type-only files (REQ-NFR-030)
- [x] 1.3 Add a `test:coverage` script running `unit` + `nuxt` projects together with coverage in one invocation (e.g. `vitest run --coverage --project unit --project nuxt`), explicitly excluding `e2e` (REQ-NFR-030)
- [x] 1.4 Add `coverage/` to `.gitignore` (REQ-NFR-030)
- [x] 1.5 Verify locally: `pnpm test:coverage` produces `coverage/lcov.info` and a text summary covering only `app/`, `server/`, `shared/`; confirm `e2e` is not executed (REQ-NFR-030)

## 2. Codecov configuration (tooling)

- [x] 2.1 Add `codecov.yml` at repo root with `coverage.status.project.default.informational: true` and `coverage.status.patch.default.informational: true` (report-only, no gating); optionally set `comment` layout for the PR comment (REQ-NFR-031, REQ-NFR-032)
- [x] 2.2 Document the one-time Codecov linkage (link repo on codecov.io; add `CODECOV_TOKEN` repo secret only if tokenless upload is unavailable) — as manual setup notes in the proposal/README, since it is not a repo file (REQ-NFR-031)

## 3. CI workflow (tooling/CI)

- [x] 3.1 Add a `coverage` job to `.github/workflows/ci.yml` mirroring the existing verify-job skeleton (checkout, pnpm setup, Node 25, `pnpm install --frozen-lockfile`, pnpm-store cache) and running `pnpm test:coverage` (REQ-NFR-031, REQ-NFR-022)
- [x] 3.2 Add an upload step using a version-pinned (commit-SHA) `codecov/codecov-action` pointing at `coverage/lcov.info`; pass `token: ${{ secrets.CODECOV_TOKEN }}` and keep `permissions: contents: read` (REQ-NFR-031, REQ-NFR-026)
- [x] 3.3 Keep the `coverage` job parallel with other verify jobs and do NOT add it to `e2e`'s `needs:` nor to the merge-blocking required checks yet (REQ-NFR-032)

## 4. Documentation & verification

- [x] 4.1 Add a Codecov coverage badge to `README.md` and a short "Coverage" note (scope = unit + nuxt, report-only) (REQ-NFR-031)
- [x] 4.2 Update `AGENTS.md` Testing section with the `pnpm test:coverage` command and the coverage scope/policy (REQ-NFR-030, REQ-NFR-032)
- [x] 4.3 Open a PR and confirm: the `coverage` job runs green, the Codecov comment appears with diff coverage, and a coverage decrease does not fail the check (REQ-NFR-031, REQ-NFR-032)
