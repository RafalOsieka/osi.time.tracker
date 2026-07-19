## Why

Nuxt 4.5.0 (released 2026-07-18) upgrades the build layer to Vite 8 and moves the head/context internals to unhead v3 and unctx v3. Staying current keeps the project on the supported line (Nuxt 3 goes EOL 2026-07-31, and 4.5 is plumbing toward Nuxt 5), picks up security and dev-performance fixes, and avoids a larger, riskier jump later.

## What Changes

- Bump `nuxt` and `@nuxt/schema` from `^4.4.8` to `^4.5.0` via `npx nuxt upgrade --dedupe` (dedupes the unjs ecosystem, which matters for this release because of unhead/unctx major bumps).
- Absorb the Vite 8 build-layer upgrade. Our Vite config is minimal (`server.hmr` toggle and `optimizeDeps.include`); both options are unchanged in Vite 8, so no config edits are expected.
- Absorb unhead v3 stricter `useHead` types. The single `useHead` call in `app.vue` uses a plainly typed `Ref<string>`, so no code change is expected; verified by type-check.
- Verify third-party module compatibility with Vite 8 / unhead v3: `@nuxtjs/i18n`, `nuxt-security`, `nuxt-auth-utils`, `@primevue/nuxt-module`, `@nuxt/test-utils`. If a module breaks, prefer bumping to a patched module release over workarounds.
- No breaking changes to application behavior, APIs, or user-facing features are intended.

## Capabilities

### New Capabilities

- `platform-toolchain`: non-functional requirement that the application builds and runs on Nuxt `^4.5.0` (Vite 8, unhead v3) with all quality gates green and a deduped unjs dependency tree (REQ-NFR-036).

### Modified Capabilities

None — no spec-level requirements change; existing specs remain the behavioral source of truth and must keep passing.

## Non-goals

- Adopting new 4.5 features (experimental SSR streaming, `useLayout`, named views, `enabled` option for `useFetch`/`useAsyncData`, `experimental.watcher: 'builder'`). These may be evaluated in separate follow-up changes.
- Any refactoring, dependency bumps beyond what the Nuxt upgrade requires, or CSP/security-policy changes.
- Preparing for Nuxt 5 beyond what 4.5 itself delivers.

## Impact

- `package.json` / `pnpm-lock.yaml`: `nuxt`, `@nuxt/schema`, and transitively deduped unjs/Vite packages.
- Build pipeline: Vite 8 exercised end-to-end by `pnpm build` and the e2e suite (which runs against a production build).
- Tests: existing unit/nuxt/e2e suites act as the regression gate; test mocks of `useHead` insulate component tests from unhead v3.
- No database, API contract, or i18n catalog changes.
