## REMOVED Requirements

### Requirement: REQ-027 List own clients
**Reason**: Client entity is dropped; Trackers replace Clients as the top-level connection entity.
**Migration**: Use `GET /api/trackers` and the Trackers page (`tracker-management` REQ-244).

### Requirement: REQ-028 Create a client
**Reason**: Client entity is dropped.
**Migration**: Create a Tracker via `POST /api/trackers` (`tracker-management` REQ-245).

### Requirement: REQ-029 Edit a client name
**Reason**: Client entity is dropped.
**Migration**: Edit a Tracker via `PATCH /api/trackers/[id]` (`tracker-management` REQ-246).

### Requirement: REQ-030 Soft-delete a client
**Reason**: Client entity is dropped.
**Migration**: Soft-delete a Tracker via `DELETE /api/trackers/[id]` (`tracker-management` REQ-247).

### Requirement: REQ-031 Strict cross-user isolation
**Reason**: Client endpoints are removed; isolation moves to tracker endpoints.
**Migration**: See `tracker-management` REQ-248.

### Requirement: REQ-033 Accessible, tokenized Clients UI
**Reason**: Clients page is replaced by Trackers UI.
**Migration**: See `tracker-management` REQ-251.

### Requirement: REQ-034 Client-side validation of the client form
**Reason**: Client form is removed.
**Migration**: See `tracker-management` REQ-252.
