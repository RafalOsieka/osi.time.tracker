# Change Proposal: Domain Remodeling

## Why

The current MVP model stores remote configuration (`RemoteTarget`, `RemoteBaseUrl`) on individual `Item` entities, causing duplication across every item under the same remote project and leaving no deterministic anchor for new time entries when no item is selected.

## What Changes

- **BREAKING** Move `RemoteTarget` and `RemoteBaseUrl` from `Item` to `Project`.
- **BREAKING** Remove `TimeEntry.Note`; `TimeEntry.Title` is the sole task description field.
- Add `Project.IsDefault` flag (exactly one project is default at all times; the seeded "Local" project is default and cannot be deleted).
- Add `Item.RemoteId` (optional) replacing per-item remote config; `Item.Title` caches the remote issue title when matched.
- Frontend token storage key changes from per-item to per-project: `osi_token_{projectId}`.

## Capabilities

### New Capabilities

- `project-remote-config`: Projects own remote system configuration (`RemoteTarget`, `RemoteBaseUrl`) and the `IsDefault` flag; enforces single-default invariant.
- `item-remote-matching`: Items are lightweight grouping containers with an optional `RemoteId`; matching an item to a remote issue caches its title via `PATCH /api/items/{id}/match`.

### Modified Capabilities

- `frontend-state-management`: Token storage keyed by `projectId` instead of item-level remote config; publish store and settings UI updated accordingly.

## Impact

- **Core**: `Project`, `Item`, `TimeEntry` entities change shape; domain services (`ProjectService`, `ItemService`) updated.
- **Infrastructure**: EF Core migration required — add columns to `Projects` and `Items`, drop `Note` from `TimeEntries`, add partial unique index on `Projects(IsDefault)`.
- **Api**: DTOs and endpoints for projects and items updated; new `PATCH /api/items/{id}/match` endpoint.
- **Web**: Pinia stores (projects, items, publish), settings UI, and token utility updated.
