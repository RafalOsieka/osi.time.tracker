# Proposal

## Why

The workspace is behind on its toolchain and framework: Vite+ 1.1.0 (bundling Vitest 5.0.3) and Nuxt 4.6 (with Nuxt CLI v4) are out, plus a set of patch and minor updates. Both Vite+ and Nuxt publish a recommended upgrade command that keeps their pinned and transitive dependencies aligned (`vp migrate`, `nuxt upgrade --dedupe`). Dependabot bypasses those commands and bumps the pieces one at a time. For Vite+, that splits the catalog, the override pins and the Docker image tag across separate PRs.

## What Changes

- Upgrade `vite-plus` 1.0.0 → 1.1.0 through `vp migrate`. This re-pins the `vite` core alias, `vitest` and `@vitest/coverage-v8` (5.0.3) in the catalog and overrides, and moves the Docker build image tag with it. The 1.1.0 packages are added to `minimumReleaseAgeExclude`, and the stale 1.0.0 entries are removed.
- Upgrade `nuxt` and `@nuxt/schema` 4.5.2 → 4.6.0 through `nuxt upgrade --dedupe`.
- Bump the remaining outdated dependencies within their current majors (eslint, eslint-plugin-oxlint, @typescript-eslint/parser, vue-tsc, @nuxt/test-utils, @types/node, @iconify-json/lucide, the Junie GitHub Action).
- Fix only what the upgrade breaks, such as h3 type resolution, tsconfig baselines and the dev CLI output. Server code keeps the auto-imported h3 helpers.
- Dependabot stops updating the Vite+-managed packages and the Vite+ Docker image, and groups the Nuxt packages into one PR.
- AGENTS.md documents the upgrade commands for future bumps.

## Non-goals

- TypeScript 7 (stays on 6) and `@adonisjs/hash` 10 (stays on 9, in step with `nuxt-auth-utils`).
- Migrating server code to `nuxt/server`, replacing `nuxt-auth-utils` with Nuxt sessions, or `NUXT_APP_SECRET`. These are a separate follow-up change.
- Opting into Nuxt 5 behavior (`future.compatibilityVersion: 5`, `routeTypedFetch`, typed pages).
- Any user-facing, API, schema or i18n change.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `platform-toolchain`: REQ-083 moves the baseline to Nuxt 4.6 and names `nuxt upgrade --dedupe` as the upgrade path. REQ-370 names `vp migrate` as the way the Vite+ catalog, pins and image tag move together.
- `platform-ci`: REQ-021 excludes the Vite+-managed packages and image from Dependabot and groups Nuxt updates. Its "Vite+ bumps are split across ecosystems" scenario is replaced.

## Impact

- `pnpm-workspace.yaml` (catalog, overrides, release-age excludes), every `package.json`, `pnpm-lock.yaml`.
- `Dockerfile` (two `vite-plus` image tags), `.github/dependabot.yml`, `.github/workflows/*` (Junie action pin).
- `apps/web/nuxt.config.ts` and possibly `apps/web/package.json`, only if 4.6 requires it (tsconfig baseline, explicit `h3` dev dependency, `--no-tui`).
- `AGENTS.md`.
- All quality gates, including the full e2e suite and a Docker build, must pass on the new tree.
