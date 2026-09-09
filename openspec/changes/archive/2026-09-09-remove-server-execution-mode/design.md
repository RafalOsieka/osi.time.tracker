## Context

See `proposal.md` for motivation. Execution mode is persisted as text but constrained by shared Zod schemas and TypeScript unions. The browser currently selects direct, server-proxy, or extension adapters; six Nitro endpoints and a server adapter factory implement the proxy path. Provider cores are already transport-neutral.

## Goals / Non-Goals

**Goals:**
- Collapse runtime selection to direct browser and extension execution.
- Upgrade persisted data before narrowing boundary types.
- Remove all tracker-operation credential forwarding through OSI.
- Keep provider behavior and browser-owned credentials unchanged.

**Non-Goals:**
- Redesigning the provider contract or extension protocol.
- Detecting mobile user agents at tracker-save time.
- Automatically proving tracker CORS compatibility.

## Decisions

### Migrate `server` rows to `client`

Add a forward database migration that updates only `trackers.executionMode = 'server'`. This preserves identity and associations and yields values accepted by the narrowed runtime schema.

Alternative: reject or delete legacy trackers. Rejected because it strands existing records or destroys user configuration. Migrating to `extension` was also rejected because extension installation is not universal and is unavailable on mobile.

### Remove the proxy vertically

Delete the six remote-operation routes, server-side factory/utilities, browser `ServerExecutionAdapter`, proxy-only schemas where unused, translations, and dedicated tests. Then narrow the shared execution-mode schema/order and adapter factory.

Alternative: keep dormant proxy code while hiding the mode. Rejected because it retains SSRF-sensitive credential forwarding and maintenance cost with no supported caller.

### Treat extension availability as operation-time capability

Tracker configuration continues to persist `extension` without probing the current device. Mobile and browsers without the extension receive existing actionable extension errors when an operation is attempted; there is no fallback to `client`, which could unexpectedly trigger CORS failures or alter credential routing.

Alternative: hide or reject `extension` based on user-agent detection. Rejected because tracker configuration is device-independent and user-agent detection is unreliable.

### Document CORS as a tracker policy requirement

`client` works wherever the device can reach the tracker and the tracker permits the OSI origin. VPN placement does not determine execution mode by itself. Documentation and labels will describe this accurately rather than implying the browser disables CORS.

## Risks / Trade-offs

- [A migrated tracker blocks on CORS] -> Explain the requirement and direct desktop users to `extension`.
- [A stale client submits `server`] -> Boundary validation rejects it without persisting an unsupported value.
- [Removing proxy tests loses provider coverage] -> Retain provider transport tests and supported-mode orchestration coverage; delete only proxy-specific assertions.
- [Rollback sees migrated rows as `client`] -> Old code supports `client`, so application rollback remains functional; the removed mode selection is not restored automatically.

## Migration Plan

1. Apply the data migration before deploying narrowed application code.
2. Deploy the two-mode schema, UI, adapter selection, and proxy removal together.
3. Verify no active or migrated tracker exposes `server`, supported modes complete representative operations, and remote proxy routes are absent.
4. On rollback, deploy the previous application; migrated trackers continue as valid `client` trackers.