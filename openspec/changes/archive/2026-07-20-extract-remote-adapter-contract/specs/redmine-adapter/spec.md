## MODIFIED Requirements

### Requirement: REQ-094 Redmine authentication uses the API access key header

The Redmine client SHALL authenticate every upstream request with the user's Redmine API access key sent in the `X-Redmine-API-Key` request header. The auth header SHALL be constructed by the Redmine client in exactly one place; transports SHALL remain credential-scheme-agnostic and SHALL only attach headers provided with the request, per the contract's transport-neutrality rule (`remote-adapter-contract` REQ-202). Existing credential-hygiene rules apply unchanged (`remote-adapter-contract` REQ-203): the secret SHALL NOT be persisted, logged, serialized, or returned by the OSI server, and under `client` execution mode it SHALL be sent only to the configured Redmine origin.

#### Scenario: Requests carry the Redmine API key header
- **WHEN** the adapter executes any Redmine operation with a provided secret
- **THEN** the upstream request SHALL include the `X-Redmine-API-Key` header and SHALL NOT include any other provider's credential header

#### Scenario: Transports contain no provider auth logic
- **WHEN** either transport executes a remote request
- **THEN** it SHALL attach only the headers supplied by the provider client and SHALL NOT construct provider-specific credentials itself
