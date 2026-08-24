## MODIFIED Requirements

### Requirement: REQ-177 Extracted composables are independently unit-tested

Each capability composable extracted from the Remote Sync day page SHALL have unit/component tests at its own boundary covering its loading lifecycle (idle → loading → loaded/error), retry, and its derived selectors, independent of the page that consumes it. Those tests SHALL execute the composable under test; they MUST NOT replace that module with a mock. Collaborators (HTTP, adapters, other composables) MAY be mocked. The browser-orchestrated remote client used for current-account lookup, same-day log fetch with in-flight dedup and cache, and time-entry create SHALL be tested at this boundary as well.

#### Scenario: Composable lifecycle is covered
- **WHEN** an extracted composable is added
- **THEN** tests SHALL assert its loading, error, retry, and selector behavior without rendering the full day page

#### Scenario: Tests exercise the composable under test
- **WHEN** a capability composable is unit-tested
- **THEN** the test file SHALL import and call that composable's real implementation rather than substituting a mock of the same module

#### Scenario: Remote client cache and errors are covered
- **WHEN** the browser-orchestrated remote client is unit-tested
- **THEN** tests SHALL assert account cache reuse, in-flight request coalescing, log cache hits, cache invalidation, successful create, and mapping of adapter failures to translation keys, without rendering the Remote Sync page
