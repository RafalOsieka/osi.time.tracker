## MODIFIED Requirements

### Requirement: REQ-159 Explicit any is a lint error
The lint configuration SHALL treat explicit `any` as an error, enforced by the existing `pnpm lint` gate (Oxlint `typescript/no-explicit-any` when that rule is enabled there, otherwise `@typescript-eslint/no-explicit-any` on ESLint). Use of `any` SHALL be permitted only via an explicit next-line disable annotation for the engine that reports the rule, carrying a justification. The `no-unsafe-*` rule family is out of scope for this change.

#### Scenario: Explicit any fails lint
- **WHEN** code declares a value typed `any` without a disable annotation
- **THEN** `pnpm lint` reports an error and fails

#### Scenario: Justified exception passes lint
- **WHEN** `any` is unavoidable and annotated with a next-line disable comment and reason for the reporting engine
- **THEN** `pnpm lint` passes for that line

### Requirement: REQ-036 Lint-disable exceptions carry a justification
Every next-line disable annotation for the `no-explicit-any` rule (ESLint `@typescript-eslint/no-explicit-any` or Oxlint `typescript/no-explicit-any`) SHALL be followed on the same line by a trailing comment (` -- <reason>`) explaining why the exception is unavoidable.

#### Scenario: Justification comment is present
- **WHEN** a justified `any` uses a next-line disable for `no-explicit-any`
- **THEN** the annotation includes a trailing `-- <reason>` comment explaining the exception
