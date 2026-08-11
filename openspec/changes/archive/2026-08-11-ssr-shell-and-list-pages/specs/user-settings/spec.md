## MODIFIED Requirements

### Requirement: REQ-165 Account-persisted timezone and week-start settings
The system SHALL persist two account-level settings on the user record: `timezone` (an IANA timezone identifier, nullable — `NULL` meaning "not yet chosen") and `weekStart` (`monday` or `sunday`, defaulting to `monday`). Settings SHALL be scoped strictly to the authenticated user and SHALL survive across devices and sessions. The effective timezone SHALL be the stored value when present, otherwise the browser-detected timezone (`Intl.DateTimeFormat().resolvedOptions().timeZone`); the system SHALL NOT silently persist the detected timezone — persistence happens only when the user saves it on the settings page. The settings SHALL be included in the session payload (`AuthUser` boundary type) so they are available on first render without an extra request.

For SSR and the first client hydration paint, when no timezone is saved, the effective display timezone SHALL resolve to a stable server-safe fallback (`UTC`) so server-rendered and first-client-render timezone-formatted strings match. After the client has mounted, when no timezone is saved, the effective timezone SHALL upgrade to the browser-detected timezone and timezone-formatted displays SHALL recompute from that value. When a timezone is saved, both SSR and client SHALL use the saved value with no post-mount upgrade. Week-start resolution is unchanged (`monday` default when unset).

#### Scenario: Defaults before any save
- **WHEN** a user who has never saved settings uses the app after client mount
- **THEN** times SHALL be displayed in the browser-detected timezone and weeks SHALL start on Monday, and no settings write SHALL occur

#### Scenario: Stored settings win over detection
- **WHEN** a user with a saved timezone opens the app in a browser whose local timezone differs
- **THEN** all times SHALL be displayed in the saved timezone, not the browser's

#### Scenario: Settings available at first render
- **WHEN** an authenticated page is server-rendered
- **THEN** the session payload SHALL already carry the user's settings so no flash of browser-local rendering occurs for a user with saved settings

#### Scenario: Unsaved timezone is hydration-safe then upgrades
- **WHEN** an authenticated page is server-rendered for a user with no saved timezone and the client hydrates
- **THEN** the first paint on server and client SHALL use the same fallback timezone (`UTC`) for formatted displays, and after mount the effective timezone SHALL become the browser-detected timezone without a hydration mismatch on the initial paint
