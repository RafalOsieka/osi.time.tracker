# platform-toolchain Specification

## Purpose
TBD - created by archiving change upgrade-nuxt-4-5. Update Purpose after archive.
## Requirements
### Requirement: REQ-NFR-036 Application runs on Nuxt 4.5 with all quality gates green
The application SHALL build and run on Nuxt `^4.5.0` (with `@nuxt/schema` at the matching version), using the default Vite builder on Vite 8 and unhead v3. The upgrade SHALL NOT change any user-facing behavior, API contract, database schema, or i18n catalog. All quality gates — `pnpm lint`, `pnpm format:check`, `pnpm type-check`, `pnpm test:unit`, `pnpm test:nuxt`, and `pnpm test:e2e` — SHALL pass on the upgraded dependency tree, and the dependency tree SHALL NOT contain duplicate major versions of unhead or unctx.

#### Scenario: Production build succeeds on Vite 8
- **WHEN** `pnpm build` is executed after the upgrade
- **THEN** the production build SHALL complete without errors and the e2e suite (which runs against the production build) SHALL pass

#### Scenario: Type-check passes under unhead v3
- **WHEN** `pnpm type-check` is executed after the upgrade
- **THEN** it SHALL pass, including the `useHead` call site in `app.vue` under the stricter unhead v3 types

#### Scenario: Deduped unjs dependency tree
- **WHEN** the lockfile is inspected after the upgrade
- **THEN** only a single major version of `unhead` and `unctx` SHALL be resolved, and no unrelated dependency SHALL have received an unintended major bump

#### Scenario: Incompatible Nuxt module blocks the upgrade
- **WHEN** a configured Nuxt module (`@nuxtjs/i18n`, `nuxt-security`, `nuxt-auth-utils`, `@primevue/nuxt-module`, `@nuxt/test-utils`) fails against Vite 8 or unhead v3 and no compatible module release exists
- **THEN** the upgrade SHALL be reverted (dependency bump and lockfile) rather than worked around with forced resolutions or patches

