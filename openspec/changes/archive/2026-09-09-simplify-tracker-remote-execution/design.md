## Context

See `proposal.md` for motivation. Trackers currently persist `executionMode`, adapter construction branches directly on it, and proactive extension checks are rendered in both tracker configuration and remote-issue selection. The extension handshake already distinguishes bridge compatibility, exact OSI website approval, and destination approval. The authenticated sidebar has a footer area below its user menu suitable for app-wide integration status.

## Goals / Non-Goals

**Goals:**

- Preserve behavior while replacing an implementation choice with a user-understandable capability.
- Make adapter selection deterministic and keep create/export retry semantics safe.
- Compute one device-local extension readiness model shared by the sidebar details and operation errors.
- Preserve SSR safety, mobile/touch behavior, keyboard access, and collapsed-sidebar usability.

**Non-Goals:**

- Detect CORS by probing a tracker or switch transports after failures.
- Move credentials, approvals, or extension state to the OSI server.
- Change tracker relationships or historical export data.

## Decisions

### Persist capability and derive transport

Replace the enum column and boundary field with a non-null boolean `directBrowserAccess`, defaulting to `true`. Adapter construction maps `true` to the client adapter and `false` to the extension adapter. No call site chooses transport independently.

Alternative considered: retain both fields or infer capability from `executionMode`. This would preserve two sources of truth and keep implementation language in APIs and forms, so it is rejected.

### Use a behavior-preserving schema migration

Add the boolean, populate it from the current two-mode values, enforce its default/non-null constraint, then remove the enum column and its database type if unused. Existing foreign keys and tracker ids are untouched. Migration tests cover both mappings and relationship preservation.

Alternative considered: reset all trackers to direct access. This could silently break installations that already require the extension, so it is rejected.

### Prefer direct execution without runtime fallback

Direct-capable trackers always use direct requests, even when the extension is installed and approved. Extension-required trackers always use the extension. Failures remain transport-specific and are never replayed automatically.

Alternative considered: dynamically prefer an available extension or fall back after a direct failure. A failure cannot reliably be classified as CORS, and replaying creates risks duplicate remote logs, so it is rejected.

### Centralize readiness in a sidebar composable and footer component

Extend the device-local availability model to combine the handshake with the authenticated user's active trackers and exact destination approval results. A sidebar footer component renders the aggregate indicator and informational popover; it sits immediately below the user menu and receives collapsed state from the existing sidebar layout. Keeping the user menu first preserves its established position and separates account actions from integration diagnostics. Required trackers sort before optional direct-capable trackers.

Aggregation is evaluated in this order:

1. no extension-required trackers -> neutral;
2. bridge absent/incompatible or OSI website unapproved -> red;
3. any required destination unapproved -> orange;
4. otherwise -> green.

Alternative considered: keep status panels near every remote control. This duplicates checks, produces inconsistent states, and overloads configuration forms, so only contextual errors remain at operation sites.

### Report approval state without initiating approval

The popover reads exact website/destination approval state through the existing bridge contract, but remains an informational diagnostic surface and does not initiate approval. Approval continues through contextual extension-owned flows, avoiding a second setup workflow in the sidebar. The popover does not treat browser host permission as approval and never receives credentials. Rechecks after approval update the shared status model.

## Risks / Trade-offs

- [Boolean wording may still confuse non-technical users] -> Default it on and provide concise localized help with consequence-first wording plus CORS as secondary detail.
- [Removing `executionMode` breaks stale API clients] -> Treat this as an intentional boundary breaking change and update all first-party callers and contract tests atomically.
- [Handshake latency could make the footer flicker] -> Start with a non-alarming checking state and avoid red until a required extension check resolves.
- [Many trackers could make the popover unwieldy] -> Use a bounded scroll area while preserving required-first ordering and keyboard navigation.
- [Hover-only behavior would fail on touch and keyboard] -> Support focus and click/tap as first-class triggers and expose text/icon semantics beyond color.

## Migration Plan

1. Deploy the database migration before application code reads `directBrowserAccess`.
2. Release schema, API, UI, adapter routing, and tests together; no dual-read period is needed for this self-hosted MVP.
3. On rollback, recreate `executionMode` by mapping `true` to `client` and `false` to `extension` before removing the boolean. Relationship and history tables require no rollback work.