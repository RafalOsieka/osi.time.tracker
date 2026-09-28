# Proposal

## Why

The monorepo toolchain moved to Vite+ (`vp`) in commit `6cf7bf6` (#115). That change skipped the OpenSpec flow, so the platform specs still describe the old setup: standalone `.oxlintrc.json` / `.oxfmtrc.json`, `pnpm install` with a pnpm-store cache in CI, and a root `vitest.config.ts`. The specs are the behavioral source of truth, so they need to match what the repository actually does now.

## What Changes

- **Toolchain:** add a requirement for the unified Vite+ toolchain. It covers:
  - one catalog-pinned `vite-plus` version, with `vite` / `vitest` overridden to it;
  - root scripts orchestrated through `vp run`, with cached, dependency-ordered library builds;
  - CI and the Docker build stage running on that same pinned version;
  - `vp check` not counting as a quality gate.
- **Lint:** Oxlint rules now live in the `lint` block of the root `vite.config.ts` and run through `vp lint`. The one-off `@oxlint/migrate` origin is dropped. The Vite+ Oxlint plugin and its `prefer-vite-plus-imports` rule are now part of the lint gate.
- **Format:** Oxfmt runs through `vp fmt`, configured in the `fmt` block of `vite.config.ts`. Checkouts are forced to LF line endings to match the formatter.
- **CI install:** jobs install with `vp install --frozen-lockfile` on a Vite+ setup action with dependency caching. Node and pnpm versions come from `devEngines`, not from pins in the workflow.
- **Dependabot:** now also covers the `docker` ecosystem, so the Vite+ build image is kept current.
- **Coverage:** the requirement names the web package's Vitest config as the place coverage is configured. The root `vitest.config.ts` no longer exists.
- **Purpose lines:** update the `platform-toolchain` and `platform-lint-format` Purpose sections to mention Vite+.

No product behavior, API, schema or i18n change. There are no **BREAKING** changes.

## Non-goals

- Spec drift that predates Vite+: the `package` / `extension` CI jobs missing from REQ-015 and REQ-023, and the stale `@primevue/nuxt-module` mention in REQ-083.
- Any code, workflow or configuration change beyond updating the Node version stated in the OpenSpec project context.
- Adopting `vp check` as a gate, or moving ESLint template rules to Oxlint.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `platform-toolchain`: new requirement for the unified Vite+ toolchain (version pinning, `vp run` orchestration, the same version in CI and Docker).
- `platform-lint-format`: REQ-280, REQ-282 and REQ-283 describe where the Vite+ lint and format configuration lives and how it runs; the Vite+ import rule joins the lint gate.
- `platform-ci`: REQ-016 covers the Vite+ install and cache; REQ-021 adds the Docker ecosystem to Dependabot.
- `platform-coverage`: REQ-024 names the package-level Vitest config.

## Impact

- `openspec/specs/platform-{toolchain,lint-format,ci,coverage}/spec.md`, via deltas and direct Purpose edits.
- `openspec/config.yaml` context: the Node version drops from `≥25` to 24, following `devEngines`.
- No runtime, dependency or workflow changes.
