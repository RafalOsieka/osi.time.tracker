# Spec Delta

## ADDED Requirements

### Requirement: REQ-533 Returning to a tab re-enters an expired access layer
When the user returns to an open tab, the client SHALL request the session endpoint without following redirects, at most once a minute. A redirect means an access layer in front of the app has expired, and the client SHALL reload the page so re-authentication starts at once. Any other outcome SHALL leave the page as it is.

#### Scenario: Access layer has expired
- **WHEN** the user returns to an open tab and the session request is answered with a redirect
- **THEN** the page SHALL reload

#### Scenario: Session endpoint answers normally
- **WHEN** the user returns to an open tab and the session endpoint answers, whether logged in or not
- **THEN** the page SHALL NOT reload

#### Scenario: Network failure
- **WHEN** the user returns to an open tab and the session request fails without a response
- **THEN** the page SHALL NOT reload

#### Scenario: Repeated returns
- **WHEN** the user returns to the tab several times within one minute
- **THEN** the client SHALL send at most one session request in that minute
