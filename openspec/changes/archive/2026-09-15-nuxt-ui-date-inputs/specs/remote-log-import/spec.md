## MODIFIED Requirements

### Requirement: REQ-340 Import dialog on the Trackers page
The Trackers page SHALL offer an "Import history" action per tracker that opens a dialog with these phases: a range phase with one labelled inclusive date-range field (the shared segmented date-range field with calendar affordance, REQ-359 in shared-ui-components) defaulting to five years before today through today, rejecting an inverted or incomplete range inline, and a list of the tracker's non-deleted Projects with their remote project scope, marking unscoped Projects as not receiving a default target (this list SHALL NOT call the tracker); a scanning phase that walks the range month by month, fetching logs and computing each log's default target Project by scope (REQ-334), with an accessible progress indicator and a cancel action, and SHALL NOT call the dry-run endpoint; a mapping phase (REQ-358) listing one row per remote project encountered across the whole range with its raw log count and an editable target-Project control, defaulting to the scope-based suggestion or to "do not import" when there is none; a preview phase, generated from the mapping phase's current selections, listing each target Project the user assigned with the count to import and the count already linked, plus totals, and excluding every remote project left unassigned; an importing phase with per-month progress and no cancel action, because each month commits atomically and a re-run resumes by skipping; and a done phase with totals, a reminder of unassigned counts, and a note that entry times are synthetic while durations are exact. Every log assigned a target Project in the mapping phase SHALL be sent for import; the endpoint's existing-identity skip (REQ-338) makes resubmitting an already-linked log a no-op, and this is also how the done phase's already-linked count is produced without the client tracking it separately. The preview phase's "back" action SHALL return to the mapping phase without discarding the scan; the mapping phase's "back" action SHALL return to the range phase and discard the scan. Advancing from the mapping phase to the preview phase SHALL (re-)run the dry run against the current selections. A month that fails during scanning or importing SHALL stop the run, show the translated error, state the months already committed, and offer a retry that re-runs the same range. The action SHALL be disabled with a translated hint when no secret is stored in the browser for the tracker. The dialog SHALL meet WCAG 2.1 AA (labelled fields, keyboard operable, progress and results announced) and all strings SHALL exist in `en` and `pl` in parity.

#### Scenario: Unscoped project flagged before scanning
- **WHEN** the range phase opens for a tracker with a bound Project that has no scope
- **THEN** the project list SHALL show that Project marked as not receiving a default target, without any remote request

#### Scenario: Range phase opens with the default range filled
- **WHEN** the range phase opens
- **THEN** the date-range field SHALL show a start of five years before today and an end of today, both ends complete, under a single translated label

#### Scenario: Cancel only while scanning
- **WHEN** the dialog is scanning
- **THEN** a cancel action SHALL abort the scan and return to the range phase; while importing, no cancel action SHALL be offered

#### Scenario: Retry resumes after a failed month
- **WHEN** a month fails during import and the user activates retry
- **THEN** the dialog SHALL re-run the same range, report the previously committed months as skipped, and continue from the failed month

#### Scenario: Preview before writing
- **WHEN** the user submits a range
- **THEN** the dialog SHALL scan month by month without a dry run, show the mapping phase for the user to confirm or adjust each remote project's target, and only then run the dry run and show the per-Project preview before any write

#### Scenario: Unmatched projects are visible
- **WHEN** the scan finds logs in a remote project without a scope-matched Project
- **THEN** the mapping phase SHALL list that remote project with no default target selected, and unless the user assigns one there, the preview phase SHALL exclude it from import

#### Scenario: Preview reflects the finalized mapping, not raw scope matches
- **WHEN** the user changes a mapping row's target away from its scope-matched default and advances to preview
- **THEN** the preview SHALL group that remote project's logs under the newly chosen Project, not the original scope match

#### Scenario: Nothing to import
- **WHEN** every remote project row is left at "do not import" in the mapping phase, or the scan found no logs
- **THEN** the import action SHALL be disabled and the preview SHALL say so

#### Scenario: Import completes
- **WHEN** the user confirms the preview
- **THEN** the dialog SHALL import month by month with progress and finish with totals of imported, skipped, and unassigned logs

#### Scenario: No secret in the browser
- **WHEN** the tracker has no stored secret
- **THEN** the action SHALL be disabled and its hint SHALL point to entering the secret in the tracker form

#### Scenario: Inverted range
- **WHEN** the range field's start is after its end
- **THEN** an inline error SHALL be shown and no fetch SHALL start

#### Scenario: Incomplete range
- **WHEN** either end of the range field is incomplete (a cleared segment)
- **THEN** the translated "range required" inline error SHALL be shown and no fetch SHALL start

#### Scenario: Range picked from the calendar
- **WHEN** the user opens the range field's calendar and picks a start day and then an end day
- **THEN** both ends of the field SHALL update, the calendar SHALL close after the end day, and submitting SHALL scan exactly that inclusive range

#### Scenario: Keyboard and announcements
- **WHEN** a keyboard user operates the dialog
- **THEN** every phase, including mapping, SHALL be reachable, the range field's segments and calendar SHALL be operable from the keyboard, and progress and results SHALL be announced via a live region
