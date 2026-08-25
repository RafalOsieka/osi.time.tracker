# Coding Standards

This document defines the coding style and conventions used across the application (`app/`) and server (`server/`) source. It is derived from the existing codebase and should be followed by all contributions unless a rule is explicitly overridden by a reviewer. It complements — and never contradicts — the tooling configuration (Oxlint, leftover ESLint, Oxfmt, TypeScript).

## 1. General Code Style

- Write everything in **TypeScript**; use Vue 3 Single File Components with `<script setup lang="ts">`.
- Favor clarity over cleverness; keep functions small and single-purpose.
- Extract shared logic into composables (client) or utility modules (server/shared) rather than duplicating it.
- Remove unused variables, imports, and dead code paths.
- Explicit `any` is forbidden. When it is truly unavoidable, disable the rule on a single line with a trailing comment that justifies the exception:
  ```ts
  // oxlint-disable-next-line typescript/no-explicit-any -- reason goes here.
  ```
- Prefer named domain types over `unknown`. `catch (err)` is already `unknown` under TypeScript `strict` — omit `: unknown`. Narrow with `instanceof` on real classes (`FetchError`, `RemoteAdapterError`, `UpstreamHttpError`, `Error`), schema parse, or missing-field checks on named payloads. Do **not** add `isStringValue` / `isJsonObject` wrappers around `typeof` or `instanceof Object`. API error `params` use `MessageParams` (`string | number | boolean`), not `Record<string, unknown>`.
- Do not edit `tools/oxlint/anti-slop/` unless the developer explicitly asks. Remaining `as` assertions need `// SAFETY:` immediately above.

## 2. Naming Conventions

Use descriptive names; avoid abbreviations unless they are widely understood.

| Item                        | Convention             | Example                           |
| --------------------------- | ---------------------- | --------------------------------- |
| Variables / parameters      | `camelCase`            | `parsedBody`, `requestToken`      |
| Functions / methods         | `camelCase()`          | `formatDuration()`, `search()`    |
| Composables                 | `useXxx()`             | `useTrackerSecret()`              |
| Vue components (files/tags) | `PascalCase`           | `EntityPicker.vue`                |
| Types / interfaces          | `PascalCase`           | `EntityRef`                       |
| Response DTO types          | `PascalCase` + `Dto`   | `EntityDto`, `CreateEntityDto`    |
| Zod schemas                 | `camelCase` + `Schema` | `createEntitySchema`              |
| Module-level constants      | `UPPER_SNAKE_CASE`     | `ENTITY_NAME_MAX_LENGTH`          |
| Database columns            | `camelCase` (quoted)   | `userId`, `createdAt`             |
| Server route files          | `name.<method>.ts`     | `entity.post.ts`, `entity.get.ts` |
| Other source / test files   | `kebab-case`           | `setup-server.ts`, `auth.spec.ts` |

## 3. Formatting Rules

- **Indentation:** 2 spaces, never tabs.
- **Quotes:** single quotes for strings (`'title'`); template literals for interpolation.
- **Semicolons:** always terminate statements with a semicolon.
- **Trailing commas:** use them in multi-line arrays, objects, and parameter lists.
- **Line length:** keep lines reasonably short (~100 characters); wrap long argument lists and object literals across multiple lines.
- **Encoding:** UTF-8; end every file with a single trailing newline.
- Let Oxfmt own whitespace — run the format and lint commands before committing rather than hand-aligning code.

### Imports

- Group imports logically; place value imports and `import type { ... }` type-only imports separately, using `import type` for anything used only as a type.
- Keep import ordering consistent with the surrounding files.

## 4. Vue Component Conventions

- Order blocks as `<script setup>`, then `<template>`, then `<style scoped>`.
- Declare props and emits with typed generics (`defineProps<{ ... }>()`, `defineEmits<{ ... }>()`).
- Prefer existing Nuxt UI components (`UButton`, `UInput`, `UForm`/`UFormField`, `UTable`, `UModal`, `UDashboard*`, etc.) over native form controls. Reserve native elements for semantic structure or lightweight wrappers.
- Keep all user-facing text in the i18n catalogs and render it via `t(...)`; never hard-code display strings in templates or scripts.
- Provide accessibility affordances: `aria-label`, `role`, and `aria-live` where appropriate, and use stable `data-testid` hooks for testable elements.
- Hover/focus hints use Nuxt UI `UTooltip`, not the HTML `title` attribute (leave modal/page/confirm `title` props alone). Icon-only or status-only controls pair `aria-label` with a matching tooltip; do not add a tooltip that only repeats an already-visible label. Disabled explanations wrap a `tabindex="0"` host so the tooltip still opens. Truncated overflow uses `OverflowTooltip`.
- Prefer Tailwind utility classes and Nuxt UI `--ui-*` design tokens for layout/color. Icons use the Lucide set (`i-lucide-*`). Keep residual `<style scoped>` only when utilities are insufficient.
- Forms use `UForm` with a shared zod `:schema` and labelled `UFormField`s. Confirmations use `useAppConfirm()` (`useOverlay` + `ConfirmModal`), not per-page dialog instances.

