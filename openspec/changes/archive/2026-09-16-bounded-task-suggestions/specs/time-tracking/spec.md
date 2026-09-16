## ADDED Requirements

### Requirement: REQ-360 Bounded and debounced title suggestion requests
The title autocompletes in the top-bar timer widget and the add-entry dialog SHALL request suggestions from `GET /api/tasks` through one shared mechanism so both behave identically. The mechanism SHALL debounce typing: while the user keeps typing, the system SHALL NOT issue a request for every keystroke, and SHALL issue one request for the latest text once typing pauses. The mechanism SHALL guard against out-of-order responses: when a response for an older search text arrives after a request for newer text has been issued, the older response SHALL be discarded and SHALL NOT replace the suggestions. A request that fails SHALL leave the previous suggestions untouched and SHALL NOT surface an error toast, so a transient failure does not interrupt typing a title. The request SHALL rely on the server-side cap and ranking of REQ-133 and SHALL NOT ask for more suggestions than the overlay presents.

#### Scenario: Rapid typing issues one request
- **WHEN** the user types several characters in quick succession
- **THEN** the system SHALL issue a single suggestion request carrying the final text once typing pauses

#### Scenario: Stale response is discarded
- **WHEN** a request for text "a" is still in flight, the user types "ab", and the response for "a" arrives after the request for "ab" was issued
- **THEN** the "a" response SHALL be ignored and the suggestions SHALL reflect the "ab" response when it arrives

#### Scenario: Failed request keeps previous suggestions
- **WHEN** a suggestion request fails
- **THEN** the currently shown suggestions SHALL remain unchanged and no error toast SHALL appear

#### Scenario: Add-entry dialog shares the mechanism
- **WHEN** the user types a title in the add-entry dialog
- **THEN** its requests SHALL be debounced and stale-guarded exactly as in the top-bar widget

#### Scenario: Overlay stays responsive with a large task history
- **WHEN** the user has tens of thousands of tasks and focuses or types in the title input
- **THEN** the overlay SHALL present at most the server cap of suggestions and the page SHALL remain interactive
