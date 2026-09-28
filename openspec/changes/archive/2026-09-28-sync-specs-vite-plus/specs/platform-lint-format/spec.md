# Spec Delta

## MODIFIED Requirements

### Requirement: REQ-280 Hybrid lint gate runs Oxlint then ESLint
`pnpm lint` SHALL run Oxlint first through `vp lint`, then ESLint, and SHALL exit non-zero if either pass reports an error. The Oxlint configuration SHALL live in the `lint` block of the root `vite.config.ts`; a separate `.oxlintrc.json` SHALL NOT exist. Oxlint SHALL lint JavaScript, TypeScript, and Vue `<script>` / `<script setup>` blocks. ESLint SHALL remain responsible for Vue `<template>` rules that require template parsing — including `eslint-plugin-vuejs-accessibility`, `@intlify/eslint-plugin-vue-i18n` (`no-raw-text`), remaining `vue/*` template rules, and leftover `nuxt/*` rules. Type-aware Oxlint (`--type-aware` / `oxlint-tsgolint`) SHALL NOT be enabled. Nursery rules SHALL NOT be bulk-enabled.

#### Scenario: Native Oxlint error fails the gate
- **WHEN** a TypeScript file violates an enabled native Oxlint rule
- **THEN** `pnpm lint` SHALL exit non-zero and report the Oxlint diagnostic

#### Scenario: Vue template a11y or i18n error still fails the gate
- **WHEN** a Vue template violates an enabled accessibility or `no-raw-text` rule
- **THEN** `pnpm lint` SHALL exit non-zero from the ESLint pass even if Oxlint reported no script issues

#### Scenario: Clean sources pass both passes
- **WHEN** sources satisfy enabled Oxlint and ESLint rules
- **THEN** `pnpm lint` SHALL exit zero

#### Scenario: Type-aware Oxlint stays off
- **WHEN** the `lint` block of `vite.config.ts`, the `pnpm lint` script, and `package.json` are inspected
- **THEN** they SHALL NOT enable `--type-aware`, `options.typeAware`, or a `oxlint-tsgolint` or `@oxlint/migrate` dependency

#### Scenario: Template plugins stay on ESLint
- **WHEN** the Oxlint `jsPlugins` in `vite.config.ts` are inspected
- **THEN** they SHALL NOT list `eslint-plugin-vuejs-accessibility` or `@intlify/eslint-plugin-vue-i18n`, and `pnpm lint` SHALL fail those template violations from the ESLint pass

#### Scenario: Stale standalone config is rejected
- **WHEN** a `.oxlintrc.json` is added at the repository root
- **THEN** it SHALL be treated as a defect, because rules belong in the `lint` block of `vite.config.ts`, which both `vp lint` and the ESLint overlap-disable set read

### Requirement: REQ-282 Anti-slop generic rules fail `pnpm lint`
The Oxlint configuration used by `pnpm lint` (the `lint` block of `vite.config.ts`) SHALL load the vendored anti-slop JS plugin and SHALL set every generic anti-slop rule to `error`. Effect-specific anti-slop rules SHALL NOT be enabled. The plugin sources under `tools/oxlint/anti-slop/` SHALL NOT be edited to silence diagnostics. Remaining `vi.mock` / `jest.mock` call sites SHALL each carry a next-line `anti-slop/no-module-mocking` disable with `-- <reason>`; there SHALL NOT be a blanket `test/` allowlist for that rule. The same configuration SHALL load the Vite+ Oxlint plugin with `vite-plus/prefer-vite-plus-imports` set to `error`, so code that can import Vite or Vitest APIs from `vite-plus` entry points (for example `vite-plus/test`) does so.

#### Scenario: Generic anti-slop violation fails the required lint job
- **WHEN** a linted file violates an enabled generic anti-slop rule (for example a chained type assertion)
- **THEN** `pnpm lint` SHALL exit non-zero with an `anti-slop/` diagnostic

#### Scenario: Effect rules stay off
- **WHEN** the Oxlint configuration is inspected
- **THEN** it SHALL NOT register the anti-slop Effect plugin or enable `anti-slop-effect/*` rules

#### Scenario: Vue templates are not anti-slop-checked
- **WHEN** a Vue `<template>` contains patterns anti-slop would reject in script
- **THEN** Oxlint SHALL NOT report those template-only locations as anti-slop violations

#### Scenario: Unjustified module mock fails lint
- **WHEN** a test file calls `vi.mock` without a next-line disable and reason
- **THEN** `pnpm lint` SHALL fail with `anti-slop/no-module-mocking`

#### Scenario: Plugin tree is not a dump for fixes
- **WHEN** an anti-slop diagnostic is addressed
- **THEN** the change SHALL edit application, server, shared, or test code (or a documented disable), not `tools/oxlint/anti-slop/`

#### Scenario: Import that Vite+ re-exports fails lint
- **WHEN** a linted file imports an API from `vite` or `vitest` that the `prefer-vite-plus-imports` rule reports as available from a `vite-plus` entry point
- **THEN** `pnpm lint` SHALL exit non-zero with a `vite-plus/prefer-vite-plus-imports` diagnostic

### Requirement: REQ-283 Oxfmt is the project formatter
`pnpm format` and `pnpm format:check` SHALL format with Oxfmt through `vp fmt` / `vp fmt --check`, not Prettier. The formatter options SHALL live in the `fmt` block of the root `vite.config.ts`; a separate `.oxfmtrc.json` SHALL NOT exist. Formatting SHALL cover JavaScript, TypeScript, Vue SFCs (including templates), JSON, CSS, YAML, Markdown, and other previously Prettier-formatted project files, using the migrated Prettier options (semicolons, single quotes, print width 100, trailing commas) and LF line endings. Vue template formatting MAY use Oxfmt's bundled Prettier engine. The repository SHALL force LF line endings for text files at checkout (`.gitattributes`), so the format check does not depend on a contributor's `core.autocrlf` setting.

#### Scenario: Format check fails on unformatted Vue and TypeScript
- **WHEN** a `.vue` or `.ts` file diverges from Oxfmt output
- **THEN** `pnpm format:check` SHALL exit non-zero

#### Scenario: Format check passes on Oxfmt output
- **WHEN** the tree matches Oxfmt
- **THEN** `pnpm format:check` SHALL exit zero

#### Scenario: Prettier is not the format script
- **WHEN** `package.json` scripts are inspected
- **THEN** `format` and `format:check` SHALL invoke `vp fmt` and SHALL NOT invoke the `prettier` CLI

#### Scenario: Windows checkout with autocrlf stays format-clean
- **WHEN** the repository is cloned on Windows with `core.autocrlf=true` and `pnpm format:check` runs without edits
- **THEN** text files SHALL have LF endings in the working tree, and the check SHALL exit zero
