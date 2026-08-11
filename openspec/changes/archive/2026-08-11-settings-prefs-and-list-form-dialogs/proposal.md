## Why

Projects and trackers pages pack list, form state, and CRUD into oversized page SFCs, while form controls are inconsistently full-width. Language and theme live only in the top utility menu, separate from the settings page users already use for preferences. This change thins list pages, unifies form layout, and makes Settings the single preference hub with immediate apply.

## What Changes

- Extract **smart** create/edit dialogs (`ProjectFormDialog`, `TrackerFormDialog`) so `/projects` and `/trackers` own list/delete only and orchestrate open/refresh.
- Apply a **full-width form control** convention in those dialogs and on `/settings` (inputs/selects always `w-full`; consistent dialog width).
- Move **language** and **theme** from `AppUtilityMenu` onto `/settings`; leave the utility menu with **logout only**.
- Settings becomes **auto-apply / no Save button**: locale and theme update cookies immediately; timezone and week-start PATCH the existing partial `/api/user/settings` on each change (latest write wins). Failures toast only; success is silent. Repurpose existing save/saved i18n keys for error/saving feedback as needed.
- Update shell, settings, theming, and i18n specs/tests to match the new control placement and apply model.

## Non-goals

- Extracting `ProjectsTable` / `TrackersTable` (dialog-first only; tables stay on pages).
- Refactoring timer (`index`) or sync pages (later changes).
- Theme/locale controls on the auth/login layout.
- Server-persisted locale or theme (cookies remain).
- New settings endpoints or per-field routes (reuse partial `PATCH`).
- Changing project/tracker create-edit-delete business rules beyond UI structure and form layout.

## Capabilities

### New Capabilities

- (none)

### Modified Capabilities

- `frontend-shell`: Utility menu exposes logout only; locale/theme leave the top bar cluster.
- `user-settings`: Settings page hosts language and theme; all preferences auto-apply on change (no Save); account fields use existing partial PATCH.
- `ui-theming`: Authenticated theme control lives on Settings (cookie light/dark/system unchanged).
- `internationalization`: Authenticated locale picker lives on Settings (cookie persistence unchanged).
- `shared-ui-components`: Form controls in overlay dialogs and settings use full width for consistent layout.

## Impact

- **Frontend:** `app/pages/projects.vue`, `trackers.vue`, `settings.vue`; new dialog components; `AppUtilityMenu.vue`; i18n `en`/`pl` keys.
- **Backend:** No API contract change expected (`PATCH /api/user/settings` already partial).
- **Tests:** shell, settings UI, projects/trackers nuxt/e2e as hooks move; utility-menu assertions slim down.
- **Specs:** deltas for the five modified capabilities above.