### Reactive state

- Use `ref` / `shallowRef` / `computed` for reactive state; keep event handlers as named functions.
- **UForm-backed** dialogs and pages hold field state in a `reactive` object typed from the form schema input (`z.input<typeof schema>`) or a dedicated `*FormState` alias when the UI allows looser empties than the API DTO. Initialize without value-level casts (never `undefined as string | undefined`).
- **Non-UForm** editors (timer title, inline row edit, flags) use separate primitive refs/shallowRefs, not an untyped multi-field bag.
- Derived values use `computed` only.
- Task-keyed UI maps (activity selection, issue refs, selected entry ids, export comments, dismiss flags, outcomes, progress, and similar) stay as **parallel named map refs**, not one mega row-state object. Prefer documentation aliases such as `type TaskId = string` and `type ActivityByTask = Partial<Record<TaskId, string | null>>` (not branded nominal IDs). Prefer replace-the-map updates (`map.value = { ...map.value, [id]: value }`). Clear every related map through one reset path on scope/date change.

### Type assertions

Prefer, in order:

1. Annotating the reactive container or ref generic (`reactive<T>({...})`, `ref<T>(...)`).
2. `satisfies` for literal structures that must match a union.
3. `as const` for discriminant/literal narrowing (e.g. menu item `type` fields).
4. Runtime narrowing or type guards (`instanceof`, `'key' in value`, named `isX` guards).
5. Schema parse at submit/boundary (`FormSubmitEvent` / zod output).
6. A **single documented adapter** cast for third-party library or DOM gaps.

Rules:

- **`as unknown as` is forbidden** in `app/` components, pages, layouts, composables, and client utilities. Isolate unavoidable library friction in one adapter util that returns the real prop or DOM type — never cast in templates.
- Do not cast form fields or submit payloads (`clientId as string`) when container annotation or schema-typed `FormSubmitEvent` removes the need.
- Do not use `as Record<string, unknown>` for “I don’t know the prop type”; prefer the component’s prop type or a narrow adapter.
- Freeform task-title autocomplete (`UInputMenu` autocomplete mode) uses the shared builder in `app/utils/taskTitleMenu.ts`: object items with string model via `value-key` / `label-key` and `onSelect` closures over real `TaskDto` identity — never double-cast task DTOs to/from strings.

## 5. Server / API Conventions

- Export a single `defineEventHandler` per route file and annotate its return type with the response DTO.
- Protect private endpoints by resolving the authenticated user through the shared auth helper before any other work.
- Validate request bodies with a single `zod` schema; on `ZodError`, map the error to the `{ messageKey, params }` contract (`params` is `MessageParams`) and throw a `422` `createError`.
- The shared mapper keeps `min`, `max`, `expected`, and custom primitive `params` from the first issue. It does **not** emit `received` (zod 4 no longer carries a string `received` field, and no locale interpolates it).
- Never return rendered text from the server. Error and message payloads use a translation `messageKey` (plus optional `params`) that the client translates.
- Access the database exclusively through the shared lazy client; never instantiate raw drivers.
- Serialize boundary values in their JSON form — timestamps are emitted as ISO strings, not `Date` objects.

## 6. Boundary Types & Validation

- Define every shape crossing the client/server boundary exactly once in a shared types module, decoupled from the database schema.
- Co-locate the request `zod` schema, its inferred input type, and the response DTO type; derive input types with `z.infer<typeof schema>`.
- Express validation messages as translation keys (e.g. `error.entityNameRequired`) rather than human-readable sentences.
- Use zod 4's unified `error` option (a string key, or a function returning one) on schemas and checks. Do **not** use the removed `required_error` / `invalid_type_error` options or the deprecated `message` option.
- Prefer top-level format constructors for identifier and format fields: `z.uuid()` (RFC-strict — not `z.guid()`), `z.url()`, and `z.iso.datetime()`. Do not chain the deprecated `.uuid()` / `.url()` / `.datetime()` methods off `z.string()`.
- Keep shared limits and magic values as exported `UPPER_SNAKE_CASE` constants and reference them in both the schema and the code that enforces them.

