## ADDED Requirements

### Requirement: API token stored per project in localStorage
The frontend SHALL store API tokens for remote systems in browser `localStorage` using the key `osi_token_{projectId}`.

#### Scenario: Token saved for a project
- **WHEN** a user enters an API token for a project's remote system
- **THEN** it is saved in `localStorage` under the key `osi_token_{projectId}`

#### Scenario: Token retrieved during publish
- **WHEN** the publish flow runs for a project
- **THEN** the token is read from `localStorage` using `osi_token_{projectId}`

#### Scenario: Token cleared from UI
- **WHEN** the user clears the token for a project
- **THEN** the corresponding `localStorage` entry is removed
