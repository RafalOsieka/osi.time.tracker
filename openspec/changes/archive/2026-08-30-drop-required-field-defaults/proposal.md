## Why

`requiredFieldDefaults` was specified so Trackers could pre-fill Remote Sync required fields (e.g. OpenProject activity). The Trackers UI never collected it, so real users never stored defaults; PATCH already treated an omitted map as `{}` and would wipe any API-seeded values. The field is unused product surface and a footgun — remove it.

A CodeQL `js/clear-text-storage-of-sensitive-data` finding on `useTrackerSecret` is accepted for now: client-side encryption does not change the XSS threat, and encrypted server-side credentials remain WBS 5.4 (post-MVP).

## What Changes

- **BREAKING:** Remove `requiredFieldDefaults` from the tracker schema, boundary types, create/update bodies, tracker DTOs, and the Remote Sync day config surface.
- Drop tracker-level defaults as a product concept (REQ-250). Remote Sync activity pre-fill keeps last-exported activity only; otherwise the control stays unselected.
- Add a short comment on `useTrackerSecret` documenting why the API secret stays plaintext in `localStorage` (same-origin JS can always use it; CSP is the XSS control; encryption-at-rest is not in scope).
- Align `docs/vision.md`, `docs/wbs.md`, and `docs/user-stories.md` so Trackers no longer mention required-field defaults.

## Capabilities

### New Capabilities

### Modified Capabilities

- `tracker-management`: Remove required-field defaults from tracker connection fields, create/update, and list DTOs (retire REQ-250). Browser-only secret storage is unchanged.
- `remote-sync-review`: Stop pre-filling activities from a tracker default (REQ-114); drop required-field defaults from the day-review config surface (REQ-115).

## Impact

- DB: drop `trackers.requiredFieldDefaults` (new Drizzle migration; committed SQL history stays).
- API: `POST`/`PATCH`/`GET /api/trackers`, `GET /api/sync/day`.
- Shared types (`tracker`, `remote-sync-day`), sync page fallback, tests that seed `{ activity: '1' }` as a tracker default.
- No new dependencies. Secret storage API (`get`/`set`/`clear`, `rsc:` keys) unchanged.

## Non-goals

- Encrypting or relocating the browser-held API secret (IndexedDB, Web Crypto, vault password, session-only).
- Encrypted server-side credential storage (WBS 5.4).
- A Trackers-UI control for remote-field defaults, now or later in this change.
- Changing activity fetch, last-export precedence, or export payload `requiredFieldValues`.
- Changing execution mode, rounding, or tracker identity-on-edit behavior.
