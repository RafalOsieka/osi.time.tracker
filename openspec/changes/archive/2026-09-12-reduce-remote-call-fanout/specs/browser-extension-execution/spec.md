## ADDED Requirements

### Requirement: REQ-331 Page-side extension operations are queued to the in-flight bound

The web app SHALL bound its own concurrent extension operations per document to the protocol's in-flight limit and SHALL queue further operations until a slot frees, in request order, instead of dispatching them and receiving a limit error. The queue SHALL be shared by every extension call site in the document. A queued operation SHALL be released when the operation ahead of it settles (success, failure, or timeout). Queueing SHALL NOT change the operation's result, error classification, or the unknown-create handling of a creation whose reply is lost. The page SHALL NOT raise the extension's own limit; a limit error returned by the extension SHALL still be surfaced as today when it occurs.

#### Scenario: Burst larger than the limit completes without a limit error
- **WHEN** a page issues more concurrent extension operations than the in-flight limit (for example a Remote Sync day with six linked tasks on one extension tracker)
- **THEN** no operation SHALL fail with the limit error and every operation SHALL eventually execute and return its own result

#### Scenario: Failure ahead in the queue releases the slot
- **WHEN** an in-flight operation fails or times out while others are queued
- **THEN** the next queued operation SHALL be dispatched and the failed operation SHALL report only its own error

#### Scenario: Queued create keeps unknown-create semantics
- **WHEN** a time-entry creation waits in the queue and the document closes before it is dispatched
- **THEN** it SHALL fail as a definite (not unknown) failure, and a creation that was already dispatched SHALL keep the existing unknown-create handling

#### Scenario: Queue is per document
- **WHEN** two OSI documents each issue operations
- **THEN** each SHALL be bounded independently and neither SHALL wait on the other's queue
