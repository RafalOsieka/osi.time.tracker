# Tasks

## 1. Default font stack (REQ-175)
- [x] 1.1 Rely on `@nuxt/fonts` auto-registered by `@nuxt/ui` only (no duplicate `modules` entry or direct dependency).
- [x] 1.2 Do not declare a custom `--font-sans` override; keep Nuxt UI / Tailwind defaults.
- [x] 1.3 Remove the manual `:root { font-family }` and `@supports` `InterVariable` blocks from `main.css`.
- [x] 1.4 Remove the `useHead` `link: [{ rel: 'stylesheet', href: 'https://rsms.me/inter/inter.css' }]` entry from `app/app.vue`.
- [x] 1.5 Verify in dev (light + dark) that typography uses framework defaults with no manual Inter load.

## 2. RemoteIssuePicker normalization (REQ-174)
- [x] 2.1 Define a zod schema (`mode`, `query`) in `shared/types` (or locally, matching existing form patterns) and bind it to a `UForm` replacing the raw `<form @submit.prevent="submit">`.
- [x] 2.2 Replace the native result-list `<button>` with `UButton variant="ghost"` (block, left-aligned), keeping the per-result `data-testid` and click-to-select behavior.
- [x] 2.3 Confirm submit button, mode radio, query input ids/`data-testid` and the `role="status"` results region are unchanged.

## 3. TimerAddEntryDialog normalization (REQ-174)
- [x] 3.1 Replace the raw `<form @submit.prevent="onSave">` with `UForm` bound to a zod schema (optional title; start/end `HH:mm` with a start-before-end refinement).
- [x] 3.2 Replace the native `<button>` in the `UInputMenu` `#item-label` slot with `UButton variant="ghost"` (or equivalent), preserving suggestion-select behavior.
- [x] 3.3 Preserve the `add-entry-range-error` `role="alert"` element, `aria-describedby`, all field ids, and the `add-entry-dialog` testid.

## 4. TimerBulkAssignDialog normalization (REQ-174)
- [x] 4.1 Replace the raw `<form @submit.prevent="onSave">` with `UForm` bound to a zod schema (required trimmed name; optional projectId).
- [x] 4.2 Replace the native `<button>` in the `UInputMenu` `#item-label` slot with `UButton variant="ghost"`, preserving suggestion-select behavior.
- [x] 4.3 Preserve the `bulk-assign-name-error` `role="alert"` element, `aria-invalid`/`aria-describedby`, field ids, and the `bulk-assign-dialog` testid.

## 5. Verification
- [x] 5.1 `pnpm lint` and `pnpm format:check` pass (including Vue i18n + a11y rules).
- [x] 5.2 `pnpm type-check` passes.
- [x] 5.3 `pnpm test:nuxt` and `pnpm test:e2e` pass (dialogs, remote-issue picker, timer view) with no `data-testid` changes.
- [x] 5.4 Manual smoke: add-entry, bulk-assign, and remote-issue-picker flows work in light and dark mode.
