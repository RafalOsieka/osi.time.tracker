# Design

## Context

- Vite+ owns part of the dependency tree. `pnpm-workspace.yaml` pins `vite-plus`, the `vite` → `@voidzero-dev/vite-plus-core` alias, `vitest` and `@vitest/coverage-v8` in `catalog`, and `overrides` (`vite@*`, `vitest@*`) force the whole tree onto them. The Docker build stages (`Dockerfile:10`, `Dockerfile:42`) run `ghcr.io/voidzero-dev/vite-plus:<catalog version>` (REQ-370). The catalog already pins vitest 5.0.2 while `vite-plus@1.0.0` bundles 5.0.1. That is exactly the kind of drift `vp migrate` prevents.
- `vite-plus@1.1.0` was published 2026-10-07. pnpm's minimum release age hides it from `vp outdated`, so it needs `minimumReleaseAgeExclude` entries, the same way 1.0.0 needed them.
- Nuxt 4.6 is additive for us (see the [release post](https://nuxt.com/blog/v4-6)). It needs Node `^24.15.0`, which `devEngines` (`^24.21.0`) and `node:24-alpine` already satisfy. Three changes can surface without any code migration:
  - h3/Nitro types are no longer hoisted into the app. Six files `import type … from 'h3'`, and `apps/web` has no direct `h3` dependency. They currently resolve through `paths` in `.nuxt/tsconfig*.json`.
  - `typescript.tsConfig` becomes the shared baseline for all generated tsconfigs, so our test-file `include` now reaches the server, shared and node contexts too.
  - `server/types/` is now included in the server tsconfig.
- Nuxt CLI v4 gives `nuxt dev` an interactive TUI and a lock file in `.nuxt/`. Root `pnpm dev` runs it under `vp run --parallel --log labeled`.
- `pnpm-workspace.yaml` sets `update.githubActions: true`, so `vp update` also bumps SHA-pinned actions.

## Goals / Non-Goals

**Goals:**
- Each tool upgrades through the command its maintainers recommend, so pins and transitive dependencies move together.
- Any adaptation to the upgrade is the smallest one that keeps current behavior. Server code stays on h3 auto-imports.

**Non-Goals:**
- Making server code portable (`nuxt/server`) or touching auth/sessions. Those belong to the follow-up change.

## Decisions

1. **Upgrade order: Vite+ first, then Nuxt, then the rest.** Vite+ owns the `vite`/`vitest` overrides that Nuxt and `@nuxt/test-utils` resolve against. Moving it first means `nuxt upgrade --dedupe` dedupes against the final Vite. Each step lands as its own commit and is checked before the next, so a regression can be bisected to one tool.
   *Alternative:* one `vp update -r --latest` across everything. Rejected because it bumps `vitest` past the pin without `vite-plus` (REQ-370 "Partial toolchain bump") and would pull in TypeScript 7 and `@adonisjs/hash` 10, which are both non-goals.

2. **Vite+: `vp update vite-plus`, then the local `vp migrate`.** The excludes for the ten `@1.1.0` packages (`vite-plus`, `@voidzero-dev/vite-plus-core`, the eight platform binaries) are added first. The stale `@1.0.0` entries are removed, so the list only covers what is actually bypassed. The Docker tags move in the same commit.

3. **Nuxt: `vp exec -C apps/web nuxt upgrade --dedupe`.** This uses the workspace's Nuxt CLI, not a global one. It also refreshes `@nuxt/schema` and the lockfile.

4. **Fix forward, minimally, only where a gate fails:**
   - If `h3` type imports stop resolving, add `h3` as an `apps/web` devDependency at the version Nitro resolves (`vp why h3`). This is preferred over a `paths` override in `nuxt.config.ts` because it makes the real dependency explicit, and the follow-up change removes it.
   - If the shared `tsConfig.include` adds test files to the server/node contexts and breaks them, move it to `appTsConfig`/`serverTsConfig` to match where those tests ran before.
   - If the TUI garbles the labeled parallel output, pass `--no-tui` in `apps/web`'s `dev` script.

5. **Dependabot.** For `npm`, `ignore` `vite-plus`, `vite`, `vitest`, `@vitest/*` and `@voidzero-dev/*`. For `docker`, `ignore` `ghcr.io/voidzero-dev/vite-plus`. For `npm`, a `groups` entry covers `nuxt` and `@nuxt/*`.
   *Alternative:* also ignore Nuxt so it only moves through `nuxt upgrade --dedupe`. Rejected because ignoring it removes the signal that a release exists. A grouped PR keeps the signal, and CI plus the dedupe-tree check in REQ-083 catch a bad plain bump.

6. **AGENTS.md** gets an "Upgrading dependencies" subsection under Commands that lists the three paths (Vite+, Nuxt, everything else) and the Dependabot split. It's a few lines that point to the docs, not a tutorial.

## Risks / Trade-offs

- [The `vite-plus` 1.1.0 release is less than a day old] → Run the full gate set, including a Docker build. If there's a regression, stay on 1.0.0 and remove the excludes. The Nuxt and other bumps don't depend on it.
- [The Vite+ 1.1.0 Docker image tag may not be published yet] → Check `docker pull ghcr.io/voidzero-dev/vite-plus:1.1.0` before committing. If it's missing, the Vite+ step waits (REQ-370 forbids splitting the tag from the catalog).
- [A configured module (`nuxt-auth-utils`, `nuxt-security`, `@nuxtjs/i18n`) misbehaves on 4.6] → The e2e api and ui suites cover auth, CSRF, rate limiting and i18n. REQ-083 says to revert rather than patch.
- [CLI v4's `.nuxt/` lock file lets `test:e2e:dev` take over a running `pnpm dev`] → Check by hand once. If it does, document it in `docs/e2e-guideline.md` rather than changing the harness.
- [Ignoring Vite+ in Dependabot means nobody is notified of new releases] → The AGENTS.md section names `vp outdated` as the check, and `vp upgrade` notifies about the global CLI.

## Migration Plan

This is developer-facing only. After pulling: `pnpm install`. Rollback means reverting the commits and reinstalling, with no data or runtime config change.
