## Why

Users currently choose an adapter execution mode even though their actual decision is whether the tracker permits direct browser requests. Replacing that implementation choice with a network-capability setting and centralizing extension readiness in the sidebar makes configuration clearer and setup problems visible without duplicating checks across workflows.

## What Changes

- **BREAKING** Replace persisted `executionMode` with `directBrowserAccess`, migrating `client` to `true` and `extension` to `false` without changing tracker identities or related records.
- Select transport deterministically: direct browser access uses the client adapter; blocked direct access requires the extension adapter; never retry through another transport automatically.
- Replace the execution-mode selector with a default-enabled **Direct browser connection allowed** checkbox and accessible explanatory help covering browser restrictions and CORS.
- Add an extension status row below the user menu in the sidebar footer, including a responsive informational popover with extension compatibility, website approval, and per-tracker destination approval details.
- Aggregate status as neutral when no active tracker requires the extension, green when required extension setup is complete, orange when required tracker destinations lack approval, and red when the extension or OSI website approval is invalid.
- Remove redundant proactive extension status checks from tracker configuration and remote-issue selection while retaining contextual operation errors.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `tracker-management`: Replace user-selected execution mode with direct-browser capability configuration and behavior-preserving migration semantics.
- `browser-extension-execution`: Derive transport from tracker capability and provide centralized extension and destination-approval status in the sidebar.

## Impact

- Tracker database schema, migration, boundary schemas/DTOs, API contracts, forms, adapter construction, and related tests.
- Authenticated sidebar, extension bridge/availability composables, tracker approval flow, i18n, accessibility, and responsive behavior.
- Existing clients consuming tracker APIs must adopt `directBrowserAccess`; no tracker-linked projects, tasks, issue references, time entries, export history, archives, or deprecations are rewritten.

## Non-goals

- Automatic transport fallback, server-side credential storage, live tracker connectivity probing, or background synchronization.
- Changing remote operation semantics, export provenance, tracker ownership, or existing domain relationships.