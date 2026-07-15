# Coding Standards

This document defines the coding style and conventions used across the application (`app/`) and server (`server/`) source. It is derived from the existing codebase and should be followed by all contributions unless a rule is explicitly overridden by a reviewer. It complements — and never contradicts — the tooling configuration (ESLint, Prettier, TypeScript).

## 1. General Code Style

- Write everything in **TypeScript**; use Vue 3 Single File Components with `<script setup lang="ts">`.
- Favor clarity over cleverness; keep functions small and single-purpose.
- Extract shared logic into composables (client) or utility modules (server/shared) rather than duplicating it.
- Remove unused variables, imports, and dead code paths.
- Explicit `any` is forbidden. When it is truly unavoidable, disable the rule on a single line with a trailing comment that justifies the exception:
  ```ts
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- reason goes here.
  ```
- Prefer `unknown` over `any` for values whose shape is not yet narrowed (e.g. caught errors are typed `err: unknown` and narrowed before use).

## 2. Naming Conventions

Use descriptive names; avoid abbreviations unless they are widely understood.

| Item                        | Convention             | Example                           |
| --------------------------- | ---------------------- | --------------------------------- |
| Variables / parameters      | `camelCase`            | `parsedBody`, `requestToken`      |
| Functions / methods         | `camelCase()`          | `formatDuration()`, `search()`    |
| Composables                 | `useXxx()`             | `useRemoteConfig()`               |
| Vue components (files/tags) | `PascalCase`           | `EntityPicker.vue`                |
| Types / interfaces          | `PascalCase`           | `EntityRef`                       |
| Response DTO types          | `PascalCase` + `Dto`   | `EntityDto`, `CreateEntityDto`    |
| Zod schemas                 | `camelCase` + `Schema` | `createEntitySchema`              |
| Module-level constants      | `UPPER_SNAKE_CASE`     | `ENTITY_NAME_MAX_LENGTH`          |
| Database columns            | `camelCase` (quoted)   | `userId`, `createdAt`             |
| Server route files          | `name.<method>.ts`     | `entity.post.ts`, `entity.get.ts` |

## 3. Formatting Rules

- **Indentation:** 2 spaces, never tabs.
- **Quotes:** single quotes for strings (`'title'`); template literals for interpolation.
- **Semicolons:** always terminate statements with a semicolon.
- **Trailing commas:** use them in multi-line arrays, objects, and parameter lists.
- **Line length:** keep lines reasonably short (~100 characters); wrap long argument lists and object literals across multiple lines.
- **Encoding:** UTF-8; end every file with a single trailing newline.
- Let the formatter own whitespace — run the format and lint commands before committing rather than hand-aligning code.

### Imports

- Group imports logically; place value imports and `import type { ... }` type-only imports separately, using `import type` for anything used only as a type.
- Keep import ordering consistent with the surrounding files.

## 4. Vue Component Conventions

- Order blocks as `<script setup>`, then `<template>`, then `<style scoped>`.
- Declare props and emits with typed generics (`defineProps<{ ... }>()`, `defineEmits<{ ... }>()`).
- Use `ref`/`computed` for reactive state; keep event handlers as named functions.
- Prefer existing PrimeVue components (form fields, buttons, inputs, overlays) over native `<input>`, `<select>`, `<button>`, and `<form>` elements. Reserve native elements for semantic structure or lightweight wrappers.
- Keep all user-facing text in the i18n catalogs and render it via `t(...)`; never hard-code display strings in templates or scripts.
- Provide accessibility affordances: `aria-label`, `role`, and `aria-live` where appropriate, and use stable `data-testid` hooks for testable elements.
- Scope component styles with `<style scoped>` and use BEM-style class names (`block__element`). Prefer theme tokens (CSS custom properties) over hard-coded colors.

## 5. Server / API Conventions

- Export a single `defineEventHandler` per route file and annotate its return type with the response DTO.
- Protect private endpoints by resolving the authenticated user through the shared auth helper before any other work.
- Validate request bodies with a single `zod` schema; on `ZodError`, map the error to the `{ messageKey, params }` contract and throw a `422` `createError`.
- Never return rendered text from the server. Error and message payloads use a translation `messageKey` (plus optional `params`) that the client translates.
- Access the database exclusively through the shared lazy client; never instantiate raw drivers.
- Serialize boundary values in their JSON form — timestamps are emitted as ISO strings, not `Date` objects.

## 6. Boundary Types & Validation

- Define every shape crossing the client/server boundary exactly once in a shared types module, decoupled from the database schema.
- Co-locate the request `zod` schema, its inferred input type, and the response DTO type; derive input types with `z.infer<typeof schema>`.
- Express validation messages as translation keys (e.g. `error.entityNameRequired`) rather than human-readable sentences.
- Keep shared limits and magic values as exported `UPPER_SNAKE_CASE` constants and reference them in both the schema and the code that enforces them.

## 7. Comments & Documentation

- Explain _why_, not _what_; document non-obvious design decisions and constraints.
- Use JSDoc (`/** ... */`) for public/exported functions and composables that carry meaningful behavior or caveats.
- Use single-line `//` comments for inline rationale.
- Keep comments in sync with the code they describe; delete stale comments.

## 8. Error Handling

- Type caught errors as `unknown` and narrow them before use.
- Handle expected failure modes explicitly (validation, not-found, duplicates); avoid silent failures.
- Re-throw unexpected errors rather than swallowing them.
- Guard asynchronous flows against stale/superseded results where ordering matters.

## 9. Testing

- Add or update tests alongside any code change; keep the suite green.
- Name test files with the `*.spec.ts` convention under the matching test project directory.
- Prefer deterministic tests; seed any randomness.
- Assert against stable selectors (e.g. `data-testid`) rather than fragile markup.

## 10. Commits & Reviews

- One logical change per commit, with a short, clear summary line.
- Update tests and i18n catalogs in the same change as the code they support.
- Run linting, format checks, and the relevant test projects before opening a pull request.
- Keep pull requests focused and reasonably small; be constructive in review.

## 11. Changes to This Guide

Conventions evolve. Propose improvements by opening an issue or a pull request that updates this document, and align the change with the project's tooling configuration.
