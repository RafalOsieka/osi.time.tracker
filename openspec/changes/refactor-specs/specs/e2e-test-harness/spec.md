## ADDED Requirements

### Requirement: REQ-037 Bug fixes are test-first
Every bug fix SHALL be preceded by an automated regression test that reproduces
the reported defect. The test SHALL be written and confirmed **failing** against
the unfixed code before the fix is applied, and SHALL be confirmed **passing**
after the fix. The reproduction test SHALL NOT be weakened, skipped, or deleted
to force a green run, and it SHALL remain in the suite as a permanent regression
guard. Trivial defects (e.g. typos, obvious single-line logic errors) MAY rely
on a documented manual check instead of an automated test.

#### Scenario: Failing repro precedes the fix
- **WHEN** a bug is fixed in application code
- **THEN** a regression test that fails against the pre-fix code and passes against the post-fix code SHALL be added in the same change, and it SHALL NOT be weakened or skipped
