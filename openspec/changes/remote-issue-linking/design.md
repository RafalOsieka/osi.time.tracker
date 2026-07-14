## Context

Client-level remote configuration and browser-only secret storage already exist, while Tasks are created and edited through Timer flows. Story 10a crosses shared adapter code, browser transport, persistence, authenticated APIs, Task merge transactions, and Timer UI. OpenProject is the only MVP adapter; arbitrary configured tracker origins require both remote CORS support and a compatible application CSP.

## Goals / Non-Goals

**Goals:**

- Search OpenProject work packages by title phrase or exact issue ID without sending credentials through the OSI server.
- Persist and expose one lightweight remote reference per Task.
- Make link replacement, unlinking, Task merging, and configuration lifecycle behavior deterministic and user-scoped.
- Provide an accessible reusable picker while integrating it only into Timer Task rows.

**Non-Goals:**

- Remote Sync, time-log push, starting timers from issues, full issue import, pagination, or metadata refresh.
- Redmine or server-side transports, server-held credentials, and configuration migration/verification workflows.

## Decisions

### D1: Split transport-agnostic adapter logic from browser transport

Shared code defines adapter-neutral issue/search contracts and OpenProject request/response mapping. A browser composable supplies the configured base URL and the secret from `useRemoteConfigSecret`, then performs direct remote requests. Neither the credential nor raw OpenProject response shapes cross the OSI API boundary.

Alternative: proxy searches through Nitro. Rejected because it would transmit browser-held credentials to the server and contradict the MVP execution model.

### D2: Use explicit title and issue-ID search modes

The picker requires the user to choose `Title` or `Issue ID`, enter a value, and submit the search. Title mode requires at least three trimmed characters and asks OpenProject for a fixed maximum number of work packages whose subject matches the phrase. Issue-ID mode accepts any non-empty valid OpenProject work-package ID and performs an exact lookup. Both modes return the same adapter-neutral result shape and include issues regardless of status. A new submission supersedes stale in-flight results; users refine title queries rather than paging.

Alternative: infer the mode from numeric input. Rejected because issue titles may be numeric and adapter-neutral IDs may not always be. Browsing and incremental pagination are also rejected for MVP because explicit searches and bounded title results avoid loading large trackers.

### D3: Store references in a one-to-one table

`remote_issue_refs` stores `taskId` (unique), `userId`, `remoteSystemConfigId`, `remoteIssueId` as text, cached title, and timestamps. It does not store a URL. A usable URL is derived from the active configuration's normalized `baseUrl` and issue ID. The API accepts only issue ID and title; Task ownership and its Project → Client → active configuration relationship are derived server-side.

Alternative: nullable columns on `tasks`. Rejected because a separate table isolates integration lifecycle and makes merge transfer explicit. Storing URLs was rejected because they are derivable and become misleading after configuration updates.

### D4: Preserve references across configuration lifecycle

Updating a configuration keeps its identity and all references without remote validation. Soft-deleting it keeps the referenced row as provenance and cached data, but active-configuration reads, searches, and generated links are unavailable. A later replacement configuration does not silently claim old references; selecting an issue creates or replaces the Task reference with the active configuration.

Alternative: cascade-unlink on deletion or add an inactive-state workflow. Both were rejected to preserve history without MVP cleanup machinery.

### D5: Make merge handling atomic

Within the existing Task-edit transaction: no references requires no extra work; a sole reference moves to the survivor; identical references collapse to one; different references abort the complete merge with HTTP 409 and a translated error key. Comparison uses configuration provenance plus remote issue ID.

Alternative: always retain the survivor's link. Rejected because it silently discards meaningful data.

### D6: Use a reusable PrimeVue picker control

Each eligible Timer Task row renders a compact two-part control. When linked, the first part is a `#<remoteIssueId>` anchor whose URL is derived from the active configuration and whose tooltip exposes the cached title; when unlinked, it is non-interactive `(unlinked)` status text. The second part is a separately labeled pencil-icon `Button` that opens a small `Popover` containing a PrimeVue search form: a search-mode `Select`, an `InputText`, a submit `Button`, and a selectable results list below it. Search is explicit rather than autocomplete-driven, so remote requests occur only on form submission. The anchor/status and pencil action are siblings, never nested interactive controls. The complete control is omitted when the Task has no Project, no Client, or no active remote-system configuration. A configured Redmine system still exposes the status/reference portion but renders the pencil action disabled with an explanation.

Alternative: make the issue ID/status itself open the picker. Rejected because a linked ID must retain conventional direct-link behavior while editing remains an explicit, stable pencil action.

## Risks / Trade-offs

- [Remote CORS blocks direct requests] → Document the requirement and show a distinct translated connection error.
- [CSP blocks configured origins] → Extend `connect-src` only as broadly as required for user-configured HTTP(S) trackers and cover the resulting policy.
- [Search responses arrive out of order] → Cancel or ignore superseded requests using a request token/abort signal.
- [Cached titles become stale] → Treat titles as display-only and replace them on the next explicit selection; no background refresh.
- [Browser secret is exposed to XSS] → Keep the established local-storage MVP trade-off, never log or serialize the secret, and avoid placing it in server-bound state.
- [Soft-deleted configuration joins leak usability] → Return cached reference data but derive URL/search capability only from an active owned configuration.

## Migration Plan

Add the reference table and indexes in a forward migration, then deploy API and UI support. Rollback removes the new table and loses only newly created remote references; existing Tasks and remote configurations remain unchanged.

## Open Questions

None for the MVP proposal.