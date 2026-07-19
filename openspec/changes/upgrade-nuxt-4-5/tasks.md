## 1. Pre-upgrade baseline

- [x] 1.1 Confirm the current suite is green pre-upgrade to establish a baseline: `pnpm lint`, `pnpm format:check`, `pnpm type-check`, `pnpm test:unit`, `pnpm test:nuxt`, `pnpm test:e2e`
- [x] 1.2 Check release notes / issue trackers of `@nuxtjs/i18n`, `nuxt-security`, `nuxt-auth-utils`, `@primevue/nuxt-module`, and `@nuxt/test-utils` for known Vite 8 / unhead v3 incompatibilities; note any required module bumps

## 2. Dependency upgrade

- [x] 2.1 Run `npx nuxt upgrade --dedupe` to bump `nuxt` to `^4.5.0` and dedupe the unjs ecosystem
- [x] 2.2 Bump `@nuxt/schema` in `package.json` to match the new `nuxt` version and run `pnpm install`
- [x] 2.3 Review the `pnpm-lock.yaml` diff: confirm a single major of `unhead` and `unctx` is resolved and no unrelated dependency received an unintended major bump

## 3. Verification (cheap checks first)

- [x] 3.1 Run `pnpm type-check`; if unhead v3 type tightening breaks the `useHead` call in `app.vue`, apply the minimal type-only fix
- [x] 3.2 Run `pnpm lint` and `pnpm format:check`
- [x] 3.3 Run `pnpm test:unit` and `pnpm test:nuxt` (confirms `useHead` mocks still align with unhead v3)
- [x] 3.4 Run `pnpm test:e2e` (production build — exercises Vite 8 end-to-end); compare any failures against the 1.1 baseline
- [x] 3.5 Smoke-check `pnpm dev`: app starts, HMR works, login page renders, no new console/server errors

## 4. Contingency (only if a check fails)

- [x] 4.1 If a Nuxt module fails on Vite 8 / unhead v3, bump it to a patched compatible release and re-run tasks 3.1–3.4 (n/a — no module failed; the only breaks were in test mocks, fixed directly)
- [x] 4.2 If no compatible module release exists, revert the dependency bump and lockfile, and record the blocker in this change's design.md Open Questions (n/a — not needed)

## 5. Finalize

- [x] 5.1 Commit the upgrade as a single logical change (dependency bump + lockfile + any strictly necessary type fixes)
