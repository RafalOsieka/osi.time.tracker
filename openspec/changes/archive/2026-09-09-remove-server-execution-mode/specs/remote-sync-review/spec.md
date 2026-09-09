## MODIFIED Requirements

### Requirement: REQ-121 Browser orchestration supports direct and proxied client transport
The browser SHALL orchestrate remote reads, at most one remote creation per included task, and local finalization under `client` or `extension`. Both modes SHALL provide equivalent provider behavior, retries, deduplication, and per-task isolation. `client` SHALL call the tracker directly; `extension` SHALL use the approved desktop extension. Neither mode SHALL send tracker credentials through OSI APIs, and execution SHALL NOT silently fall back between modes.

#### Scenario: Client execution mode completes the two-phase operation
- **WHEN** a `client` tracker exports a task
- **THEN** the browser SHALL create the remote log directly and finalize its remote ID locally

#### Scenario: Server execution mode completes the same two-phase operation
- **WHEN** a stale client attempts export under `server`
- **THEN** validation SHALL reject the unsupported mode before remote creation

#### Scenario: Server execution-mode credentials remain ephemeral
- **WHEN** a stale request includes server-mode credentials
- **THEN** no remote-operation OSI endpoint SHALL accept or forward them

#### Scenario: Server execution-mode destination is restricted
- **WHEN** a caller targets a former remote proxy route
- **THEN** no generic or tracker-specific server proxy SHALL contact the supplied destination

#### Scenario: Extension completes the two-phase operation
- **WHEN** an `extension` tracker exports a task on a supported desktop browser
- **THEN** the extension SHALL create the remote log and the browser SHALL finalize its remote ID locally

#### Scenario: Extension is unavailable on mobile
- **WHEN** Remote Sync loads an `extension` tracker on mobile
- **THEN** affected rows SHALL expose an actionable unavailable state and SHALL NOT attempt or fall back to direct execution

#### Scenario: Transport failures remain isolated and retryable
- **WHEN** one supported transport operation fails
- **THEN** its task SHALL expose the appropriate retryable state without blocking unaffected tasks