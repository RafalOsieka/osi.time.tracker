## REMOVED Requirements

### Requirement: REQ-035 Vue forms use the PrimeVue Form pattern
**Reason**: `coding-standards-compliance` was a grab-bag of three unrelated
rules. This UI rule belongs with the shared form components.
**Migration**: Rehomed verbatim (same number) to `shared-ui-components` REQ-035,
alongside the form-field wrapper (REQ-128) and the accessible-error rule
(`accessibility` REQ-002). No code or behavior changes.

### Requirement: REQ-036 Lint-disable exceptions carry a justification
**Reason**: This rule overlaps `type-safety` REQ-159 (explicit `any` permitted
only with a justified disable) and belongs with the type-safety rules.
**Migration**: Rehomed verbatim (same number) to `type-safety` REQ-036,
adjacent to REQ-159. No code or behavior changes.

### Requirement: REQ-037 Bug fixes are test-first
**Reason**: This is a testing-process rule, not a coding-style rule.
**Migration**: Rehomed verbatim (same number) to `e2e-test-harness` REQ-037.
No code or behavior changes.

Note: With all three requirements rehomed, the `coding-standards-compliance`
capability is dissolved and its spec file is deleted at archive time.
