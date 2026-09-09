## Why

The `server` execution mode duplicates provider behavior through a credential-forwarding Nitro proxy without enabling a topology that `client` or `extension` cannot cover. Removing it reduces security exposure and maintenance while preserving direct browser access for CORS-enabled trackers and extension-mediated access where browser CORS would otherwise block integration.

## What Changes

- **BREAKING** Remove `server` from the accepted tracker execution modes and from tracker configuration UI.
- Keep `client` for public or VPN-reachable trackers that allow requests from the OSI browser origin.
- Keep `extension` for desktop browsers that can reach the tracker but cannot call it directly because of CORS; it remains unavailable on mobile.
- Migrate persisted `server` tracker configurations to `client` so existing records remain usable and editable.
- Remove the Nitro remote proxy endpoints, server execution adapter, server-side adapter factory, and their dedicated tests and translations.
- Align remote linking, synchronization, provider contracts, roadmap, vision, and user stories with the two-mode model.

## Non-goals

- Storing tracker credentials on the OSI server.
- Providing extension support on mobile or bypassing tracker network reachability requirements.
- Changing provider operations, DTOs, rounding, linking, synchronization, or error semantics beyond execution transport.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `tracker-management`: restrict configuration to `client` and `extension`, including migration of persisted `server` values and mobile availability guidance.
- `remote-adapter-contract`: define transport and credential behavior for only `client` and `extension`.
- `openproject-adapter`: remove server-mode equivalence requirements.
- `redmine-adapter`: remove server-mode equivalence requirements.
- `remote-issue-linking`: remove proxied search while preserving direct and extension execution.
- `remote-sync-review`: remove proxied reads and exports while preserving browser orchestration.

## Impact

Tracker schemas, database migration history, tracker form/i18n, adapter selection, Nitro remote routes and utilities, unit/Nuxt/API E2E tests, six existing capability specs, and remote-integration documentation are affected. Deployments upgrading with `server` trackers will transparently use `client`; trackers that do not permit cross-origin browser requests will require the desktop extension.