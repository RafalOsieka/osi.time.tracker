## 1. CI workflow scaffold & shared setup (infra)

- [ ] 1.1 Create `.github/workflows/ci.yml` triggering on `pull_request` (branches: `main`) and `push` (branches: `main`) (REQ-NFR-020)
- [ ] 1.2 Add a `concurrency` group keyed on `github.ref` with `cancel-in-progress: true` (REQ-NFR-024)
- [ ] 1.3 Add a least-privilege top-level `permissions: contents: read` block and pin all third-party actions to fixed versions (REQ-NFR-026)
- [ ] 1.4 Define the shared setup steps (checkout, `pnpm/action-setup` at `^11.6.0`, `actions/setup-node` with pnpm store cache keyed on `pnpm-lock.yaml`, `pnpm install --frozen-lockfile` from repo root) (REQ-NFR-022)

## 2. Parallel verify jobs (infra)

- [ ] 2.1 Add the `lint` job running `pnpm lint` (REQ-NFR-021)
- [ ] 2.2 Add the `format` job running `pnpm format:check` (REQ-NFR-021)
- [ ] 2.3 Add the `type-check` job running `pnpm type-check` (REQ-NFR-021)
- [ ] 2.4 Add the `unit` job running `pnpm test:unit` (REQ-NFR-021)
- [ ] 2.5 Add the `nuxt` job running `pnpm test:nuxt` (REQ-NFR-021)
- [ ] 2.6 Add the `build` job running `pnpm build` (REQ-NFR-021)
- [ ] 2.7 Verify on a throwaway PR that each job appears as an independent status check and that a deliberate lint error reds only the `lint` job (REQ-NFR-021)
- [ ] 2.8 Verify that an out-of-sync `pnpm-lock.yaml` fails install fast (REQ-NFR-022)

## 3. Gated e2e job (infra)

- [ ] 3.1 Add the `e2e` job running `pnpm test:e2e` with `needs: [lint, format, type-check, unit, nuxt, build]` (REQ-NFR-023)
- [ ] 3.2 Pass `NUXT_SESSION_PASSWORD` from repository secrets via `env`; do not log it (REQ-NFR-023, REQ-NFR-026)
- [ ] 3.3 Rely on `test/e2e/support/postgres.ts` self-provisioning `postgres:18-alpine` (Docker preinstalled on `ubuntu-latest`) — no `services:` block (REQ-NFR-023)
- [ ] 3.4 Verify the `e2e` job runs only after the cheap jobs pass and is skipped when any upstream job fails (REQ-NFR-023)

## 4. Conventional-Commit PR-title lint (infra)

- [ ] 4.1 Add `.github/workflows/pr-title.yml` triggering on `pull_request` (`opened`, `edited`, `synchronize`) using a pinned `amannn/action-semantic-pull-request` (REQ-NFR-025)
- [ ] 4.2 Verify a valid Conventional-Commit title passes and a non-conforming title fails with a clear message (REQ-NFR-025)

## 5. Dependabot (infra)

- [ ] 5.1 Add `.github/dependabot.yml` configuring the `npm` ecosystem (root) on a weekly schedule (REQ-NFR-027)
- [ ] 5.2 Add the `github-actions` ecosystem to `.github/dependabot.yml` on a weekly schedule (REQ-NFR-027)

## 6. Manual GitHub-UI configuration guide (docs)

- [ ] 6.1 Write a setup guide doc covering the `main` branch ruleset: require a PR before merge, require status checks (`lint`, `format`, `type-check`, `unit`, `nuxt`, `build`, `e2e`, PR-title lint), require branch up-to-date, require conversation resolution (REQ-NFR-029)
- [ ] 6.2 Document squash-only merges + linear history, and that reviews and merge queue stay off (solo) (REQ-NFR-029)
- [ ] 6.3 Note that each check is only selectable after it has run once → push the workflow, open a throwaway PR, then pin the checks (REQ-NFR-029)
- [ ] 6.4 Document enabling CodeQL via Security-tab default setup (REQ-NFR-028)
- [ ] 6.5 Document adding the `NUXT_SESSION_PASSWORD` repository secret used by the e2e job (REQ-NFR-023)
