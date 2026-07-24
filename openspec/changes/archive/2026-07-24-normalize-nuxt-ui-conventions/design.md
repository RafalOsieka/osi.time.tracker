## Context

A Nuxt UI compliance review (explore session) rated the app "highly compliant": `UApp` wrapper, semantic colors only, `i-lucide-*` icons, idiomatic overrides, and — contrary to an earlier note — `useOverlay` (via `useAppConfirm`) and `useToast` (via `useAppToast`) are already in use. Three localized deviations remain:

1. `RemoteIssuePicker.vue` renders its result list with a native `<button>` (line ~129) and its search controls in a raw `<form @submit.prevent>` (line ~88).
2. `TimerAddEntryDialog.vue` and `TimerBulkAssignDialog.vue` wrap their `UModal` bodies in a raw `<form @submit.prevent>` and put a native `<button>` inside the `UInputMenu` `#item-label` slot.
3. Fonts are loaded manually: `app.vue` injects `<link rel="stylesheet" href="https://rsms.me/inter/inter.css">` via `useHead`, and `main.css` hard-codes `:root { font-family: Inter, ... }`.

Constraints: the app asserts against stable `data-testid` selectors and has strict a11y wiring (associated `<label>`s, `role="alert"`, `aria-describedby`, `aria-invalid`); none of these may regress. i18n `en`/`pl` catalogs already contain every label used, so no catalog changes are expected.

## Goals / Non-Goals

**Goals:**
- Bring the three dialogs in line with the app's own `UForm` + zod pattern (already used by client/project/login/settings pages).
- Replace native `<button>` result/suggestion items with `UButton`.
- Drop manual Inter loading and use Nuxt UI / Tailwind default fonts (no custom `--font-sans`).
- Keep every `data-testid`, field `id`, label association, and error-announcement behavior byte-for-byte.

**Non-Goals:**
- No changes to `useAppConfirm`/`useAppToast`/`ConfirmModal` (already idiomatic).
- No API, database, schema, or i18n-catalog changes.
- No visual redesign beyond dropping the custom Inter webfont for framework defaults.
- No new dialogs or features.

## Decisions

- **`UForm` + zod over native `<form>`.** Each dialog gets a small zod schema (add-entry: title optional + start/end `HH:mm` with a start<end refinement; bulk-assign: required trimmed name + optional projectId; remote-issue-picker: mode + query). `UForm`'s `@submit` replaces `@submit.prevent="onSave"`. Cross-field errors (start/end range) map to a `UForm` error or a preserved `role="alert"` paragraph keyed by the same id. *Alternative considered:* keep native `<form>` and only swap buttons — rejected because it leaves the app's most-used form pattern split across two idioms and doesn't satisfy the skill's forms guidance.
- **`UButton variant="ghost"` for interactive items.** The result row and suggestion labels become `UButton` with `block`/full-width + left-aligned classes to keep current layout; existing `hover:bg-elevated` behavior is provided by the ghost variant. *Alternative:* `UCommandPalette` for the result list — rejected as over-engineering for this MVP picker.
- **Default fonts; no custom Inter.** Remove the `useHead` Inter `<link>`, the long legacy vendor stack, and any project `--font-sans` override so typography uses Nuxt UI / Tailwind defaults. Keep `@nuxt/fonts` only as auto-registered by `@nuxt/ui` (never re-listed in `modules`). *Alternative:* pin Public Sans via `--font-sans` — deferred; user prefers framework defaults until a brand typeface is chosen.

## Risks / Trade-offs

- **[UForm changes error/submit timing, breaking a test]** → Convert one dialog at a time and run the relevant `nuxt`/`e2e` specs after each; preserve the existing error element ids/roles so assertions still match.
- **[`UButton` markup differs enough to break a `data-testid` query or layout]** → Put the `data-testid` on the `UButton` itself and reuse the existing utility classes; verify visual parity in dev.
- **[Dropping Inter changes metrics slightly]** → Acceptable; defaults avoid third-party font requests and custom tokens until branding needs one.

## Migration Plan

1. Remove manual Inter loading and any custom `--font-sans`; keep auto-registered `@nuxt/fonts` only; leave framework default typography.
2. Convert `RemoteIssuePicker.vue`: `UForm` + `UButton` result rows.
3. Convert `TimerAddEntryDialog.vue` and `TimerBulkAssignDialog.vue`: `UForm` + `UButton` suggestion labels.
4. Run `pnpm lint`, `pnpm type-check`, and the `nuxt`/`e2e` test projects; fix regressions.

Rollback is per-file (revert the component) since each step is independent.

## Open Questions

- Should the start<end range error stay a manual `role="alert"` paragraph or move fully into `UForm` field errors? (Prefer keeping the existing announced element to avoid a11y/test churn.)
  Resolved: no custom Inter; framework default fonts; `@nuxt/fonts` stays auto-registered only.
