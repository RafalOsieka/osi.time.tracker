# Tasks

All groups ship in one PR (`chore(deps): …`), one commit per group, on a branch from an up-to-date `main`. There is no frontend or backend feature code. The tests for each group are the existing quality gates, run inside that group so a failure is pinned to one tool. Nuxt stays on 4.5.2 (see proposal Non-goals).

## 1. Vite+ 1.1.0 (toolchain, own commit)

- [x] 1.1 Check that the image exists with `docker pull ghcr.io/voidzero-dev/vite-plus:1.1.0`. If it doesn't, stop the group: REQ-370 forbids splitting the tag from the catalog.
- [x] 1.2 In `pnpm-workspace.yaml`, replace the ten `@1.0.0` `minimumReleaseAgeExclude` entries with the matching `@1.1.0` entries (`vite-plus`, `@voidzero-dev/vite-plus-core`, the eight platform binaries). Verify that `vp info vite-plus@1.1.0 version` resolves.
- [x] 1.3 Run `vp migrate --no-interactive --no-agent --no-editor --no-hooks` with the global `vp` at 1.1.0. Verify that the catalog pins `vite-plus: 1.1.0`, `vite: npm:@voidzero-dev/vite-plus-core@1.1.0`, `vitest: 5.0.3` and `@vitest/coverage-v8: 5.0.3`, that the overrides are unchanged in shape, and that `vp toolchain vitest` reports 5.0.3.
- [x] 1.4 Bump both `ghcr.io/voidzero-dev/vite-plus` tags in `Dockerfile` (`:10`, `:42`) to `1.1.0`. Verify with `docker build .` and `docker build --target migrator .`, which must both succeed.
- [x] 1.5 Verify that `pnpm lint`, `pnpm format:check`, `pnpm type-check`, `pnpm test:unit` and `pnpm test:nuxt` pass, and that `vp why vitest` lists one version.

## 2. Remaining dependencies (own commit)

- [x] 2.1 Run `vp update -r` for `eslint`, `eslint-plugin-oxlint`, `@typescript-eslint/parser`, `vue-tsc`, `@nuxt/test-utils`, `@types/node` and `@iconify-json/lucide`, plus the `JetBrains/junie-github-action` SHA pin. Leave `typescript` (6), `@adonisjs/hash` (9), `nuxt` and `@nuxt/schema` (4.5.2) alone. Verify that `vp outdated -r` lists only those four, and that the Junie action comment reads `v1.7.17`.
- [x] 2.2 Verify that `pnpm lint`, `pnpm format:check`, `pnpm type-check`, `pnpm test:unit` and `pnpm test:nuxt` pass, and that `pnpm dev` serves `/login` with 200.

## 3. Dependabot and upgrade docs (own commit)

- [ ] 3.1 In `.github/dependabot.yml`, add `ignore` for `vite-plus`, `vite`, `vitest`, `@vitest/*` and `@voidzero-dev/*` (npm) and for `ghcr.io/voidzero-dev/vite-plus` (docker), plus an npm `groups` entry for `nuxt` and `@nuxt/*` (platform-ci REQ-021). Verify that the file parses as YAML with the expected keys and that the `node` base image is not ignored.
- [ ] 3.2 Add an "Upgrading dependencies" subsection under Commands in `AGENTS.md`. Cover:
  - Vite+: `minimumReleaseAgeExclude` for fresh releases, then `vp migrate` with the global `vp` at the target version, with the Dockerfile tag in the same commit.
  - Nuxt: `vp -C apps/web add nuxt@<v>`, `vp -C apps/web add -D @nuxt/schema@<v>`, `vp dedupe`. Explain why not `nuxt upgrade`, and run `pnpm dev` locally before merging.
  - Everything else: `vp update -r <names>`.
  - The `vp outdated -r` check, and which packages Dependabot skips.

  Verify that the documented commands match the ones used in this change and that `pnpm format:check` passes.

## 4. Integration check

- [ ] 4.1 Rebase onto the latest `main` and re-run the full gate set (`pnpm lint`, `pnpm format:check`, `pnpm type-check`, `pnpm test:unit`, `pnpm test:nuxt`, `pnpm test:e2e`, `docker build .`). Verify that everything is green, then run `openspec validate bump-dependencies --strict`.
