## Context

See proposal.md for why. Trackers persist `requiredFieldDefaults` jsonb (default `{}`) on every row. Create/update schemas accept an optional map; handlers write `parsedBody.requiredFieldDefaults ?? {}`. The Trackers form never sends the field, so a UI edit already cleared any API-seeded map. Remote Sync reads `row.config.requiredFieldDefaults.activity` after last-export provenance. The browser API secret stays in `localStorage` via `useTrackerSecret` (`rsc:<trackerId>`).

## Goals / Non-Goals

**Goals:**

- Delete the field from schema, boundary types, APIs, and the sync-day config surface in one migration.
- Keep last-export activity pre-fill; leave the control unselected when that is missing.
- Document why the tracker secret remains plaintext in `localStorage`.
- Align vision / WBS / user-stories language with the specs.

**Non-Goals:**

- Changing secret storage mechanics, key prefix, or persistence across reload.
- Auto-selecting the first fetched activity when provenance is empty.
- Reconstructing or exporting any stored defaults before the column drop.

## Decisions

### D1: Drop the column; do not leave a dead jsonb field

Generate a Drizzle migration that `DROP COLUMN` `requiredFieldDefaults`. Historical SQL that added the column stays. Any values in existing DBs (empty `{}` in practice) are discarded.

*Alternative:* Leave the column unused. Rejected — the type, DTO, and handlers would still have to ignore it, and the PATCH-wipe footgun would remain.

### D2: Omit the field from zod; strip unknown keys (do not `strict()`)

`createTrackerSchema` / `updateTrackerSchema` and `RemoteSyncConfigSurfaceDto` lose `requiredFieldDefaults`. Default zod object parsing strips unknown keys, so a leftover client that still POSTs the map succeeds and stores nothing. Do not switch tracker bodies to `strict()` in this change.

*Alternative:* Reject the unknown field with 422. Rejected — it turns a cleanup into a harder break for any scripted client still sending the old body.

### D3: Activity pre-fill is last export only

Sync-page `selectedActivity` keeps explicit page state, then `row.exports[0].requiredFieldValues.activity` when it is still in the fetched options. Delete the tracker-default branch. If neither matches, the select stays empty; the user must pick an activity to export.

Tests that seed `{ activity: '1' }` on the tracker MUST instead seed prior-export provenance or select the activity in the UI.

*Alternative:* Pre-select the first fetched option. Rejected — that would silently export under an activity the user never chose.

### D4: Secret stays in `localStorage`; comment only

Keep `useTrackerSecret` on `localStorage` with the `rsc:` prefix. Add a brief comment that plaintext storage is accepted: same-origin JS can always use the token, CSP is the XSS control, client-side encryption would not change that, and encrypted server-side credentials remain WBS 5.4. Do not add a CodeQL suppression unless the comment alone is insufficient for the scan.

*Alternative:* AES-GCM + IndexedDB, or session-only secrets. Rejected — see proposal Non-goals; XSS surface unchanged, UX and test cost not justified.

### D5: Product docs in the same change

Update `docs/vision.md`, `docs/wbs.md`, and `docs/user-stories.md` in the implementation so they no longer list required-field defaults as a Tracker field. Spec Purpose for `tracker-management` already drops that phrase.

## Risks / Trade-offs

- **[API-seeded defaults are dropped]** → Accepted. No UI ever wrote them; last-export activity still pre-fills.
- **[Old clients still send the field]** → Stripped by zod (D2); no 422, no persistence.
- **[CodeQL finding remains on `localStorage.setItem`]** → Accepted. Comment documents the threat model; do not encrypt for the scanner.
- **[Tests that relied on tracker defaults fail]** → Rewire to provenance or an explicit activity selection (D3).

## Migration Plan

1. Schema + types + handlers + sync page + docs + secret comment.
2. `pnpm db:generate` then commit the SQL; apply with `pnpm db:migrate`.
3. Update unit / nuxt / e2e fixtures that pass `requiredFieldDefaults`.
4. Rollback: restore the jsonb column with default `{}` (values already discarded).
