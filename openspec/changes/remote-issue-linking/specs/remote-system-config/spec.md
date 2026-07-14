## MODIFIED Requirements

### Requirement: REQ-TTR-104 Edit and remove a Client's remote configuration

A user SHALL be able to edit and remove the remote configuration of a Client they own. Editing any configuration field, including `systemType` or normalized `baseUrl`, SHALL retain the configuration identity and existing Task remote issue references without remote validation, cleanup, or metadata migration. Removing a configuration SHALL soft-delete it, preserve existing Task references and their cached issue IDs and titles as historical data, and clear the browser-held secret. A preserved reference whose configuration is deleted SHALL be unavailable for remote queries and URL generation. Creating a later active configuration SHALL NOT automatically reassign preserved references to it.

#### Scenario: Edit an existing configuration
- **WHEN** a user submits changes to fields of an existing configuration on their Client
- **THEN** the system SHALL persist the updated values, return the same configuration identity, and leave its Task references linked without remote validation

#### Scenario: Change tracker identity
- **WHEN** a user changes the existing configuration's system type or normalized base URL
- **THEN** the system SHALL assume its referenced issue IDs remain valid and SHALL retain their cached titles without validation, cleanup, or migration prompts

#### Scenario: Remove a configuration
- **WHEN** a user removes the remote configuration of their Client
- **THEN** the system SHALL soft-delete the stored configuration, preserve its Task references, and the client SHALL clear the browser-held secret associated with that configuration id

#### Scenario: Use a reference after configuration removal
- **WHEN** a Task reference points to a deleted configuration
- **THEN** the system SHALL expose its cached issue ID and title but SHALL NOT query the remote system or generate an issue URL

#### Scenario: Configure the Client again after removal
- **WHEN** the user creates a new active configuration after the prior configuration was removed
- **THEN** the system SHALL NOT automatically rebind old Task references to the new configuration

## Open Questions

None.