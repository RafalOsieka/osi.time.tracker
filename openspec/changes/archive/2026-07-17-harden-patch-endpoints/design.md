# Design: harden-patch-endpoints

## Context

The reported bug: renaming a task group in the Timer view clears its project. `app/components/TimerTaskGroup.vue` `commitTitle()` sends `PATCH /api/tasks/[id]` with only `{ name }`, while `commitProject()` sends `{ name, projectId }`. The task PATCH handler treats an absent `projectId` the same as an explicit `null` and always writes it, so a title-only edit wipes the project.

The root cause is a shared idiom — coalescing an optional foreign key with `x ?? null`, which erases the distinction between `undefined` (field omitted → "keep") and `null` (explicit → "clear"). Zod's `.nullish()` on `projectId` **does** preserve `undefined` vs `null` after parse; the handler is what collapses them.

## Goals / Non-Goals

**Goals:**

- `PATCH /api/tasks/[id]`: omitted `projectId` keeps the current project, `null` clears it, a uuid assigns it (ownership validated).
- `PATCH /api/time-entries/[id]`: a title-only edit keeps the entry's current project scope; `projectId: null` moves it to the project-less scope.
- Establish and document a test-first workflow for bug fixes.

**Non-Goals:**

- No changes to `clients/[id]` or `user/settings` (already safe). No relaxation of `projects/[id]` (safe by required field). No schema, endpoint, or DTO changes. No client-side refactor.

## Audit of all five PATCH endpoints

| Endpoint                     | Schema shape                        | Silent data loss?         |
| ---------------------------- | ----------------------------------- | ------------------------- |
| `tasks/[id]`                 | `name` + `projectId` `.nullish()`   | YES — the reported bug    |
| `time-entries/[id]`          | all fields `.nullish()`             | YES — same class, deeper  |
| `projects/[id]`              | `name` + `clientId` (both required) | No — fails loud (`422`)   |
| `clients/[id]`               | `name` only (required)              | No — single field         |
| `user/settings`              | all fields `.optional()`            | No — spreads present keys |

## Decisions

### D1: Fix at the server (partial PATCH semantics), not the client

Branch on presence (`parsedBody.projectId !== undefined`) instead of `?? null`, and thread the resolved value (`existing.projectId` when absent) through the ownership re-check, `projectCondition`/collision scope, and the `.set(...)` update. Fixing the server hardens the endpoint for **all** callers, not just the Timer view.

- *Alternative considered:* fix only `TimerTaskGroup.commitTitle()` to always send `{ name, projectId }`. Rejected: it leaves the endpoint's footgun in place for every future caller and does not address the identical time-entries bug.

### D2: `time-entries` resolves `projectId` before `resolveTaskId`

`time-entries/[id].patch.ts` already re-fetches the current title as a fallback when `title` is absent, but has no matching `projectId` fallback. Add the symmetric fallback: when `projectId` is absent, resolve it to the current task's project before calling `resolveTaskId`. Keep `resolveTaskId` accepting `undefined`, but never pass a raw absent value that means "keep".

### D3: Preserve the absent-vs-null distinction end to end

`undefined`/omitted → keep; `null` → unassign; uuid → assign (ownership validated). Ownership validation runs only when `projectId` is provided **and** changed to a different non-null value; clearing to `null` and keeping the current project are never re-validated (consistent with REQ-TTR-030).

### D4: Leave `projects/[id]` as-is, pin the contract

Its required `clientId` means omitting it yields `422`, not silent loss. Add a pinning test that a `{ name }`-only PATCH returns `422`, so any future relaxation of the field re-triggers a caught regression.

### D5: Test-first for bug fixes becomes a standing rule

Each bug gets a regression test authored and confirmed **red** before the handler change, then confirmed **green** after. Recorded in `CODING_STANDARDS.md §10` and as an ADDED requirement in the `coding-standards-compliance` capability.

## Data contract per field presence

```
body sent to PATCH /api/tasks/[id]   ->  effect on projectId
{ name }                             ->  UNCHANGED (absent = keep)
{ name, projectId: null }            ->  UNASSIGNED (explicit clear)
{ name, projectId: "uuid" }          ->  SET (ownership validated)
```

## Risks / Trade-offs

- [Collision/merge in `tasks/[id]` uses the project scope] → feeding `existing.projectId` when absent keeps the collision check in the correct scope; verified by tests.
- [Other `resolveTaskId` callers] → they keep working because a resolved (non-absent) value is passed; covered by `test/e2e/resolve-task-id.spec.ts` expectations.
- [E2E tests require Docker/Postgres (`requireDocker()`)] → repro tests slot into the existing gated suites.

## Open Questions

- None blocking. Writing `projectId: targetProjectId` always (vs. conditionally omitting the key) yields identical data; the always-write form is chosen for simplicity since the value resolves to `existing.projectId` when absent.
