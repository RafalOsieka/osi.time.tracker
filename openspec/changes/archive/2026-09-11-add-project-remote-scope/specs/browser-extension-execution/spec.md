## MODIFIED Requirements

### Requirement: REQ-309 Validated versioned operation bridge

The website-extension boundary SHALL expose only the nine neutral tracker operations and a credential-free compatibility/availability handshake. Requests and responses SHALL be schema-validated, correlated to a requesting document and request identifier, and bounded in size and lifetime. The extension SHALL independently verify the actual sending extension context, website origin, and top-level frame; it SHALL NOT trust a page-supplied origin. Unsupported versions, operations, malformed inputs, or unsolicited responses SHALL NOT result in remote execution or a false success.

#### Scenario: Compatible operation
- **WHEN** an approved document and extension agree on the protocol version and required capability
- **THEN** a validated operation SHALL return only the corresponding validated neutral result or safe error to that document

#### Scenario: Incompatible versions
- **WHEN** the installed extension cannot support the website's protocol version or requested operation
- **THEN** the website SHALL display an incompatibility/update state without transmitting the tracker secret or invoking the operation

#### Scenario: Forged or malformed request
- **WHEN** a request originates from an unapproved document/frame, supplies an unsupported operation, or fails input validation
- **THEN** the extension SHALL reject it before any tracker request

#### Scenario: Late or unrelated reply
- **WHEN** a reply belongs to another document, an expired request, or a different operation
- **THEN** the website SHALL discard it rather than settling an unrelated request

## ADDED Requirements

### Requirement: REQ-330 Bridge carries the catalog operation and scoped search inputs
The operation bridge SHALL add the remote project catalog operation and SHALL widen the title-search and exact-lookup inputs to an object carrying the query (or issue id) and an optional scope `{ remoteProjectId }`. The exact-lookup result SHALL be the nullable lookup object `{ result, inScope }`. The handshake SHALL advertise the catalog operation in `supportedOperations` when the installed extension implements it. The website SHALL NOT offer the remote project select for an extension-only tracker unless the handshake advertises the catalog operation, and SHALL treat scoped search on an extension that rejects the widened input as the existing incompatibility state rather than falling back to an unscoped search. The scope SHALL NOT alter which destination the request is approved for: it is a query parameter on the already-approved tracker origin.

#### Scenario: Catalog through the extension
- **WHEN** an approved document requests the catalog operation from an extension that advertises it
- **THEN** the extension SHALL execute the provider's catalog fetch and return only the validated neutral project list

#### Scenario: Scoped search through the extension
- **WHEN** an approved document sends a title search with a scope
- **THEN** the extension SHALL forward the scope to the same provider implementation and return the scoped neutral results

#### Scenario: Older extension lacks the catalog
- **WHEN** the handshake's `supportedOperations` omits the catalog operation
- **THEN** the website SHALL disable the remote project select with the incompatibility hint and SHALL NOT send the operation

#### Scenario: Older extension rejects the widened input
- **WHEN** the installed extension fails validation of a scoped search input
- **THEN** the website SHALL surface the incompatibility/update state and SHALL NOT retry the search without the scope

#### Scenario: Scope does not widen approvals
- **WHEN** a scoped request targets a tracker origin
- **THEN** the extension SHALL enforce the same origin approval as for an unscoped request and SHALL NOT treat the scope as a new destination
