## ADDED Requirements

### Requirement: REQ-353 Free-text fields accept any characters
Free-text request fields (time-entry and task titles, remote-log comments, remote issue and project titles, project and tracker names) SHALL accept any Unicode text, including the characters `<`, `>`, `&`, quotes, and HTML-like sequences, and SHALL store and return that text verbatim. No request-level content filter SHALL reject or rewrite a JSON body or query string based on its characters; XSS protection is provided by output escaping in templates and the Content-Security-Policy (authentication REQ-011), not by input rejection. Length bounds and zod validation of individual fields (REQ-173) are unaffected.

#### Scenario: Angle brackets in a title round-trip
- **WHEN** a user starts a timer with the title `Fix List<string> serialization > 0`
- **THEN** the system SHALL respond with HTTP 201 and the returned `TimeEntryDto` and subsequent reads SHALL carry that exact title

#### Scenario: Imported remote comment with markup-like text is accepted
- **WHEN** an import batch contains a log whose `comment` is `<review> a > b`
- **THEN** the import SHALL be accepted and the created task name SHALL be derived from that comment unchanged

#### Scenario: Script-like text is stored and rendered inert
- **WHEN** a user saves a project name containing `<script>alert(1)</script>`
- **THEN** the name SHALL be stored verbatim and every page rendering it SHALL show it as literal text without executing it
