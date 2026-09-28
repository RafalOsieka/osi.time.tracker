# Design

## Context

This change only touches documents: the code already landed in `6cf7bf6` (#115), and the Dockerfile's migrator stage came later in #121. Verified current state:

- The lockfile resolves `vite@*` to `@voidzero-dev/vite-plus-core@1.0.0` through `overrides`.
- The catalog pins `vite-plus` 1.0.0, and `vitest` / `@vitest/coverage-v8` at 5.0.2.
- Both Dockerfile build stages use `ghcr.io/voidzero-dev/vite-plus:1.0.0`.
- CI uses `voidzero-dev/setup-vp` with `cache: true` and `vp install --frozen-lockfile`.
- `eslint.config.mjs` builds its overlap-disable set from `viteConfig.lint`.
- The web tests still import from `vitest`, and `vite-plus/prefer-vite-plus-imports` does not report them (the rule is not "never import `vitest`").

## Goals / Non-Goals

**Goals:**
- The specs describe what the repository does today.
- The invariants that matter get written down as testable requirements: single Vite/Vitest, and the Docker tag in sync with the catalog.

**Non-Goals:**
- Automated enforcement of the Docker/catalog version sync, such as a CI check. The spec calls drift a defect; adding a guard is a separate change.

## Decisions

1. **Vite+ gets a requirement in `platform-toolchain`, not a new `platform-vite-plus` spec.** `platform-toolchain` already owns "what the repo builds and runs on" (REQ-083 Nuxt, REQ-235 zod, REQ-306 workspace workflows).
   - *Alternative:* a separate spec. Rejected: it would be one requirement long, and it would split the version-pinning concerns across two specs.
2. **REQ-306 stays as it is.** Its abstract wording ("root commands … resolve workspace dependencies in the required order") is still accurate. The `vp run` mechanism goes in the new REQ-370 instead of rewriting REQ-306.
   - *Alternative:* MODIFY REQ-306 to name `vp run`. Rejected: it would mix an implementation choice into a requirement that deliberately abstracts over it, and the two would drift the next time tooling changes.
3. **CI command wording stays on `pnpm <script>` (REQ-015/017/275/276).** `vp run <script>` runs the same `package.json` script, so the script name is what the contract depends on. Only REQ-016, whose install and cache mechanics really changed, is modified.
4. **Purpose lines are edited directly in the main specs during apply.** The instructions say a delta's `## Purpose` is ignored for an existing capability.
5. **Spec text names config locations (`vite.config.ts` `lint`/`fmt` blocks).** This goes slightly against "no library choices in specs", but platform specs already name tools as their contract (REQ-280 names Oxlint and ESLint). Contributors and ESLint both depend on the location, so it counts as observable.

## Risks / Trade-offs

- [REQ-370 pins "same version in CI and Docker", but nothing enforces it] → Dependabot's `docker` and `npm` PRs can split a bump. The REQ-021 scenario says not to merge either one alone; a CI guard stays a follow-up.
- [Naming `prefer-vite-plus-imports` ties the spec to a Vite+ rule name] → Acceptable. REQ-282 already names anti-slop rules the same way.
- [OpenSpec `config.yaml` context says Node ≥25 while `devEngines` says ^24.21] → Fixed in tasks, so agents stop reading a wrong baseline.
