## REMOVED Requirements

### Requirement: REQ-108 Proxy remote issue search through the OSI server
**Reason**: `remote-issue-proxy` is a three-requirement standalone spec describing
the server-execution transport half of remote configuration. It is folded into
`remote-system-config` (the "how the tracker is reached" concern), keeping the
capability count lower and the transport rules next to the configuration they
belong to.
**Migration**: Re-added verbatim (same number) to `remote-system-config` REQ-108.
No code or behavior changes.

### Requirement: REQ-109 Forwarded proxy credential is never persisted
**Reason**: Folded into `remote-system-config` alongside REQ-108/REQ-110.
**Migration**: Re-added verbatim (same number) to `remote-system-config` REQ-109.
No code or behavior changes.

### Requirement: REQ-110 Proxy failures map to the translated error contract
**Reason**: Folded into `remote-system-config` alongside REQ-108/REQ-109.
**Migration**: Re-added verbatim (same number) to `remote-system-config` REQ-110.
No code or behavior changes.

Note: With all three requirements folded in, the `remote-issue-proxy` capability
is dissolved and its spec file is deleted at archive time.
