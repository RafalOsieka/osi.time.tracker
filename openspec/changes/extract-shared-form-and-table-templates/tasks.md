## 1. Setup & login form migration (frontend)

- [ ] 1.1 Add `@primevue/forms` dependency (`pnpm add @primevue/forms`) and verify `Form`/`FormField` auto-import via `@primevue/nuxt-module` (dev server boots, types resolve)
- [ ] 1.2 Migrate `app/pages/login.vue` to `<Form>` + `zodResolver(loginSchema)`: client-side required-credentials check with `errors.auth.credentialsRequired`, form-level server error via announced `Message`, keep `email`/`password`/`login-button`/`login-error` testids and `aria-invalid`/`aria-describedby` wiring (REQ-AUTH-007)
- [ ] 1.3 Verify login tests: run `pnpm test:nuxt` and `pnpm test:e2e` auth suites unchanged; add a nuxt test asserting empty-credential submit shows the error without a network request

## 2. Shared UI components & utilities (frontend)

- [ ] 2.1 Create `app/components/TableHeader.vue` (props: `title`, `newLabel`, `newTestid`; emits `create`) with the shared header CSS (REQ-NFR-030)
- [ ] 2.2 Create `app/components/EmptyState.vue` (props: `message`, `ctaLabel`, `testid`; emits `create`) with the shared empty-state CSS (REQ-NFR-030)
- [ ] 2.3 Create `app/components/RowActions.vue` (props: `editLabel`, `deleteLabel`, `editTestid`, `deleteTestid`; emits `edit`, `delete`) with `aria-label`s on both buttons (REQ-NFR-030)
- [ ] 2.4 Create the form-field wrapper component (props: `label`, `name`, `errorTestid`; input in default slot) rendering label + `Message` error with `role="alert"`, `aria-invalid`/`aria-describedby` wiring, and messageKey translation via `t()` (REQ-NFR-031)
- [ ] 2.5 Create `FormDialogFooter.vue` (Cancel/Save pair, `saving` prop, `cancel-button`/`save-button` testids)
- [ ] 2.6 Create `app/utils/formatDate.ts` (ISO string + locale → localized date; empty string for empty/unparsable input) (REQ-NFR-033)
- [ ] 2.7 Add unit tests for `formatDate` (locale-aware output, empty string, unparsable input)
- [ ] 2.8 Add nuxt component tests for `TableHeader`, `EmptyState`, `RowActions`, and the form-field wrapper (props render, testids present, events emitted, error association per REQ-NFR-031)
- [ ] 2.9 Mount a single `<ConfirmDialog />` in `app/layouts/default.vue` and add a nuxt test that a page delete action opens the layout-level dialog (REQ-NFR-032)

## 3. Clients page migration (frontend)

- [ ] 3.1 Migrate `app/pages/clients.vue`: use `TableHeader`/`EmptyState`/`RowActions`/`formatDate`, remove page-level `<ConfirmDialog>` and duplicated scoped CSS
- [ ] 3.2 Migrate the client dialog to `<Form>` + `zodResolver(createClientSchema)` with the form-field wrapper and `FormDialogFooter`; keep server-only errors (`error.clientNameDuplicate`) rendering inline (REQ-TTR-033)
- [ ] 3.3 Switch clients update/delete handlers to `refresh()` (replace in-place list patching)
- [ ] 3.4 Verify: `pnpm test:nuxt` clients suite unchanged; add nuxt test for client-side empty-name block (no request sent); run `pnpm test:e2e` clients flows

## 4. Projects page migration (frontend)

- [ ] 4.1 Migrate `app/pages/projects.vue`: shared components, `formatDate`, remove page-level `<ConfirmDialog>` and duplicated CSS
- [ ] 4.2 Migrate the project dialog to `<Form>` + `zodResolver(createProjectSchema)`; drop the manual pre-submit client check (schema supplies `error.projectClientRequired`); keep server-only duplicate errors inline (REQ-TTR-034)
- [ ] 4.3 Verify: `pnpm test:nuxt` projects suite unchanged; add nuxt tests for client-side empty-name and missing-client blocks; run `pnpm test:e2e` projects flows

## 5. Tasks page migration (frontend)

- [ ] 5.1 Migrate `app/pages/tasks.vue`: shared components, remove page-level `<ConfirmDialog>` and duplicated CSS
- [ ] 5.2 Migrate the task dialog to `<Form>` + `zodResolver(createTaskSchema)` with the form-field wrapper; project-less selection must pass validation (REQ-TTR-035)
- [ ] 5.3 Verify: `pnpm test:nuxt` tasks suite unchanged; add nuxt tests for client-side empty-name block and project-less submit; run `pnpm test:e2e` tasks flows

## 6. Final verification

- [ ] 6.1 Run full gates: `pnpm lint`, `pnpm format:check`, `pnpm type-check`, `pnpm test:unit`, `pnpm test:nuxt`, `pnpm test:e2e` — all green
- [ ] 6.2 Manual a11y pass on the four forms against REQ-NFR-017/031: errors announced (`role="alert"`), `aria-invalid` + `aria-describedby` associations, keyboard-only operation of dialogs and confirm dialog
