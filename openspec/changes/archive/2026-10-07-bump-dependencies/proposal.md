# Proposal

## Why

The workspace is behind on its toolchain: Vite+ 1.1.0 (bundling Vitest 5.0.3) is out, plus a set of patch and minor updates. Vite+ pins `vite`, `vitest` and `@vitest/coverage-v8` together and publishes `vp migrate` to move them as one. Dependabot bypasses that and bumps the pieces one at a time, which splits the catalog, the override pins and the Docker image tag across separate PRs. It does the same for Nuxt, whose packages have to move together and be deduplicated.

## What Changes

- Upgrade `vite-plus` 1.0.0 → 1.1.0 through `vp migrate`. This re-pins the `vite` core alias, `vitest` and `@vitest/coverage-v8` (5.0.3) in the catalog and overrides, and moves the Docker build image tag with it. The 1.1.0 packages replace the 1.0.0 entries in `minimumReleaseAgeExclude`.
- Bump the remaining outdated dependencies within their current majors (eslint, eslint-plugin-oxlint, @typescript-eslint/parser, vue-tsc, @nuxt/test-utils, @types/node, @iconify-json/lucide, the Junie GitHub Action).
- Dependabot stops updating the Vite+-managed packages and the Vite+ Docker image, and groups the Nuxt packages into one PR.
- AGENTS.md documents the upgrade commands for Vite+, Nuxt and everything else.

## Non-goals

- **Nuxt 4.6.** It stays on 4.5.2. On Windows, 4.6.0 returns 500 for every SSR page in both dev and production builds (nuxt/nuxt#36467). The Nitro fix (nitrojs/nitro#4732) is merged but not released. A separate change takes 4.6 once a nitropack release ships it.
- TypeScript 7 (stays on 6) and `@adonisjs/hash` 10 (stays on 9, in step with `nuxt-auth-utils`).
- Migrating server code to `nuxt/server` or replacing `nuxt-auth-utils` with Nuxt sessions.
- Any user-facing, API, schema or i18n change.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `platform-toolchain`: REQ-370 names `vp migrate` as the way the Vite+ catalog, pins and image tag move together.
- `platform-ci`: REQ-021 excludes the Vite+-managed packages and image from Dependabot and groups Nuxt updates.

## Impact

- `pnpm-workspace.yaml` (catalog, overrides, release-age excludes), `package.json` files, `pnpm-lock.yaml`, `apps/migrator/vite.config.ts` (a tsdown compatibility flag written by `vp migrate`).
- `Dockerfile` (two `vite-plus` image tags), `.github/dependabot.yml`, `.github/workflows/code-review.yml` (Junie action pin).
- `AGENTS.md`.
- All quality gates and a Docker build must pass on the new tree.
