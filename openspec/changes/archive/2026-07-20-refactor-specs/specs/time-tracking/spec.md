## REMOVED Requirements

### Requirement: REQ-147 Authenticated and CSRF-guarded time-entry endpoints
**Reason**: Duplicate of the shared boundary contract now extracted into the new
`api-endpoint-conventions` capability (REQ-169–REQ-173).
**Migration**: Time-entry endpoints continue to follow the same auth + CSRF +
error contract, now defined once in `api-endpoint-conventions` REQ-169 (auth),
REQ-170 (CSRF), and REQ-171 (error contract). The `time-tracking` Purpose is
updated to reference the shared conventions. No code or behavior changes.
