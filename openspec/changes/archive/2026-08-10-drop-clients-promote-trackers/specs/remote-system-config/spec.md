## REMOVED Requirements

### Requirement: REQ-122 Configure a remote system on a Client
**Reason**: Remote configuration is no longer nested under Client; it is the Tracker entity itself.
**Migration**: Create/update Trackers via `tracker-management` (REQ-245, REQ-246).

### Requirement: REQ-123 Client-side credentials are never persisted server-side
**Reason**: Folded into tracker-management with Tracker identity.
**Migration**: See `tracker-management` REQ-249.

### Requirement: REQ-124 Default values for the remote system's required fields
**Reason**: Folded into tracker-management on the Tracker entity.
**Migration**: See `tracker-management` REQ-250.

### Requirement: REQ-125 Edit and remove a Client's remote configuration
**Reason**: Nested Client remote-config CRUD is replaced by Tracker edit/delete.
**Migration**: See `tracker-management` REQ-246 and REQ-247.

### Requirement: REQ-126 Remote configuration is isolated per user
**Reason**: Isolation is defined on Tracker endpoints.
**Migration**: See `tracker-management` REQ-248.

### Requirement: REQ-108 Proxy remote issue search through the OSI server
**Reason**: Proxy behavior is re-homed under tracker-management against Tracker ids.
**Migration**: See `tracker-management` REQ-253.

### Requirement: REQ-109 Forwarded proxy credential is never persisted
**Reason**: Folded into tracker-management.
**Migration**: See `tracker-management` REQ-254.

### Requirement: REQ-110 Proxy failures map to the translated error contract
**Reason**: Folded into tracker-management.
**Migration**: See `tracker-management` REQ-255.

### Requirement: REQ-220 Nearest-increment rounding rules
**Reason**: Rounding rules are defined on Trackers.
**Migration**: See `tracker-management` REQ-256.

### Requirement: REQ-221 Rounding never reduces a non-zero duration to zero
**Reason**: Rounding zero-floor rule is defined on Trackers.
**Migration**: See `tracker-management` REQ-257.
