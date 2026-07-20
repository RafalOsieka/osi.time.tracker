# Refactor living specs for consistency and de-duplication

## Why

During the MVP phase the 26 living capability specs under `openspec/specs/` were
authored incrementally, one archived change at a time. They are all structurally
valid (`openspec validate --all` passes; REQ numbering is contiguous
`REQ-001`…`REQ-168`), but three classes of learning-path defects remain:

1. **Presentation drift** — 7 specs still carry the `TBD - created by archiving
   change …` placeholder Purpose, and 3 specs are missing the
   `# <name> Specification` H1.
2. **Duplicated cross-cutting rules** — every domain API spec restates the same
   auth + CSRF + error-contract + isolation + validation boundary contract as a
   near-verbatim final requirement (`REQ-032`, `REQ-090`, `REQ-139`, `REQ-147`).
3. **A grab-bag spec** — `coding-standards-compliance` holds three unrelated
   rules that each belong in a topic-focused spec, and one of them
   (`REQ-036`) overlaps `type-safety` `REQ-159`.

The owner's stated preferences: **finer, smaller, single-purpose specs** and
**extracting the repeated boundary rules into one shared spec**.

## What Changes

This is a **specs-only refactor** — no application behavior changes. Grouped
into phases, from zero-risk polish to structural moves:

- **Phase 1 — Polish (zero risk):** write real Purposes for the 7 TBD specs
  (`remote-issue-linking`, `remote-issue-proxy`, `remote-system-config`,
  `remote-sync-review`, `redmine-adapter`, `platform-toolchain`, `ci-pipeline`),
  add the missing H1 to `docker-deployment`, `openproject-dev-environment`,
  `redmine-dev-environment`, and normalize heading/blank-line style.
- **Phase 2 — Extract shared boundary contract:** add a new
  `api-endpoint-conventions` capability holding the 5-point contract; remove the
  per-domain "Authenticated and CSRF-guarded …" requirements (`REQ-032`,
  `REQ-090`, `REQ-139`, `REQ-147`) and reference the shared spec instead.
- **Phase 3 — Dissolve `coding-standards-compliance`:** rehome `REQ-035` →
  `shared-ui-components`, `REQ-036` → `type-safety`, `REQ-037` →
  `e2e-test-harness`, each keeping its original REQ number.
- **Phase 4 — Merge dev-environment specs:** combine
  `openproject-dev-environment` and `redmine-dev-environment` into one
  `tracker-dev-environments` capability, preserving `REQ-078`…`REQ-082` and
  `REQ-098`…`REQ-102`.
- **Phase 5 — Further structural moves:** fold `remote-issue-proxy`
  (`REQ-108`–`REQ-110`) into `remote-system-config`, and split coverage
  (`REQ-024`–`REQ-026`) out of `ci-pipeline` into a new `coverage-reporting`
  capability. Numbers preserved for both moves.

## The REQ-number / code constraint

REQ-`<nnn>` codes are referenced in application code and tests (e.g. `REQ-103`,
`REQ-108`, `REQ-109`, `REQ-114`, `REQ-115`, `REQ-117`, `REQ-119`, `REQ-120`,
`REQ-122` in `server/`, `app/composables/`, `shared/`, plus REQ codes in
`test/nuxt/shell.spec.ts`). **This change preserves every existing REQ number**
— even when a requirement moves to another capability, it keeps its number
(REMOVED here, ADDED there re-using the same code). Only genuinely new
requirements (the `api-endpoint-conventions` contract) receive new numbers
(`REQ-169`…`REQ-173`); the Phase 5 moves reuse the existing `REQ-108`–`REQ-110`
and `REQ-024`–`REQ-026` numbers. Consequently **no code changes are required**; a
verification grep is included as a safety net. See `design.md` for the full
mapping and rationale.

## Capabilities

- `api-endpoint-conventions` (new)
- `client-management` (modified)
- `project-management` (modified)
- `task-management` (modified)
- `time-tracking` (modified)
- `coding-standards-compliance` (removed / dissolved)
- `type-safety` (modified)
- `shared-ui-components` (modified)
- `e2e-test-harness` (modified)
- `remote-issue-proxy` (removed / dissolved into `remote-system-config`)
- `remote-system-config` (modified — gains `REQ-108`–`REQ-110`)
- `ci-pipeline` (modified — loses `REQ-024`–`REQ-026`)
- `coverage-reporting` (new — holds `REQ-024`–`REQ-026`)
- Phase 1 presentation-only edits touch several specs without changing
  requirements (tracked in `tasks.md`).
- Phase 4 structural moves are tracked in `tasks.md` and `design.md`.
