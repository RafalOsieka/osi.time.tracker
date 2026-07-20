## ADDED Requirements

### Requirement: REQ-036 Lint-disable exceptions carry a justification
Every `// eslint-disable-next-line @typescript-eslint/no-explicit-any`
annotation SHALL be followed on the same line by a trailing comment
(` -- <reason>`) explaining why the exception is unavoidable. This complements
REQ-159, which permits explicit `any` only via such a justified disable.

#### Scenario: Justification comment is present
- **WHEN** `test/e2e/support/seed.ts` declares `sharedHasher` with an `eslint-disable-next-line @typescript-eslint/no-explicit-any` annotation
- **THEN** the annotation includes a trailing `-- <reason>` comment explaining the exception
