## Context

See `proposal.md` for motivation. Boundary typing (`shared/types`, zod, `type-safety`) is already in good shape. Friction is concentrated in `app/`:

- `TimerAddEntryDialog.vue` / `TimerBulkAssignDialog.vue` double-cast `TaskDto` ↔ `string` for `UInputMenu` autocomplete.
- `AppTimer.vue` already uses the correct pattern: object items + string model via value/label keys + `onSelect` closing over `TaskDto`.
- Form pages cast optional/union fields at the value (`projects.vue` `clientId`, `settings.vue` week start, `RemoteIssuePicker` mode, bulk-assign `projectId`).
- Sync day UI keeps several parallel `Record<string, …>` maps (acceptable shape) but with anonymous key types and occasional expand-model casts.
- `CODING_STANDARDS.md` §4 covers Vue structure and `ref`/`computed` but not assertion policy or form-state typing.

Constraints: Nuxt UI `UForm` needs a mutable plain object as `:state`; autocomplete stringifies object models to `"[object Object]"` unless the model is a string and items carry string value keys. No branded IDs in this change.

## Goals / Non-Goals

**Goals:**

- One shared task-title menu adapter reused by timer + dialogs.
- Remove all `as unknown as` from `app/` (or confine any unavoidable remainder to a named adapter module with a one-line justification).
- Annotate UForm `reactive` state from schema/`*FormState`; drop value casts on submit and union literals.
- Name sync map aliases; keep N maps; central reset unchanged in spirit.
- Encode the ladder and state rules in `CODING_STANDARDS.md` §4 (and cross-link §1/`unknown` if needed).

**Non-Goals:**

- Branded nominal IDs; mega `TaskUiState` object; app-wide `shallowRef` rewrite.
- Changing zod schemas or API DTOs unless a form-state alias is purely client-side.
- ESLint rule banning `as` (documentation + review + targeted cleanup; optional lint later).

## Decisions

### D1 — Shared task-title menu helper (port AppTimer)

**Choice:** Extract a small composable or pure builder (e.g. `useTaskTitleMenu` / `buildTaskTitleMenuItems`) that maps `TaskDto[]` + typed query string → items `{ id, name, label, onSelect }`, optional synthetic “create” row, and string `v-model` wiring guidance (`value-key` / `label-key` as in AppTimer).

**Why:** AppTimer is the validated reference; dialogs diverged into double-casts. One helper prevents regression.

**Alternatives considered:**

- Per-component copy of AppTimer logic — works but reintroduces drift.
- Cast-only “adapter” that still uses `as unknown as` internally — fails REQ-238 spirit.
- Spike different Nuxt UI modes — unnecessary; in-repo pattern already works.

### D2 — Assertion ladder in standards, cleanup by severity

**Choice:** Document ladder (annotate → `satisfies` → `as const` → guard → schema → single adapter). Cleanup order: (1) double-casts in dialogs, (2) form/union value casts, (3) named sync aliases + expand helper, (4) layout/DOM library friction adapters.

**Why:** Matches explore freeze and minimizes churn while killing the worst lies first.

**Alternatives considered:**

- Ban all `as` via lint immediately — high noise from Nuxt UI/DOM until adapters exist.
- Docs-only change — leaves production double-casts in place.

### D3 — Form state: `reactive<z.input<typeof schema>>` (or `*FormState`)

**Choice:** Prefer `z.input<typeof schema>` when empties align; introduce a local `*FormState` only when UI needs `''` / optional fields the API DTO does not. Never `undefined as T`. Submit uses validated event data without field casts.

**Why:** UForm requires an object; schema input is the single source of truth already used server-side.

**Alternatives considered:**

- Only primitive refs + rebuild object each submit — fights UForm and loses field binding ergonomics.
- Always loosen to a hand-written bag without schema link — regresses type sharing.

### D4 — Sync maps: parallel named aliases, not one bag

**Choice:** Keep separate maps; introduce documentation aliases (`type TaskId = string`, `type ActivityByTask = Partial<Record<TaskId, string | null>>`, etc.). Prefer `ref<Alias>({})` / `shallowRef` only where replace-the-map is already the update style. Expand-all `true | Record<…>` normalized via a tiny helper so call sites do not cast.

**Why:** User explicitly rejected mega-objects; named aliases fix the “Record soup” readability issue without branding.

**Alternatives considered:**

- Single `Map<TaskId, TaskUiState>` — better correlation, rejected for this change.
- Branded `TaskId` — deferred by product decision.

### D5 — Library friction adapters

**Choice:** For sidebar toggle props, confirm modal component types, `currentTarget`, and similar: small functions in `app/utils` (or next to the consumer if truly one-off) returning the **component prop type** or narrowed DOM type — not `Record<string, unknown>`.

**Why:** `Record<string, unknown>` erases checks; prop-typed adapters keep call sites clean.

**Alternatives considered:**

- Leave casts at layout/page — fails “minimize and contain” rule.
- Module augmentation of Nuxt UI types — higher cost; optional follow-up if gaps are stable.

### D6 — `extractMessageKey` / unknown errors

**Choice:** Prefer `'data' in err` / small envelope type or existing patterns over `err as Record<string, unknown>` if touched while cleaning; do not expand into a full error-framework rewrite.

**Why:** In scope only as assertion hygiene; behavior already works.

## Risks / Trade-offs

- **[Risk] Shared menu helper changes dialog UX slightly (create-row parity with AppTimer)** → Mitigation: match AppTimer semantics; cover with existing nuxt/component tests or a focused unit test on the pure builder.
- **[Risk] `z.input` vs UI empty strings disagree on optional ids** → Mitigation: local `*FormState` alias; schema still validates on submit.
- **[Risk] Named aliases are erased at compile time and do not stop id mixups** → Mitigation: accepted; branding is an explicit non-goal.
- **[Risk] Nuxt UI types still force adapter casts** → Mitigation: one module, documented; no template double-casts.
- **Trade-off:** Docs + targeted cleanup vs eslint `as` ban — prefer docs first for signal-to-noise.

## Migration Plan

1. Land standards bullets and shared menu helper.
2. Switch add/bulk dialogs to the helper; delete double-casts.
3. Annotate form states and remove value casts (projects, settings, login, RemoteIssuePicker, bulk assign).
4. Alias sync maps + expand helper; light touch on `useSyncExport` ref seeding.
5. Contain remaining library casts in adapters.
6. Run `pnpm lint`, `pnpm type-check`, and relevant `test:unit` / `test:nuxt` (e2e only if dialog flows regress).

Rollback: revert the change branch; no data/API migration.

## Open Questions

- Exact helper name/location (`app/composables/useTaskTitleMenu.ts` vs `app/utils/taskTitleMenu.ts`) — decide at implement time from neighboring patterns; pure builder preferred if no lifecycle is needed.
- Whether to adopt `shallowRef` only on touched sync maps or leave `ref` — either satisfies specs if types and replace-style updates are correct.
