# workspace-report-presets Specification

## Purpose

Lets a user save reusable client report setups (client name, trackers, hours format, PDF language), so a monthly client PDF can be exported again without reconfiguring it.

## Requirements

### Requirement: REQ-380 Report preset fields and validation
A report preset SHALL belong to exactly one user and hold: a client name (trimmed, 1–120 characters, unique per user ignoring case), an ordered list of 1–20 distinct tracker ids, each a non-deleted tracker of that user when saved, an hours format (`hm` or `decimal`), a PDF locale (`en` or `pl`), and a last-used timestamp. Invalid input SHALL be rejected with `422` and `{ messageKey, params }`, persisting nothing.

#### Scenario: Valid preset is accepted
- **WHEN** the user submits client name `Helios Energy`, two of their active trackers, hours format `decimal`, and locale `pl`
- **THEN** the preset SHALL be stored with those values

#### Scenario: Empty or oversized client name
- **WHEN** the client name is blank after trimming or longer than 120 characters
- **THEN** the request SHALL be rejected with 422 and a translated `messageKey`

#### Scenario: No trackers or duplicate trackers
- **WHEN** the tracker list is empty, longer than 20, or repeats an id
- **THEN** the request SHALL be rejected with 422

#### Scenario: Foreign or deleted tracker
- **WHEN** a tracker id belongs to another user or to a soft-deleted tracker
- **THEN** the request SHALL be rejected with 422 and SHALL NOT reveal whether the foreign tracker exists

#### Scenario: Duplicate client name
- **WHEN** the user already has a preset named `helios energy` and submits `Helios Energy`
- **THEN** the request SHALL be rejected with 409 and a translated `messageKey`

### Requirement: REQ-381 Listing report presets
The system SHALL expose `GET /api/report-presets` for the authenticated user. It SHALL return only that user's presets, ordered by last-used timestamp descending (never-used presets last, then by creation time descending). Each preset SHALL list its trackers in stored order as `{ id, name }` for trackers that are still active, and SHALL report how many stored trackers have since been soft-deleted. Timestamps SHALL be ISO strings.

#### Scenario: Most recently used first
- **WHEN** the user exported with preset B after preset A
- **THEN** the list SHALL return B before A

#### Scenario: Soft-deleted tracker is reported, not listed
- **WHEN** one of a preset's two trackers has been soft-deleted
- **THEN** the preset SHALL list only the active tracker and SHALL report one inactive tracker

#### Scenario: Foreign presets are isolated
- **WHEN** another user has presets
- **THEN** the response SHALL NOT include them

### Requirement: REQ-382 Creating and updating report presets
`POST /api/report-presets` SHALL create a preset and `PATCH /api/report-presets/[id]` SHALL replace its client name, trackers, hours format and locale. Both SHALL validate per REQ-380, set the last-used timestamp to now, and return the saved preset in the REQ-381 shape, following `core-api-conventions` (session, CSRF). Updating a foreign or unknown preset SHALL respond 404 without revealing existence.

#### Scenario: Create marks the preset as used
- **WHEN** the user creates a preset
- **THEN** the response SHALL carry a last-used timestamp equal to the save time

#### Scenario: Update replaces the setup
- **WHEN** the user patches a preset with a different tracker list and locale `en`
- **THEN** the stored preset SHALL have exactly the new trackers in the new order and locale `en`

#### Scenario: Foreign preset
- **WHEN** the user patches a preset id owned by another user
- **THEN** the endpoint SHALL respond 404 and change nothing

#### Scenario: Missing authentication or CSRF
- **WHEN** a create or update request lacks a valid session or CSRF token
- **THEN** it SHALL be rejected per shared conventions and persist nothing

### Requirement: REQ-383 Deleting report presets
The system SHALL expose `DELETE /api/report-presets/[id]`, which permanently removes the user's preset and its tracker list. Deleting a tracker SHALL NOT delete presets that reference it. A foreign or unknown id SHALL respond 404.

#### Scenario: Delete removes the preset
- **WHEN** the user deletes their preset
- **THEN** it SHALL no longer appear in the list

#### Scenario: Foreign or unknown preset
- **WHEN** the id is unknown or owned by another user
- **THEN** the endpoint SHALL respond 404 and delete nothing
