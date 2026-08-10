## Why

Vue components and pages still rely on type assertions (`as`, especially `as unknown as`) and anonymous `Record<string, …>` bags that hide structure, even though the shared boundary layer is already solid. Freezing the explore outcomes now locks in house rules and targeted cleanups so form state, autocomplete menus, and sync UI maps stop lying to TypeScript.

## What Changes

- Adopt a Vue/client type-assertion ladder: annotate containers, prefer `satisfies` / `as const` / guards / schema parse, contain library friction in single adapters, and forbid `as unknown as` in `app/` components and templates.
- Standardize form and UI state: UForm uses `reactive` typed from schema input (or a dedicated form-state type); non-form editors use primitive `ref`/`shallowRef`; task-keyed maps stay as multiple named map refs (not one mega row-object), with replace-the-map updates.
- Port the proven `AppTimer` task-title menu adapter into add/bulk entry dialogs (and a shared helper) so freeform title autocomplete no longer double-casts `TaskDto` ↔ `string`.
- Tighten sync-page and related map types with named aliases (`TaskId` as a documentation alias only — not branded IDs); isolate expand-all / Nuxt UI prop friction in small helpers.
- Document the ladder and state conventions in `CODING_STANDARDS.md` (and keep i18n/tests green where behavior is touched only by typing/refactors).

## Non-goals

- Branded ID types (`ClientId`, `ProjectId`, etc.) — deferred.
- Changing API contracts, zod boundary schemas, or response DTO validation policy.
- Rewriting sync orchestration into a single `TaskUiState` mega-object.
- Broad ref→shallowRef migration across the whole app.
- New product features or UI redesign beyond typing-safe adapters.

## Capabilities

### New Capabilities

- `vue-component-typing`: Client/Vue typing discipline for assertions, form state, keyed UI maps, and autocomplete item adapters (no double-cast lies).

### Modified Capabilities

- (none — boundary `type-safety` requirements stay as-is; this change is Vue/app-side only.)

## Impact

- **Code:** `app/components/TimerAddEntryDialog.vue`, `TimerBulkAssignDialog.vue`, `AppTimer.vue` (reference), sync page/composables (`pages/sync/[date].vue`, `useSyncExport`), form pages (`projects`, `settings`, `login`, `RemoteIssuePicker`), layouts/utils with library casts, optional new composable/util for task-title menu items.
- **Docs:** `CODING_STANDARDS.md` type-assertion and state conventions.
- **Tests:** existing unit/nuxt coverage for affected dialogs/pages; no API contract tests expected.
- **APIs / deps:** none.
