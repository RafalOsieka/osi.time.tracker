## REMOVED Requirements

### Requirement: REQ-024 Coverage measurement from unit and nuxt tests
**Reason**: Coverage is a separable concern from the core verify/merge-gate CI
pipeline. It is split into its own single-purpose `coverage-reporting`
capability, matching the owner's preference for finer, topic-focused specs.
**Migration**: Re-added verbatim (same number) to `coverage-reporting` REQ-024.
No code or behavior changes.

### Requirement: REQ-025 Coverage reporting to GitHub via Codecov
**Reason**: Split out of `ci-pipeline` into `coverage-reporting`.
**Migration**: Re-added verbatim (same number) to `coverage-reporting` REQ-025.
No code or behavior changes.

### Requirement: REQ-026 Report-only coverage policy
**Reason**: Split out of `ci-pipeline` into `coverage-reporting`.
**Migration**: Re-added verbatim (same number) to `coverage-reporting` REQ-026.
No code or behavior changes.

Note: `ci-pipeline` retains its core verify/merge-gate requirements
(REQ-014–REQ-023); only the three coverage requirements move.
