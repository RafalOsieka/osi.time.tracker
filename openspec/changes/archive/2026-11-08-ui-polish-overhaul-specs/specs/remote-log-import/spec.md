## MODIFIED Requirements

### Requirement: REQ-340 Import dialog on the Trackers page
Each tracker's "Import history" action SHALL open a dialog moving through range, scanning, mapping (REQ-358), preview, importing and done phases. The range phase SHALL show one labelled inclusive date-range field (REQ-359) defaulting to five years ago through today, rejecting an inverted or incomplete range inline, and list the tracker's non-deleted Projects with their remote scope, marking unscoped ones as getting no default target, without calling the tracker.

#### Scenario: Unscoped project flagged before scanning
- **WHEN** the range phase opens for a tracker with a bound Project that has no scope, and another Project that has one
- **THEN** the project list SHALL show the unscoped Project with a warning that it is not linked, plus one line of help under the list, without any remote request

#### Scenario: No project is linked
- **WHEN** the range phase opens and none of the tracker's Projects has a remote project
- **THEN** the rows SHALL mark each Project as not linked without a per-row warning, and one warning SHALL say that no Project is linked, with an action that opens the Projects page to set the links

#### Scenario: Scanning is presented as read-only
- **WHEN** the range phase is shown without a range error
- **THEN** the range field's help SHALL say that scanning only reads the history and that nothing is imported before the preview

#### Scenario: Range phase opens with the default range filled
- **WHEN** the range phase opens
- **THEN** the date-range field SHALL show a start of five years before today and an end of today, both ends complete, under a single translated label

#### Scenario: Inverted range
- **WHEN** the range field's start is after its end
- **THEN** an inline error SHALL be shown and no fetch SHALL start

#### Scenario: Incomplete range
- **WHEN** either end of the range field is incomplete (a cleared segment)
- **THEN** the translated "range required" inline error SHALL be shown and no fetch SHALL start

#### Scenario: Range picked from the calendar
- **WHEN** the user opens the range field's calendar and picks a start day and then an end day
- **THEN** both ends of the field SHALL update, the calendar SHALL close after the end day, and submitting SHALL scan exactly that inclusive range
