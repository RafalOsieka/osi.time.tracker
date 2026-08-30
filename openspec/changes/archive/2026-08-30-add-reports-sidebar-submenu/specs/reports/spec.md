## ADDED Requirements

### Requirement: REQ-300 No reports hub at `/reports`

The application SHALL NOT expose a reports hub page at `/reports`. There SHALL be no redirect from `/reports` to `/reports/monthly`. An authenticated request for `/reports` SHALL be a not-found response (HTTP 404), not a hub, placeholder, or monthly timesheet. Unauthenticated requests remain subject to the private-by-default guard.

#### Scenario: Authenticated `/reports` is not found
- **WHEN** an authenticated user requests `/reports`
- **THEN** the application SHALL respond with 404 and SHALL NOT render a reports hub or the monthly timesheet

#### Scenario: Unauthenticated `/reports` is still gated
- **WHEN** an unauthenticated visitor requests `/reports`
- **THEN** the global guard SHALL redirect to `/login` with that path as the redirect target before any protected markup is sent

## MODIFIED Requirements

### Requirement: REQ-295 Reports i18n and page chrome

All user-visible reports copy SHALL come from the `en` and `pl` catalogs in parity. The monthly page SHALL use the shared authenticated page header pattern (title plus month controls). Attention icons and month controls SHALL be keyboard operable with visible focus and accessible names.

#### Scenario: Polish catalog covers new strings
- **WHEN** the UI locale is `pl`
- **THEN** month picker, table headers, empty state, errors, and attention tooltips SHALL render Polish strings with no raw English keys

#### Scenario: Month controls are keyboard operable
- **WHEN** a keyboard user tabs to previous/next month
- **THEN** both controls SHALL be reachable, show visible focus, and change the month on activation

## REMOVED Requirements

### Requirement: REQ-288 Reports hub at `/reports`

**Reason**: The hub was a one-card landing in front of the only report. Monthly timesheet is reached from the sidebar Reports group (frontend-shell REQ-065).

**Migration**: Open `/reports/monthly`. There is no `/reports` redirect; authenticated `/reports` is 404 (REQ-300). Drop hub-only i18n and the hub page tests.
