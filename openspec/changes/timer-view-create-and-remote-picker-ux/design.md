## Context

See proposal.md for motivation and the delta specs (REQ-180, REQ-103, REQ-104, REQ-107, REQ-237, REQ-266, REQ-210, REQ-093) for the behavior contract.

Today `buildTaskTitleMenuItems` **appends** the synthetic create row. `AppTimer` and `TimerAddEntryDialog` share that helper. Overlay-open Enter commits the highlighted item; `onEnter()` bails while the overlay is open.

`RemoteIssuePicker` defaults `mode` to `REMOTE_ISSUE_SEARCH_MODE_ORDER[0]` (`title`), focuses the radio group on open, concatenates `#id title` in results, and puts Unlink in the popover. `RemoteIssueSearchResult` is `{ remoteIssueId, title }`. Both provider parsers already receive a project display name (`_links.project.title` on OpenProject, `project.name` on Redmine) and discard it.

Linking persists through `POST /api/time-entries/reassign` + `resolveTaskId()`, which writes `remoteIssueCachedTitle` on insert. Existing linked rows have no remote project title.

## Goals / Non-Goals

**Goals:**
- Create-new-task is first in every shared title menu; first highlight follows it.
- Picker is search-first: ID default, query focused, unlink out of the popover.
- Optional remote project title flows search result → reassign body → task row → `remoteIssueRef` DTO.

**Non-Goals:**
- Design-level restatement of proposal non-goals (mode inference, confirm dialog, remote project catalog).
- Extra OpenProject/Redmine requests to resolve a missing project name.
- Showing remote project title as its own group-header control (tooltip + picker results only).

## Decisions

### 1. Prepend in the shared helper (option A)

| Option | Notes |
|--------|--------|
| **A. `unshift` / prepend the create row in `buildTaskTitleMenuItems`** | First item is highlighted; overlay Enter commits freeform. One change, both surfaces. | **chosen** |
| B. Prepend visually but highlight the first real suggestion | Needs combobox highlight control; fights Reka/UInputMenu |
| C. Switch to `UInputMenu` `create-item` | Typically renders last; we left that API because it was version-fragile |

Accepted trade-off: typing an existing name and hitting Enter creates an unbound title instead of binding the match. That is the product choice.

### 2. Default mode is a constant order change

Set `REMOTE_ISSUE_SEARCH_MODE_ORDER` to `['id', 'title']` and keep `state.mode = ORDER[0]`. ID is both default and first in the control. Alternative: keep visual Title | ID but default `id` — rejected; visual order would lie.

Placeholders follow the mode (issue number vs title, 3+ chars). Switching mode does not auto-search.

### 3. Focus the query input

`onOpenChange(true)` already `nextTick`s and focuses `firstField`. Point `firstField` at the query `UInput`, not the mode control. Do not persist last query/results across close unless they already happen to stay in component state; opening always focuses the input so the user can type immediately.

### 4. Search-first picker chrome

Replace the stacked labeled form with:

- Query `UInput` as the hero (autofocused; trailing search icon or compact submit).
- Compact segmented mode control under the input (`URadioGroup` horizontal or `UButtonGroup`); no “Search by / Search query” field chrome.
- Status: spinner while loading; empty/error only after a submit; no “No results found.” on first open.
- Results: two-line ghost rows — title, then muted `#id · remoteProjectTitle` when the title exists.
- No unlink button.

Alternative considered: command-palette “digits → ID, letters → title.” Rejected in the proposal; ID vs title stay explicit modes (different validation).

### 5. Unlink lives in the hover dropdown

```
[#4711]  →  Edit
            Unlink   ← instant, day-scoped, no confirm
```

Keep the unused `unlinkConfirmMessage` key (do not delete; do not wire). Sync-page picker stays unlinked-only, so it never shows the dropdown.

### 6. Optional title only, two boundary names

| Surface | Field |
|---------|--------|
| `RemoteIssueSearchResult` | `remoteProjectTitle?: string` |
| `RemoteIssueRefDto` / reassign body | `cachedRemoteProjectTitle?: string` |
| `tasks` column | `remoteIssueCachedProjectTitle` `text` nullable |

Omit the field (or persist `NULL`) when the string is missing/blank. Never persist ids, hrefs, or identifiers even if the payload has them. `cachedTitle` stays required on link; the project title does not.

`resolveTaskId` writes the new column on insert of a linked task, same as `remoteIssueCachedTitle`. Existing-task match is still by `remoteIssueId` only — do not update a found row’s cached titles (identity is the issue id; cache is write-once at create).

Parsers:

- OpenProject: `_links.project.title` when it is a non-empty string.
- Redmine: `project.name` when it is a non-empty string.

No extra HTTP. No `select`/`include` query change unless a spike shows the default payload omits the name (unlikely for either provider).

Alternative considered: persist remote project id for later catalog work. Rejected — proposal is title only.

### 7. Additive migration

`ALTER TABLE tasks ADD COLUMN "remoteIssueCachedProjectTitle" text;` Existing rows stay `NULL`. No uniqueness change. Rollback is drop-column.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Overlay Enter no longer binds the first matching suggestion | Accepted (option A); ArrowDown still reaches suggestions |
| Hover Unlink is one click closer than today | Instant by product choice; keep Edit first |
| Provider omits project title | Optional field; result and link still work |
| Cached project title goes stale if renamed remotely | Same as cached issue title; no refresh in this change |
| Reassign of an existing linked twin ignores a newer project title | Match is by issue id; cache is write-once. Accepted |

## Migration Plan

1. Generate and apply the nullable column migration.
2. Ship shared types + parsers + `resolveTaskId` + picker/menu in the same web deploy.
3. Old clients omit `cachedRemoteProjectTitle`; server stores `NULL`. New clients tolerate missing titles on old rows.
4. Rollback: revert the app, then drop the column if desired. No data rewrite.

## Open Questions

None.
