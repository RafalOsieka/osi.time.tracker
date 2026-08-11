## ADDED Requirements

### Requirement: REQ-259 Trackers page list available on initial SSR render
The Trackers management page (`/trackers`) SHALL resolve the authenticated user's tracker list during server-side rendering of a full document load so the initial HTML/payload already contains the list data (or an empty list for the empty state). The SSR list fetch SHALL authenticate using the incoming session cookie. After mutations (create/update/delete), the page MAY refresh the list client-side; client navigations to `/trackers` within a hydrated session MAY reuse Nuxt async-data caching for the list key.

#### Scenario: Hard reload shows tracker rows without client-only bootstrap
- **WHEN** an authenticated user with at least one tracker performs a full document load of `/trackers`
- **THEN** the initial render payload SHALL already include those trackers so the table can render rows without depending solely on an `onMounted` client fetch

#### Scenario: Hard reload empty state
- **WHEN** an authenticated user with no trackers performs a full document load of `/trackers`
- **THEN** the page SHALL be able to render the empty state from the SSR-resolved empty list without a mandatory post-mount list fetch to discover emptiness

#### Scenario: SSR list uses the session cookie
- **WHEN** the Trackers page resolves the list during SSR
- **THEN** the request SHALL carry the browser session cookie material available on the incoming HTTP request
