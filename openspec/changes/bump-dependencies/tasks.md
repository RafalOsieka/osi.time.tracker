# Tasks

All groups ship in one PR (`chore(deps): …`), one commit per group, on a branch from an up-to-date `main`. There is no frontend or backend feature code. The tests for each group are the existing quality gates, run inside that group so a failure is pinned to one tool.

## 1. Vite+ 1.1.0 (toolchain, own commit)

- [x] 1.1 Check that the image exists with `docker pull ghcr.io/voidzero-dev/vite-plus:1.1.0`. If it doesn't, stop the group: REQ-370 forbids splitting the tag from the catalog.
- [x] 1.2 In `pnpm-workspace.yaml`, replace the ten `@1.0.0` `minimumReleaseAgeExclude` entries with the matching `@1.1.0` entries (`vite-plus`, `@voidzero-dev/vite-plus-core`, the eight platform binaries). Verify that `vp info vite-plus@1.1.0 version` resolves.
- [x] 1.3 Run `vp update vite-plus`, then `./node_modules/.bin/vp migrate`. Verify that the catalog pins `vite-plus: 1.1.0`, `vite: npm:@voidzero-dev/vite-plus-core@1.1.0`, `vitest: 5.0.3` and `@vitest/coverage-v8: 5.0.3`, that the overrides are unchanged in shape, and that `vp toolchain vitest` reports 5.0.3.
- [x] 1.4 Bump both `ghcr.io/voidzero-dev/vite-plus` tags in `Dockerfile` (`:10`, `:42`) to `1.1.0`. Verify with `docker build .`, which must succeed.
- [x] 1.5 Verify that `pnpm lint`, `pnpm format:check`, `pnpm type-check`, `pnpm test:unit` and `pnpm test:nuxt` pass, and that `vp why vitest` lists one version.

## 2. Nuxt 4.6 (framework, own commit)

- [ ] 2.1 Run `vp exec -C apps/web nuxt upgrade --dedupe`. Verify that `apps/web/package.json` has `nuxt` and `@nuxt/schema` at `^4.6.0` and that `vp why unhead` and `vp why unctx` each resolve a single major (REQ-083).
- [ ] 2.2 Run `pnpm type-check`. If the `h3` type imports (`server/utils/auth.ts`, `server/utils/zod-input.ts`, `server/utils/request-error-log.ts`, `server/plugins/error-logging.ts`, `server/api/time-entries/running.get.ts`, `test/unit/request-error-log.spec.ts`) fail to resolve, add `h3` as an `apps/web` devDependency at the version `vp why h3` reports for Nitro. Verify that type-check passes.
- [ ] 2.3 If type-check reports errors caused by the shared `typescript.tsConfig` baseline or the newly included `server/types/`, scope the test `include` to `appTsConfig`/`serverTsConfig` in `nuxt.config.ts`, matching where those tests type-checked before, and update the comment there. Verify that type-check passes and that `test/e2e/**` and `test/unit/*` are still type-checked.
- [ ] 2.4 Start `pnpm dev`. If the Nuxt CLI v4 TUI breaks the `vp run --log labeled` output, add `--no-tui` to `apps/web`'s `dev` script. Verify that the app serves on http://localhost:3000 and login works.
- [ ] 2.5 With `pnpm dev` running, start `pnpm test:e2e:dev` and check whether the `.nuxt/` lock file makes it take over or defer to the running server. If it does, add a note to `docs/e2e-guideline.md`. Verify that the documented behavior matches what you saw.
- [ ] 2.6 Verify that `pnpm lint`, `pnpm format:check`, `pnpm test:unit`, `pnpm test:nuxt` and `pnpm test:e2e` (db, api, ui against the production build) all pass. Any module incompatibility means revert, not patch (REQ-083).

## 3. Remaining dependencies (own commit)

- [ ] 3.1 Run `vp update -r` for `eslint`, `eslint-plugin-oxlint`, `@typescript-eslint/parser`, `vue-tsc`, `@nuxt/test-utils`, `@types/node` and `@iconify-json/lucide`, plus the `JetBrains/junie-github-action` SHA pin. Leave `typescript` (6) and `@adonisjs/hash` (9) alone. Verify that `vp outdated -r` lists only `typescript` and `@adonisjs/hash`, and that the Junie action comment reads `v1.7.17`.
- [ ] 3.2 Verify that `pnpm lint`, `pnpm format:check`, `pnpm type-check`, `pnpm test:unit` and `pnpm test:nuxt` pass.

## 4. Dependabot and upgrade docs (own commit)

- [ ] 4.1 In `.github/dependabot.yml`, add `ignore` for `vite-plus`, `vite`, `vitest`, `@vitest/*` and `@voidzero-dev/*` (npm) and for `ghcr.io/voidzero-dev/vite-plus` (docker), plus an npm `groups` entry for `nuxt` and `@nuxt/*` (platform-ci REQ-021). Verify that the file validates against the Dependabot schema (`vp dlx ajv-cli` or the GitHub UI "Check for updates" after merge) and that the `node` base image is not ignored.
- [ ] 4.2 Add an "Upgrading dependencies" subsection under Commands in `AGENTS.md`. Cover Vite+ (`minimumReleaseAgeExclude` for fresh releases, `vp update vite-plus` + `vp migrate`, Dockerfile tag in the same commit), Nuxt (`vp exec -C apps/web nuxt upgrade --dedupe`), everything else (`vp update -r`), the `vp outdated -r` check, and which packages Dependabot skips. Verify that every command in it runs as written and that `pnpm format:check` passes.

## 5. Integration check

- [ ] 5.1 Rebase onto the latest `main` and re-run the full gate set (`pnpm lint`, `pnpm format:check`, `pnpm type-check`, `pnpm test:unit`, `pnpm test:nuxt`, `pnpm test:e2e`, `docker build .`). Verify that everything is green, then run `openspec validate bump-dependencies --strict`.
