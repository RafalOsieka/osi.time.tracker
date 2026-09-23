## 1. Baseline and dependency alignment

- [x] 1.1 Check latest stable versions and Node engine compatibility for Oxfmt, concurrently, Vitest, and matching coverage-v8; verify chosen versions against the package registry on Node 24.
- [x] 1.2 Capture existing `pnpm test:coverage` included-file set when prerequisites allow; verify the baseline report is available for comparison or record why it is not.
- [x] 1.3 Update root and five workspace manifests plus `pnpm-lock.yaml` for the chosen releases, keeping Vitest aligned across all six manifests and matching coverage-v8 exactly; verify `pnpm install --frozen-lockfile` succeeds.

## 2. Test infrastructure migration

- [x] 2.1 Replace the two removed `it.sequential` calls in `apps/web/test/e2e/ui/i18n-login.spec.ts` without changing the locale assertions; verify the UI spec loads and runs when Chromium and DB are available.
- [x] 2.2 Run `pnpm test:unit` and `pnpm test:nuxt`; if Vitest 5 changes mock setup or project isolation, fix only proven incompatibilities and rerun the affected suites until green.
- [x] 2.3 Run `pnpm test:coverage` and compare included files with the baseline, including configured exclusions; verify `text`, `json-summary`, and `lcov` reports retain the intended `unit` + `nuxt` scope.

## 3. Workspace verification

- [x] 3.1 Run `pnpm format:check`, `pnpm lint`, and `pnpm type-check`; verify no unrelated formatting drift or newly failing quality gates remain.
- [ ] 3.2 Run `pnpm test:e2e:db`, `pnpm test:e2e:api`, and `pnpm test:e2e:ui` with Docker and Chromium where available; verify project ordering, Nuxt wiring, and UI behavior, recording blocked prerequisites explicitly.
  - Blocked locally: Docker Desktop Linux engine is unavailable, so database-backed E2E and the Chromium UI spec were not run.
- [x] 3.3 Start `pnpm dev` briefly and stop it; verify concurrently labels/colors and `-k` child-process shutdown without touching production or preview services.
- [x] 3.4 Review results against existing platform specs and report any blocked upgrade (keeping Vitest and coverage-v8 aligned if rollback is necessary); verify the final manifest/lockfile versions and test status are consistent.