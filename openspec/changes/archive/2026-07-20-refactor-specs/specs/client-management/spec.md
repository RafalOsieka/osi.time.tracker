## REMOVED Requirements

### Requirement: REQ-032 Authenticated and CSRF-guarded client endpoints
**Reason**: This requirement restated the shared boundary contract also present
in `project-management` REQ-090, `task-management` REQ-139, and `time-tracking`
REQ-147. It is extracted into the new `api-endpoint-conventions` capability
(REQ-169–REQ-173) to remove duplication.
**Migration**: Client endpoints continue to follow the same auth + CSRF + error
contract, now defined once in `api-endpoint-conventions` REQ-169 (auth),
REQ-170 (CSRF), and REQ-171 (error contract). The `client-management` Purpose is
updated to reference the shared conventions instead of restating them. No code
or behavior changes.
