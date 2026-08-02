## MODIFIED Requirements

### Requirement: REQ-172 Strict per-user isolation
Every read and write SHALL be scoped to the authenticated user's id. A **well-formed**
resource id belonging to another user, or a well-formed id that is unknown, SHALL resolve to
HTTP 404 without confirming the resource's existence. A **malformed** identifier supplied in a
request body — one that fails the route's `z.uuid()` boundary validation — SHALL be rejected
with HTTP 422 and the `{ messageKey, params }` contract before any data access occurs.

#### Scenario: Foreign or unknown id
- **WHEN** an authenticated user references a well-formed resource id owned by another user or one that does not exist
- **THEN** the system SHALL respond with HTTP 404 and SHALL NOT reveal whether the resource exists

#### Scenario: Malformed id in a request body
- **WHEN** an authenticated user submits a body whose identifier field is not a valid RFC UUID (e.g. an invalid version/variant nibble such as `00000000-0000-0000-0000-000000000001`, or arbitrary text)
- **THEN** the system SHALL respond with HTTP 422 with a `{ messageKey, params }` body and SHALL perform no data access
