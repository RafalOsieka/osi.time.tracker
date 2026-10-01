# Proposal

## Why

The neutral time-log DTO declares the remote issue title optional, and REQ-341 forbids adapters from fetching it. OpenProject always fills it from HAL links; Redmine never can (REQ-343). The field is therefore optional *by provider*, not by data — callers get different results per provider, which is exactly the branching the contract forbids. The upcoming client report (and Redmine imports, which today cache no issue title) need the title from every tracker.

## What Changes

- **BREAKING (contract)**: `RemoteTimeLogDto.remoteIssueTitle` becomes a required, nullable field. A string is the issue's title; `null` means only that the tracker does not disclose the issue to this account (deleted or not visible) — the same meaning for every provider.
- New contract rule: an optional or nullable DTO field may be empty only for a reason in the data, never because of the provider.
- Same-day and date-range time-log fetches resolve titles the payload lacks with one batched issue lookup per 100 distinct issues (none when the payload is complete). A failed lookup fails the whole fetch; it never degrades to `null`.
- Each provider adapter gains a batched issue lookup by ids (Redmine includes closed issues). It stays adapter-internal; it is not a new bridge operation.
- **BREAKING (extension bridge)**: protocol version bumps so an older extension that returns the old DTO shape is reported as incompatible instead of failing validation mid-operation.
- Redmine imports now cache the real issue title instead of falling back to the issue id.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `remote-adapter-contract`: REQ-341 (title required/nullable, bounded enrichment requests), new requirement for title resolution semantics.
- `remote-openproject-adapter`: REQ-342 (lookup only for logs whose HAL links lack a title).
- `remote-redmine-adapter`: REQ-343 (titles resolved through the batched lookup, closed issues included).
- `remote-browser-extension`: new requirement for the protocol version carrying the enriched DTO.

## Non-goals

- Making remote project id/title required: both providers already fill them from the payload whenever the data exists, which satisfies the new rule.
- A public `getIssuesByIds` contract/bridge operation — no page-side caller needs it yet.
- Caching issue titles across fetches or sessions.
- Changing the import endpoint body (the page omits a `null` title, as today's optional field allows).

## Impact

- `packages/remote-trackers`: contracts (`remote-time-log.ts`), OpenProject and Redmine clients/adapters, package tests.
- `packages/extension-protocol`: `remoteTimeLogSchema`, `EXTENSION_PROTOCOL_VERSION`.
- `apps/extension`: rebuilt against the new protocol (no logic change).
- `apps/web`: `use-remote-log-import` maps `null` → omitted; Remote Sync / monthly report consume the DTO unchanged apart from the type.
- Redmine fetches cost at most one extra request per 100 distinct issues per fetch.
