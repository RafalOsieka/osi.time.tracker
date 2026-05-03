# Spec: Core Domain (Remodeled)

## 1. Project Management
- **Default Project**: Exactly one project must be marked `IsDefault`. A system-default project named "Local" (or "General") is created upon initialization.
- **Remote Configuration**: A project may optionally define `RemoteTarget` (Redmine, OpenProject) and `RemoteBaseUrl`.
- **Validation**:
    - `Name` is required and unique.
    - `RemoteBaseUrl` must be a valid URI if `RemoteTarget` is set.

## 2. Item Management
- **Title Inheritance**:
    - On creation (local): `Title` is copied from the first associated `TimeEntry`.
    - On match (remote): `Title` is updated from the remote system's issue/work-package title.
- **Project Association**: An item must belong to exactly one project.
- **Remote Mapping**: An item may have a `RemoteId`. For remote projects, this ID identifies the specific task in the external system.

## 3. Time Tracking
- **Single Active Timer**: Only one `TimeEntry` can have a null `EndUtc` across the entire system.
- **Entry Schema**:
    - `Title`: Required string.
    - `StartUtc`: Required DateTime.
    - `EndUtc`: Optional DateTime.
    - `ItemId`: Required Guid (link to grouping item).

## 4. Security & Tokens
- **Client-Side Storage**: Tokens/API keys for remote projects MUST be stored in the browser's `localStorage`.
- **Storage Key**: `osi_token_{projectId}`.
- **Protocol**: Tokens are sent as headers (e.g., `X-Redmine-API-Key` or `Authorization: Bearer ...`) directly from the browser to the remote endpoint.
