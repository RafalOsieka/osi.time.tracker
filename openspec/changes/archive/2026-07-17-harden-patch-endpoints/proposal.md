# Proposal: harden-patch-endpoints

## Why

Renaming a task (group) in the Timer view silently deletes its assigned project. The Timer view's `commitTitle()` sends `PATCH /api/tasks/[id]` with only `{ name }`, but the handler coalesces the absent `projectId` with `?? null` and always writes it, wiping the assignment. This is a PATCH-vs-PUT semantics bug: an **absent** optional field is treated the same as an **explicit `null`**.

An audit of all five `PATCH` endpoints found the same idiom (`x ?? null` on an optional foreign key) in a second place: `PATCH /api/time-entries/[id]` re-homes an entry to the no-project scope on a title-only edit, because `resolveTaskId` collapses an absent `projectId` to `null`. The other three endpoints are safe today (`projects/[id]` fails loud with `422`; `clients/[id]` has a single field; `user/settings` already spreads only present keys) but the pattern is a standing footgun.

## What Changes

- **`PATCH /api/tasks/[id]`** distinguishes field presence: an **omitted** `projectId` keeps the current project, an explicit **`null`** clears it, and a **uuid** assigns it (ownership validated). The `?? null` collapse is removed and the resolved value is threaded through ownership validation, the collision/merge scope, and the update.
- **`PATCH /api/time-entries/[id]`** gains a `projectId` fallback symmetric to its existing title fallback: when `projectId` is absent, the entry's current task's project is resolved before calling `resolveTaskId`, so a title-only edit preserves the entry's project scope; an explicit `null` still moves it to the project-less scope.
- **Test-first-for-bugs** becomes a standing rule: a failing reproduction test MUST be written and confirmed red before a bug fix, then confirmed green after. Captured in `CODING_STANDARDS.md §10` and the `coding-standards-compliance` capability.
- **`PATCH /api/projects/[id]`** is left unchanged (its required `clientId` already yields `422`), documented via a pinning test guarding against future silent-loss regressions.

## Capabilities

### Modified Capabilities

- `task-management`: `PATCH /api/tasks/[id]` MUST keep the current project when `projectId` is omitted and clear it only on an explicit `null`.
- `time-tracking`: `PATCH /api/time-entries/[id]` MUST preserve the entry's current project scope on a title-only edit and move it to the project-less scope only on an explicit `projectId: null`.
- `coding-standards-compliance`: a failing reproduction test MUST precede a bug fix and pass afterward.

## Impact

- **Server:** `server/api/tasks/[id].patch.ts`, `server/api/time-entries/[id].patch.ts`, `server/utils/tasks.ts` — behavior-only changes; no schema, endpoint, or DTO changes.
- **Tests:** `test/e2e/tasks.spec.ts`, `test/e2e/time-entries.spec.ts`, `test/e2e/projects.spec.ts` gain regression/pinning coverage.
- **Docs:** `CODING_STANDARDS.md §10 Testing` gains the bug-fix regression rule.
- **i18n:** no new user-facing strings expected.

## Non-goals

- No changes to `PATCH /api/clients/[id]` (single required field) or `PATCH /api/user/settings` (already correct partial semantics).
- No relaxation of `PATCH /api/projects/[id]`; only a pinning test documents the current `422` contract.
- No client refactor beyond confirming `TimerTaskGroup.commitTitle()` behaves correctly once the server honors partial semantics.
