## Context

See `proposal.md` for motivation. Six manifests declare Vitest 4; `apps/web/package.json` pins `@vitest/coverage-v8` 4, while the root declares Oxfmt and concurrently. Root `dev` uses concurrently CLI names, colors, and `-k`; the web config has inline Vitest projects plus `defineVitestProject` for Nuxt. Two UI cases use the removed `it.sequential` API. The manifests target Node 24, although `openspec/config.yaml` still describes Node ≥25; use the declared project runtime for verification.

## Goals / Non-Goals

**Goals:** Keep workspace test tooling version-aligned, preserve existing test isolation and coverage scope, and make formatter/dev runner upgrades observable through their current scripts.

**Non-Goals:** Rewrite project configs preemptively, change test assertions to conceal regressions, change the supported runtime or app behavior, or reformat unrelated files.

## Decisions

1. Upgrade the three requested packages to the latest stable versions available at implementation time, pinning `@vitest/coverage-v8` to the exact chosen Vitest release and updating every Vitest declaration and `pnpm-lock.yaml` together. The versions found during exploration were Oxfmt 0.70.0, concurrently 10.0.5, and Vitest 5.0.1; recheck before implementation. Alternative: update only root dependencies; rejected because workspace tests would then run different Vitest majors and coverage could mismatch.
2. Replace the two `it.sequential` invocations with ordinary `it` because tests in that file are not concurrent by default. If the file later becomes concurrent, use `{ concurrent: false }`. Alternative: immediately configure explicit non-concurrency on both cases; unnecessary for current configuration.
3. Retain the current Vitest project configuration initially; adapt only on observed failures. Vitest 5 enables `clearMocks` by default, inline-project inheritance and shared Vite server change, parent config lookup stops, and coverage include/exclude semantics tighten. Check test setup and coverage inclusion against pre-upgrade output; fix genuinely shared-mock assumptions or explicitly opt out of sharing only if demonstrated necessary. Alternative: blanket-disable new defaults and server sharing; rejected because it hides incompatible test assumptions and increases configuration complexity.
4. Keep root Oxfmt config and concurrently CLI arguments unless checks demonstrate changes are needed. Their reported breaking surfaces (nested-config discovery in Vite+ mode; concurrently ESM/API and removed flags) do not match observed usage. Alternative: preemptively change scripts/config; rejected as unsupported churn.

## Risks / Trade-offs

- [Vitest 5 / Nuxt integration or other test runner incompatibility] → Run each existing project; if incompatibility cannot be resolved without invasive workarounds, retain matching Vitest 4 + coverage versions and report the blocker.
- [Mock call history or test isolation changes] → Compare tests under the new defaults; repair setup/expectations rather than disabling tests.
- [Coverage globs include/exclude the wrong files] → Compare `unit` + `nuxt` included-file set and report contents against baseline; preserve configured exclusions and CI flags.
- [Formatting changes beyond the requested tool upgrade] → Inspect differences, avoid bulk formatting, and restrict any edits to necessary migration fixes.
- [Node 25 locally outside Vitest 5's published engine range] → Run verification on Node 24, not the unsupported local runtime; report unavailable prerequisites rather than claiming a pass.

## Migration Plan

Capture pre-upgrade coverage file set if available, upgrade manifests and lockfile as one change, replace removed test API, then run format/lint/type checks, workspace unit/Nuxt/coverage tests, DB/API/UI E2E where Docker and Chromium are available, and check development startup/shutdown. If a dependency cannot be integrated cleanly, revert only the affected upgrade consistently across manifests and lockfile and report what blocked it. No database or production deployment migration is involved.