## ADDED Requirements

### Requirement: REQ-258 Running entry resolved during authenticated shell SSR
The authenticated `default` layout SHALL resolve the current user's running time entry (`GET /api/time-entries/running`) during server-side rendering of any authenticated route and SHALL seed the shared running-timer state used by the live timer widget before first paint. The SSR fetch SHALL authenticate using the incoming session cookie (cookie-forwarding request fetch), matching other authenticated SSR data loads. When no running entry exists, the shell SHALL seed idle state (`null`) rather than leaving the widget in an unknown pre-fetch idle that could accept start actions incorrectly after hydrate without a resolved server result.

Client-side navigations within an already-hydrated session MAY reuse the shared running-timer state and SHALL NOT require a full page reload to keep the widget correct after start/stop mutations already reflected in that state. After a full document load, the running entry SHALL be present in the initial render payload when the SSR request succeeded.

#### Scenario: Hard reload shows running title without waiting for client mount
- **WHEN** an authenticated user with a running entry performs a full document load of any private route that uses the `default` layout
- **THEN** the initial HTML/payload for that response SHALL already include the running entry so the timer widget can render the running title (or blank untitled title) without depending solely on a post-mount client fetch

#### Scenario: Hard reload with no running entry shows idle controls
- **WHEN** an authenticated user with no running entry performs a full document load of a private route on the `default` layout
- **THEN** the shell SHALL seed idle timer state for first paint and SHALL NOT leave the widget permanently disabled waiting for a client-only fetch that never started

#### Scenario: SSR uses the session cookie
- **WHEN** the shell resolves the running entry during SSR
- **THEN** the request SHALL carry the browser session cookie material available on the incoming HTTP request so the endpoint authorizes the same user as a browser navigation
