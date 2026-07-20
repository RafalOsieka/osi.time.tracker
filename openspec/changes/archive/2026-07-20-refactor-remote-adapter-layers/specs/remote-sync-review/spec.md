## MODIFIED Requirements

### Requirement: REQ-TTR-124 Browser orchestration supports direct and proxied client transport

The browser SHALL orchestrate remote reads, one remote creation per included task, and local finalization regardless of execution mode. The remote client SHALL support sending remote requests directly from the browser (`client` execution mode) or through authenticated Nitro endpoints (`server` execution mode) selected by the remote-system configuration's `executionMode`. Both modes SHALL provide equivalent account resolution, activities, paginated time logs, time-entry creation, error classification, retry behavior, deduplication, per-task outcome isolation, and identical provider-quirk handling by delegating to the same provider adapter. In `server` execution mode Nitro SHALL authorize the local user, restrict requests to that user's configured remote origin, and SHALL NOT persist or log forwarded remote credentials.

#### Scenario: Client execution mode completes the two-phase operation
- **WHEN** a remote configuration selects `client` execution mode and the user exports a task
- **THEN** the browser SHALL create the OpenProject log directly and finalize the returned remote ID through the authenticated local endpoint

#### Scenario: Server execution mode completes the same two-phase operation
- **WHEN** a remote configuration selects `server` execution mode and the user exports a task
- **THEN** the browser SHALL request remote creation through the Nitro endpoint and finalize the returned remote ID through the same authenticated local endpoint

#### Scenario: Server execution-mode credentials remain ephemeral
- **WHEN** Nitro forwards a remote request containing remote credentials
- **THEN** it SHALL use them only for that request and SHALL NOT persist them or include them in logs

#### Scenario: Server execution-mode destination is restricted
- **WHEN** a server execution-mode request targets an origin other than the authenticated user's configured remote system origin
- **THEN** Nitro SHALL reject the request without contacting the supplied destination

#### Scenario: Transport failures remain isolated and retryable
- **WHEN** either execution mode fails for one task or shared request scope
- **THEN** the page SHALL expose the same retryable state and SHALL NOT block unaffected tasks
