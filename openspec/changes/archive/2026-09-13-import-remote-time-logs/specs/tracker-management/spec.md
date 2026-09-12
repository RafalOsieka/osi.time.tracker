## ADDED Requirements

### Requirement: REQ-345 Trackers page exposes the import-history action
Each tracker row on the Trackers page SHALL offer an "Import history" action alongside edit and delete, as a labelled, keyboard-operable control with a tooltip. The action SHALL open the import dialog (REQ-340) for that tracker. When no secret is stored in the browser for the tracker, the control SHALL be disabled and its accessible name and tooltip SHALL be a translated hint that the secret must be entered in the tracker form first. The action SHALL be available for every supported `systemType` and for both `client` and `extension` execution. Its strings SHALL exist in `en` and `pl` in parity.

#### Scenario: Action opens the dialog
- **WHEN** the user activates Import history on a tracker whose secret is stored in the browser
- **THEN** the import dialog SHALL open for that tracker

#### Scenario: No secret disables the action
- **WHEN** a tracker has no stored secret
- **THEN** the action SHALL be disabled with the translated hint as its tooltip and accessible name

#### Scenario: Row actions remain siblings
- **WHEN** a tracker row renders edit, import, and delete
- **THEN** the three controls SHALL be sibling buttons, none nested inside another interactive element
