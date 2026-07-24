# sync-day-composables Specification

## Purpose

Extract stateful logic from the Remote Sync day page into named, single-concept capability composables to improve testability, maintainability, and reuse while preserving existing behavior.

## Requirements

### Requirement: REQ-176 Remote Sync day page delegates to capability composables

The Remote Sync day page (`sync/[date].vue`) SHALL delegate its stateful subsystems to named, single-concept capability composables rather than holding them inline. At minimum the following concerns SHALL each live in their own composable: remote-activities loading, remote-logs loading, rounded-duration overrides, and export orchestration. Each composable SHALL own its cache, in-flight tracking, `ensureLoaded`/`retry` entry points, and derived selectors, and SHALL expose a typed reactive surface consumed by the page. The extraction SHALL be behavior-preserving: all `remote-sync-review` requirements (REQ-111…REQ-121) SHALL continue to hold unchanged. The page SHALL retain only aggregate fetching, composable wiring, and template rendering.

#### Scenario: Page composes named capability composables
- **WHEN** the Remote Sync day page is implemented
- **THEN** remote-activities loading, remote-logs loading, rounded-duration overrides, and export orchestration SHALL each be provided by a distinct capability composable named after its domain concept, and the page SHALL contain no equivalent inline state machine

#### Scenario: Behavior is preserved after extraction
- **WHEN** the day page runs with the extracted composables
- **THEN** the observable behavior defined by `remote-sync-review` (per-row state, rounded-duration commit/revert, activity/log loading and error announcements, export outcomes) SHALL be identical to before the refactor, as verified by the existing tests staying green unchanged

#### Scenario: No per-page dumping composable
- **WHEN** composables are introduced for the day page
- **THEN** they SHALL be named after a reusable capability/domain concept and SHALL NOT be a single `useXxxPage`-style composable that merely relocates the whole page's state without a cohesive concern

### Requirement: REQ-177 Extracted composables are independently unit-tested

Each capability composable extracted from the Remote Sync day page SHALL have unit/component tests at its own boundary covering its loading lifecycle (idle → loading → loaded/error), retry, and its derived selectors, independent of the page that consumes it.

#### Scenario: Composable lifecycle is covered
- **WHEN** an extracted composable is added
- **THEN** tests SHALL assert its loading, error, retry, and selector behavior without rendering the full day page
