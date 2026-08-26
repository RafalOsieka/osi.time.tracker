## MODIFIED Requirements

### Requirement: REQ-282 Anti-slop generic rules fail `pnpm lint`
The Oxlint configuration used by `pnpm lint` SHALL load the vendored anti-slop JS plugin and SHALL set every generic anti-slop rule to `error`. Effect-specific anti-slop rules SHALL NOT be enabled. The plugin sources under `tools/oxlint/anti-slop/` SHALL NOT be edited to silence diagnostics. Remaining `vi.mock` / `jest.mock` call sites SHALL each carry a next-line `anti-slop/no-module-mocking` disable with `-- <reason>`; there SHALL NOT be a blanket `test/` allowlist for that rule.

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
