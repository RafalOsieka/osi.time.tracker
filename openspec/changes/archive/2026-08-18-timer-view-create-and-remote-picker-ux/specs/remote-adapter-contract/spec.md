## ADDED Requirements

### Requirement: REQ-266 Search and lookup results include optional remote project title
Issue title search and exact issue-ID lookup SHALL return the same adapter-neutral result shape: remote issue ID, issue title, and an optional remote project title. The remote project title SHALL be the tracker's project display name when the provider payload supplies a usable string, and SHALL be omitted when it does not. The result SHALL NOT include a remote project id, href, or any other remote-project identifier. Provider adapters SHALL map only the provider's project display name into that field and SHALL NOT leak provider-specific project objects across the contract boundary.

#### Scenario: Result includes a remote project title
- **WHEN** title search or exact-ID lookup receives a provider payload that includes a usable project display name
- **THEN** the adapter-neutral result SHALL include that name as the remote project title and SHALL NOT include a remote project id

#### Scenario: Result omits a missing project title
- **WHEN** title search or exact-ID lookup receives an otherwise valid issue payload with no usable project display name
- **THEN** the adapter-neutral result SHALL still include remote issue ID and title and SHALL omit the remote project title

#### Scenario: Callers do not branch on provider project fields
- **WHEN** a caller renders or persists a search result
- **THEN** it SHALL read only the adapter-neutral remote project title and SHALL NOT inspect provider-specific project fields