## 7. Date/Time & Timezone Handling

- All timezone-sensitive date arithmetic (day keys, day/week boundaries, combining a wall-clock date and time into an instant) MUST use the `Temporal` API (`temporal-polyfill`), never browser-local `Date` getters (`getFullYear()`, `getDay()`, etc.) or server-local `Date` math.
- The effective timezone is the authenticated user's saved `timezone` setting (`useUserSettings().effective.timeZone` on the client, the `users.timezone` column on the server), falling back to the browser-detected timezone only when nothing is saved yet — never assume `UTC` or the host machine's timezone.
- Every human-readable date/time format call (`Intl.DateTimeFormat`, `Date#toLocaleDateString`/`toLocaleTimeString`, and any wrapper such as `formatDate`) MUST pass an explicit `timeZone` option derived from the effective setting. Omitting `timeZone` silently falls back to the runtime's local timezone and will render the wrong day/time for users whose saved timezone differs.
- Utilities that accept a `timeZone` parameter (e.g. `app/utils/dateTime.ts`, `app/utils/timerViewGrouping.ts`) may default it to the browser-detected timezone for convenience, but every call site with access to a signed-in user's settings MUST pass the effective timezone explicitly rather than relying on the default.
- UTC ISO 8601 instants remain the only on-the-wire representation; the server performs no timezone-aware rendering, only timezone-aware bucketing/boundary math when explicitly given the user's timezone (see `server/utils/day-boundary.ts`).
- Interop with browser-local `Date` objects (e.g. date inputs) is confined to the dedicated adapter pair (`toPickerDate`/`fromPickerDate` in `app/utils/dateTime.ts`); no other code should construct dates from browser-local getters.

## 8. Comments & Documentation

- Explain _why_, not _what_; document non-obvious design decisions and constraints.
- Use JSDoc (`/** ... */`) for public/exported functions and composables that carry meaningful behavior or caveats.
- Use single-line `//` comments for inline rationale.
- Keep comments in sync with the code they describe; delete stale comments.

## 9. Error Handling

- Catch with `catch (err)` (no `: unknown` — TypeScript `strict` already types the binding as `unknown`). Narrow with `instanceof` on real error classes or schema parse — not `typeof` ladders or `isX` wrappers around them. API `{ messageKey, params }` uses `MessageParams` (`string | number | boolean` values).
- Handle expected failure modes explicitly (validation, not-found, duplicates); avoid silent failures.
- Re-throw unexpected errors rather than swallowing them.
- Guard asynchronous flows against stale/superseded results where ordering matters.

## 10. Testing

- Add or update tests alongside any code change; keep the suite green.
- Fix bugs test-first: before changing the code, write a regression test that reproduces the defect and confirm it **fails**; after the fix, confirm it **passes**. Never weaken, skip, or delete that test to force a green run; leave it in place as a permanent regression guard. Trivial defects (typos, obvious single-line errors) may rely on a documented manual check instead.
- Name test files with the `*.spec.ts` convention under the matching test project directory.
- Prefer deterministic tests; seed any randomness.
- Assert against stable selectors (e.g. `data-testid`) rather than fragile markup.
- Anti-slop plugin tests live in `test/unit/anti-slop/` (`*.test.ts`, Oxlint `RuleTester`). Do not colocate those tests under `tools/oxlint/anti-slop/`.

## 11. Commits & Reviews

- One logical change per commit, with a short, clear summary line.
- Update tests and i18n catalogs in the same change as the code they support.
- Run linting, format checks, and the relevant test projects before opening a pull request.
- Keep pull requests focused and reasonably small; be constructive in review.

## 12. Anti-slop plugin is frozen unless requested

The vendored Oxlint anti-slop plugin under `tools/oxlint/anti-slop/` (plugin entry, rules, and shared helpers) SHALL NOT be edited, rewritten, disabled, or “fixed” by coding agents unless the developer explicitly asks for that change. Diagnosing application code that fails `anti-slop/*` is allowed; changing the plugin to silence those diagnostics is not. Tests for the plugin belong in `test/unit/anti-slop/` only.

## 13. Changes to This Guide

Conventions evolve. Propose improvements by opening an issue or a pull request that updates this document, and align the change with the project's tooling configuration.
