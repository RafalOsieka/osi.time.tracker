## Context

The project runs Nuxt `^4.4.8` (pinned alongside `@nuxt/schema ^4.4.8`). Nuxt 4.5.0 (2026-07-18) upgrades the build layer to Vite 8, moves head management to unhead v3 (stricter `useHead` types, promise input removed), and adopts unctx v3. Nuxt 3 reaches EOL on 2026-07-31, and 4.5 is the plumbing release toward Nuxt 5, so staying current now avoids a bigger jump later.

Project exposure is small and already assessed:

- `nuxt.config.ts` Vite config is minimal: `server.hmr` toggle and `optimizeDeps.include` — both unchanged in Vite 8.
- A single `useHead({ htmlAttrs: { lang } })` call in `app.vue` with a plain `Ref<string>`; two test files mock `useHead`.
- The Rspack/Rsbuild pipeline changes are irrelevant (default Vite builder is used).
- The main unknown is third-party module compatibility with Vite 8 / unhead v3: `@nuxtjs/i18n` (v10), `nuxt-security`, `nuxt-auth-utils`, `@primevue/nuxt-module`, `@nuxt/test-utils` (v4).

## Goals / Non-Goals

**Goals:**

- Upgrade `nuxt` and `@nuxt/schema` to `^4.5.0` with a deduped unjs dependency tree.
- Keep every quality gate green: `pnpm lint`, `pnpm format:check`, `pnpm type-check`, `pnpm test:unit`, `pnpm test:nuxt`, `pnpm test:e2e`.
- Verify the production build (Vite 8) works end-to-end via the e2e suite, which runs against a production build.

**Non-Goals:**

- Adopting new 4.5 features (SSR streaming, `useLayout`, named views, `enabled` for `useFetch`/`useAsyncData`, `experimental.watcher: 'builder'`).
- Bumping unrelated dependencies or refactoring application code.
- Nuxt 5 preparation beyond what 4.5 itself delivers.

## Decisions

### D1: Upgrade via `npx nuxt upgrade --dedupe`

Use the official upgrade command with `--dedupe` rather than manually editing `package.json`.

- **Why**: This release majors several deep unjs dependencies (unhead v3, unctx v3); duplicate old/new copies in the lockfile are a known source of subtle runtime breakage. `--dedupe` is the officially recommended path for 4.5.
- **Alternative considered**: manual version bump + `pnpm install`. Rejected because it does not dedupe transitive unjs packages and risks mixed unhead v2/v3 trees.
- `@nuxt/schema` is bumped to match `nuxt` in the same commit.

### D2: No code or config changes unless verification fails

Treat this as a pure dependency bump; only touch code if type-check, build, or tests surface a concrete break.

- **Why**: Exposure analysis shows both custom Vite options survive Vite 8 unchanged and the single `useHead` usage is trivially typed. Preemptive edits would add noise with no evidence of need.
- **Alternative considered**: proactively migrating `useHead` usage and Vite config to new idioms. Rejected — nothing to migrate.

### D3: Module breakage is resolved by patched module releases, not workarounds

If a module fails on Vite 8 / unhead v3, bump that module to a compatible release. If no compatible release exists, pause the upgrade rather than patching around the module.

- **Why**: Workarounds (aliases, resolutions, monkey-patching) create hidden maintenance debt and can mask real incompatibilities.
- **Alternative considered**: pnpm `overrides`/patches to force compatibility. Rejected as a first resort; acceptable only as a documented, temporary measure with a follow-up issue.

### D4: Verification order — cheap checks first

`pnpm type-check` → `pnpm lint` + `pnpm format:check` → `pnpm test:unit` + `pnpm test:nuxt` → `pnpm test:e2e` (production build, exercises Vite 8 end-to-end) → manual `pnpm dev` smoke check.

- **Why**: Type-check catches unhead v3 type tightening in seconds; e2e is the most expensive and most conclusive gate, so it runs last.

## Risks / Trade-offs

- [A Nuxt module is incompatible with Vite 8 or unhead v3] → Check the module's release notes/issues; bump to a patched release (D3). If none exists, stop and defer the upgrade — rollback is trivial (revert `package.json` + `pnpm-lock.yaml`).
- [unhead v3 type tightening breaks `pnpm type-check`] → The single `useHead` call is plainly typed; if it still breaks, adjust the call site to the stricter types (a type-only change).
- [Vite 8 changes dev-server behavior (HMR, optimizeDeps) causing e2e flakiness] → e2e already disables HMR under `IS_E2E`; rerun the suite and compare failures against a pre-upgrade baseline before blaming the upgrade.
- [Lockfile churn hides an unintended major bump of another dependency] → Review the `pnpm-lock.yaml` diff for unexpected majors before committing.

## Migration Plan

1. Single commit: dependency bump + lockfile (+ any strictly necessary type fixes).
2. Rollback: revert the commit; no data, schema, or config migrations are involved.

## Open Questions

- None blocking. Follow-up candidates (separate changes): evaluate `experimental.watcher: 'builder'` for dev memory usage and the `enabled` option for `useFetch`/`useAsyncData`.
