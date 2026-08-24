## Purpose

Define the hybrid lint and format toolchain: Oxlint as the fast first pass (including vendored anti-slop), leftover ESLint for Vue-template gates, and Oxfmt as the project formatter, without changing product behavior.

## ADDED Requirements

### Requirement: REQ-280 Hybrid lint gate runs Oxlint then ESLint
`pnpm lint` SHALL run Oxlint first, then ESLint, and SHALL exit non-zero if either pass reports an error. The committed Oxlint config SHALL be produced from the project ESLint flat config via `@oxlint/migrate` (one-off `pnpx`, not a package dependency), then reviewed and extended. Oxlint SHALL lint JavaScript, TypeScript, and Vue `<script>` / `<script setup>` blocks. ESLint SHALL remain responsible for Vue `<template>` rules that require template parsing — including `eslint-plugin-vuejs-accessibility`, `@intlify/eslint-plugin-vue-i18n` (`no-raw-text`), remaining `vue/*` template rules, and leftover `nuxt/*` rules — even if migrate listed those plugins under Oxlint `jsPlugins`. Type-aware Oxlint (`--type-aware` / `oxlint-tsgolint`) SHALL NOT be enabled. Nursery rules SHALL NOT be bulk-enabled solely because migrate can emit them.

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
- **WHEN** the Oxlint configuration, `pnpm lint` script, and `package.json` are inspected
- **THEN** they SHALL NOT enable `--type-aware`, `options.typeAware`, or a `oxlint-tsgolint` or `@oxlint/migrate` dependency

#### Scenario: Template plugins stay on ESLint
- **WHEN** migrate lists `eslint-plugin-vuejs-accessibility` or `@intlify/eslint-plugin-vue-i18n` as Oxlint `jsPlugins`
- **THEN** `pnpm lint` SHALL still fail those template violations from the ESLint pass, not only from Oxlint

### Requirement: REQ-281 Overlapping ESLint rules are disabled
ESLint SHALL disable rules that Oxlint already enforces, via `eslint-plugin-oxlint` (or an equivalent generated disable set derived from the Oxlint config). `eslint-config-prettier` SHALL remain the last ESLint config entry so leftover ESLint stylistic rules do not conflict with Oxfmt.

#### Scenario: Duplicate rule is not reported twice
- **WHEN** a file violates a rule implemented by both Oxlint and ESLint
- **THEN** `pnpm lint` SHALL report it from Oxlint and SHALL NOT emit a second ESLint diagnostic for the same rule

#### Scenario: Formatter ownership preserved
- **WHEN** the ESLint config is assembled
- **THEN** `eslint-config-prettier` SHALL be the last entry

### Requirement: REQ-282 Anti-slop generic rules fail `pnpm lint`
The Oxlint configuration used by `pnpm lint` SHALL load the vendored anti-slop JS plugin and SHALL set every generic anti-slop rule to `error`. Effect-specific anti-slop rules SHALL NOT be enabled. Existing anti-slop diagnostics SHALL NOT be fixed, suppressed, or waived in this change; a follow-up change reviews them. `pnpm lint` SHALL still fail while those diagnostics remain, and this change SHALL NOT merge until `pnpm lint` is green.

#### Scenario: Generic anti-slop violation fails the required lint job
- **WHEN** a linted file violates an enabled generic anti-slop rule (for example a chained type assertion)
- **THEN** `pnpm lint` SHALL exit non-zero with an `anti-slop/` diagnostic

#### Scenario: Effect rules stay off
- **WHEN** the Oxlint configuration is inspected
- **THEN** it SHALL NOT register the anti-slop Effect plugin or enable `anti-slop-effect/*` rules

#### Scenario: Vue templates are not anti-slop-checked
- **WHEN** a Vue `<template>` contains patterns anti-slop would reject in script
- **THEN** Oxlint SHALL NOT report those template-only locations as anti-slop violations

### Requirement: REQ-283 Oxfmt is the project formatter
`pnpm format` and `pnpm format:check` SHALL use Oxfmt, not Prettier. Formatting SHALL cover JavaScript, TypeScript, Vue SFCs (including templates), JSON, CSS, YAML, Markdown, and other previously Prettier-formatted project files, using the migrated Prettier options (semicolons, single quotes, print width 100, trailing commas). Vue template formatting MAY use Oxfmt’s bundled Prettier engine.

#### Scenario: Format check fails on unformatted Vue and TypeScript
- **WHEN** a `.vue` or `.ts` file diverges from Oxfmt output
- **THEN** `pnpm format:check` SHALL exit non-zero

#### Scenario: Format check passes on Oxfmt output
- **WHEN** the tree matches Oxfmt
- **THEN** `pnpm format:check` SHALL exit zero

#### Scenario: Prettier is not the format script
- **WHEN** `package.json` scripts are inspected
- **THEN** `format` and `format:check` SHALL invoke Oxfmt and SHALL NOT invoke the `prettier` CLI
