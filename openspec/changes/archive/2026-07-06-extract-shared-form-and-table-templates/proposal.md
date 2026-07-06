## Why

The `clients`, `projects`, and `tasks` pages are ~90% structural clones (header, empty state, row actions, dialog form, error wiring, scoped CSS), and all four forms (including login) hand-roll validation state, `aria-*` wiring, and error rendering that PrimeVue Forms provides. Deduplicating now — before the tasks page grows timer features — keeps future work cheap and behavior consistent.

## What Changes

- Add `@primevue/forms`; migrate the client/project/task dialogs and the login form to `<Form>` with `zodResolver` driven by the existing shared zod schemas (`shared/types/*`), so client-side and server-side validation share one definition and messageKeys.
- Extract small template components: `TableHeader` (title + "New" button), `EmptyState` (message + CTA), `RowActions` (edit/delete buttons), a form-field wrapper (label + input slot + error `Message`), and a dialog footer (Cancel/Save). Pages keep full ownership of `DataTable`/`Column` markup, data fetching, and save/delete logic.
- Mount `<ConfirmDialog />` once in the default layout instead of per page.
- Add a shared `formatDate` util for `createdAt` cells.
- Standardize on `refresh()` after every mutation (clients currently patches the list in place after update/delete).
- Server-only field errors (e.g. duplicate name) remain page-local, merged into the field error display.
- All existing `data-testid` contracts are preserved via component props.

## Capabilities

### New Capabilities

- `shared-ui-components`: reusable table-template components (header, empty state, row actions), form-field wrapper and dialog footer, single app-level confirm dialog, and shared date formatting.

### Modified Capabilities

- `client-management`: client-side validation of the client form via the shared `createClientSchema` before any request is sent; list refreshes after update instead of in-place patching.
- `project-management`: client-side validation via `createProjectSchema` (replaces the manual pre-submit client check).
- `task-management`: client-side validation via `createTaskSchema` (adds name validation the page currently lacks).
- `authentication`: login form validates required credentials client-side via `loginSchema` before submitting.

## Non-goals

- No `DataTable` wrapper component and no generic CRUD composable — pages stay independently extensible (especially tasks).
- No changes to server endpoints, API contracts, or database schema.
- No visual redesign; PrimeVue theme tokens remain the styling source of truth.

## Impact

- `app/pages/{clients,projects,tasks,login}.vue`, `app/layouts/default.vue`, new `app/components/*` and `app/utils/formatDate.ts`.
- New dependency: `@primevue/forms`.
- Tests: `test/nuxt/*` and `test/e2e/*` suites must stay green unchanged (testids preserved); new unit/nuxt tests for extracted components.
