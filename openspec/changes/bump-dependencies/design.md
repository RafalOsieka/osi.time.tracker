# Design

## Context

- Vite+ owns part of the dependency tree. `pnpm-workspace.yaml` pins `vite-plus`, the `vite` → `@voidzero-dev/vite-plus-core` alias, `vitest` and `@vitest/coverage-v8` in `catalog`, and `overrides` (`vite@*`, `vitest@*`) force the whole tree onto them. The Docker build stages (`Dockerfile:10`, `Dockerfile:42`) run `ghcr.io/voidzero-dev/vite-plus:<catalog version>` (REQ-370). Before this change the catalog pinned vitest 5.0.2 while `vite-plus@1.0.0` bundled 5.0.1. That is exactly the kind of drift `vp migrate` prevents.
- `vite-plus@1.1.0` was published 2026-10-07. pnpm's minimum release age hides it from `vp outdated`, so it needs `minimumReleaseAgeExclude` entries, the same way 1.0.0 needed them.
- `pnpm-workspace.yaml` sets `update.githubActions: true`, so `vp update` also bumps SHA-pinned actions.
- Nuxt 4.6.0 was tried and set aside. On Windows it returns 500 for every SSR page, in `nuxt dev` and in production builds alike (nuxt/nuxt#36467). With Nuxt 4.5.2 on the same Vite+ 1.1 tree, `/login` returns 200. The Nitro fix (nitrojs/nitro#4732) is merged to `v2`, but no nitropack release ships it yet.

## Goals / Non-Goals

**Goals:**
- Each tool upgrades through the path its maintainers intend, so pins and transitive dependencies move together.
- What we learned about Nuxt upgrades is recorded, so the follow-up 4.6 change can start from a working command.

**Non-Goals:**
- Nuxt 4.6, `nuxt/server` or auth/session changes. Those are follow-up changes.

## Decisions

1. **Vite+: `vp migrate`, not `vp update`.** The catalog pins exact versions, so `vp update vite-plus` stays on 1.0.0 and only re-sorts lockfile peer suffixes. When the global `vp` is newer than the project, `vp migrate --no-interactive --no-agent --no-editor --no-hooks` upgrades the project to it. It re-pins the catalog and overrides and leaves the rest of the setup alone. It also wrote `deps.resolveDepSubpath: true` into `apps/migrator/vite.config.ts`, which keeps tsdown's previous subpath resolution, so the bundled migrator is unchanged. That stays. The ten `@1.1.0` packages (`vite-plus`, `@voidzero-dev/vite-plus-core`, the eight platform binaries) replace the stale `@1.0.0` entries in `minimumReleaseAgeExclude`. The Docker tags move in the same commit.
   *Alternative:* one `vp update -r --latest` across everything. Rejected because it bumps `vitest` past the pin without `vite-plus` (REQ-370 "Partial toolchain bump") and would pull in TypeScript 7 and `@adonisjs/hash` 10.

2. **Nuxt upgrade path (documented, not run here):** `vp -C apps/web add nuxt@<version>`, `vp -C apps/web add -D @nuxt/schema@<version>`, then `vp dedupe`. Nuxt's recommended `nuxt upgrade --dedupe` does exactly these two steps through nypm. In this workspace it runs `corepack pnpm`, which is not the pnpm that `vp` manages, and fails with `ERR_PNPM_VIRTUAL_STORE_DIR_MAX_LENGTH_DIFF`. `-C` is a global `vp` flag and must come before the subcommand.

3. **Everything else: `vp update -r <names>`** within current majors, leaving out `typescript`, `@adonisjs/hash` and the Nuxt packages.

4. **Dependabot.** For `npm`, `ignore` `vite-plus`, `vite`, `vitest`, `@vitest/*` and `@voidzero-dev/*`. For `docker`, `ignore` `ghcr.io/voidzero-dev/vite-plus`. For `npm`, a `groups` entry covers `nuxt` and `@nuxt/*`.
   *Alternative:* also ignore Nuxt so it only moves through the documented path. Rejected because ignoring it removes the signal that a release exists. A grouped PR keeps the signal, and CI catches a bad plain bump. This time, though, a Linux-only CI would have missed the Windows-only 4.6 failure, so the AGENTS.md section says to run `pnpm dev` locally before merging a Nuxt bump.

5. **AGENTS.md** gets an "Upgrading dependencies" subsection under Commands that lists the three paths and the Dependabot split. It's a few lines, not a tutorial.

## Risks / Trade-offs

- [The `vite-plus` 1.1.0 release is less than a day old] → The full gate set and both Docker targets passed on it. If there's a regression, return to 1.0.0 (`vp migrate` is not needed for a downgrade: restore the catalog, excludes and tags from git).
- [Ignoring Vite+ in Dependabot means nobody is notified of new releases] → The AGENTS.md section names `vp outdated -r` as the check, and `vp upgrade` notifies about the global CLI.
- [The lockfile already resolves `unctx` 2.x and 3.x (`nitropack@2`, `@nuxt/kit@3` via `@nuxt/test-utils`), contradicting REQ-083's "single major" scenario] → This predates the change, which doesn't make it worse. It's left for the Nuxt 4.6 follow-up to reconcile.

## Migration Plan

This is developer-facing only. After pulling: `pnpm install`. Rollback means reverting the commits and reinstalling, with no data or runtime config change.
