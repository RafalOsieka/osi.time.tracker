## Context

`app/pages/clients.vue` (288 lines), `projects.vue` (376), and `tasks.vue` (369) are structural clones: identical DataTable `#header` (title + "New" button), `#empty` (message + CTA), trailing actions column, CRUD `Dialog` with a raw `<form>`, per-field error refs with manual `aria-invalid`/`aria-describedby`/`<small role="alert">` wiring, per-page `<ConfirmDialog>`, and 7 identical scoped-CSS rules. `login.vue` repeats the same hand-rolled form pattern. Meanwhile `shared/types/{client,project,task,auth}.ts` already export zod schemas whose messages are i18n messageKeys — used server-side only today.

Constraints:

- The tasks page will grow (timer features), so abstractions must not constrain per-page divergence.
- `test/nuxt/*` and `test/e2e/*` suites select by `data-testid` (`client-name-input`, `save-button`, `empty-state-cta`, `*-name-error`, `login-error`, …) and are the refactoring safety net — they must pass unchanged.
- WCAG 2.1 AA (`openspec/specs/accessibility/spec.md`): errors must stay programmatically associated and announced.

## Goals / Non-Goals

**Goals:**

- Remove template/CSS duplication with small, dumb, independently-adoptable components.
- One validation definition per entity: shared zod schemas drive both client-side (PrimeVue Forms resolver) and server-side validation, with messageKeys translated at render time.
- Consistent post-mutation behavior: `refresh()` everywhere.
- Preserve every existing `data-testid` and accessibility contract.

**Non-Goals:**

- No `DataTable` wrapper, no `useCrudResource`-style CRUD composable (rejected: would make page-specific extension harder, especially for tasks).
- No server/API/schema changes; no visual redesign.

## Decisions

### D1: Small template components, not a table wrapper

Extract `TableHeader`, `EmptyState`, and `RowActions` as leaf components slotted into each page's own `DataTable` templates. Pages keep all `DataTable`/`Column` markup.

- Alternative considered: an `EntityTable` wrapper owning columns/slots — saves more lines but adds an abstraction layer over a highly configurable component and would fight future tasks-page divergence. Rejected.
- All labels and `data-testid` values are caller-supplied props; components own only layout markup and the shared scoped CSS.

### D2: `@primevue/forms` + `zodResolver` over shared schemas

Install `@primevue/forms` (auto-imported via `@primevue/nuxt-module` once present). Each form becomes `<Form :resolver="zodResolver(schema)" :initialValues @submit>`; fields bind by `name`; errors render via `<Message severity="error" size="small" variant="simple">` with the schema's messageKey translated by `t()`.

- Alternative considered: keep manual refs and only extract an error-display component — leaves 4× duplicated validation plumbing and drifting behavior. Rejected.
- A thin `FormFieldWrap` component (props `label`, `name`, `errorTestid`; input in default slot) replaces the repeated label/aria/error block. `Message` keeps `role="alert"` semantics; carry the error `data-testid` on it.
- Schema notes: `createProjectSchema.clientId` (`.uuid`, key `error.projectClientRequired`) replaces projects' manual pre-submit check with the same key; `createTaskSchema.projectId` is `.nullish()` so the clearable Select passes; `loginSchema` catches empty credentials client-side with the same `errors.auth.credentialsRequired` key the server returns.

### D3: Server-only field errors stay page-local

Errors only the server can produce (e.g. `error.clientNameDuplicate`) are kept in a small per-page reactive map and displayed under the field (merged into the same `Message` slot). PrimeVue Forms has no `setFieldError` API.

- Alternative considered: a custom resolver wrapper merging server errors into validation — more magic for no test-visible benefit; can be revisited later. Rejected for now.

### D4: `refresh()` after every mutation

All create/update/delete handlers call the page's `useAsyncData` `refresh()`. `clients.vue` currently patches the list in place after PATCH/DELETE; this is replaced for consistency and simplicity (user decision).

- Alternative considered: in-place patching everywhere — fewer requests but three hand-rolled cache-sync paths to keep correct. Rejected.

### D5: Single `<ConfirmDialog />` in the default layout

Mounted once in `app/layouts/default.vue`; pages keep their own `confirm.require(...)` calls (per-page copy, icon, danger accept class unchanged). Optional `useDeleteConfirm` sugar is out of scope.

### D6: `formatDate` utility

`app/utils/formatDate.ts` wraps `new Date(iso).toLocaleDateString(locale)`; pages pass the active i18n locale so date rendering follows the selected language instead of the browser default.

## Risks / Trade-offs

- [`Form` submit passes `event.values`, changing `onSave` signatures] → nuxt/e2e specs interact via testid'd inputs and the save button, which are preserved; verify each suite after migrating each page.
- [`Message` replaces `<small role="alert">`; alert semantics could regress] → keep `data-testid` on the `Message`, verify `role`/`aria-describedby` wiring against REQ-NFR-017 in nuxt tests.
- [Client-side validation now blocks previously server-validated submits (e.g. empty task name)] → same messageKeys render in the same place; e2e tests asserting server-roundtrip errors on duplicates still exercise the server path.
- [`refresh()` on clients changes update flow timing] → nuxt specs await the refreshed list; behavior matches projects/tasks which already do this.
- [New dependency `@primevue/forms`] → first-party PrimeVue package, same major version line as `primevue@4.x`.

## Migration Plan

1. Add `@primevue/forms`; migrate `login.vue` first (smallest form, proves resolver + Message pattern).
2. Extract shared components + `formatDate`; mount `ConfirmDialog` in the layout; strip per-page copies.
3. Migrate clients → projects → tasks dialogs to `Form` + shared schemas; switch clients to `refresh()`.
4. Run `pnpm lint`, `pnpm test:unit`, `pnpm test:nuxt`, `pnpm test:e2e` after each page migration; rollback is per-page (each page migrates independently).

## Open Questions

- None blocking. (Deferred: custom resolver wrapper for server errors; `useDeleteConfirm` helper; DataTable pagination.)
