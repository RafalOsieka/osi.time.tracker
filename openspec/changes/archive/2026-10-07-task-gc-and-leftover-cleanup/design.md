# Design

## Context

Task garbage collection is written out by hand in two handlers. `DELETE /api/time-entries/[id]` checks for another entry on the task and deletes it if none is left. `POST /api/time-entries/reassign` does the same for every source task except the target. `PATCH /api/time-entries/[id]` resolves a new `taskId` but never looks at the old one. The task merge in `PATCH /api/tasks/[id]` deletes the merged task directly, because it always empties it.

The remaining items in proposal.md are deletions and renames with no shared design concern, except the error-key rename, which crosses package boundaries.

## Goals / Non-Goals

**Goals:**
- One server helper owns the rule from REQ-491, and every handler that moves entries away from a task calls it.
- The rename of error keys lands atomically across the packages, the web app and both catalogs.

**Non-Goals:**
- Changing the task merge: it already deletes the task it empties.
- Cleaning up orphan tasks already in the database.

## Decisions

**A shared `deleteTaskIfEmpty(tx, userId, taskId)` in `server/utils/tasks.ts`.** It deletes the user's task when no entry references it and does nothing for `null`. The delete, reassign and patch handlers call it inside their transaction, after the entries have moved. Reassign keeps skipping the target task. Patch calls it only when the resolved `taskId` differs from the previous one, which also covers a cleared title (`null`).
- *Alternative:* a database trigger that deletes the task when its last entry leaves. Rejected: it hides behavior from the handlers and their tests, and the migrator would carry logic the app code does not show.
- *Alternative:* inline the check in the patch handler like the other two. Rejected: a third copy of the same query is how this rule drifted in the first place.

**Error keys become `error.remoteTracker{SecretRequired,AuthRejected,ConnectionFailed}`.** The keys stay in the `error.` namespace and keep their meaning; only the `ServerMode` part is gone. The extension forwards the `messageKey` it receives from the adapter, so the web app, the extension and both packages must change in one commit. A web app and extension built from different commits could show an untranslated key for one release. That matters only to a contributor with a stale unpacked extension; users build both from the same checkout.
- *Alternative:* keep the old names. Rejected by the user; the names describe a mode that does not exist.

**Unknown `executionMode` is stripped, not rejected.** Removing the `z.never()` guard makes the tracker schema treat it like any other unknown key, which the object schema already strips. No new message key is needed, and `error.trackerExecutionModeRequired` is deleted from both catalogs.

**Retired codes get rows in `docs/retired-requirements.md`.** REQ-132 → REQ-491, REQ-245 → REQ-492, REQ-249 → REQ-495, REQ-399 → REQ-493, REQ-400 → REQ-494, and REQ-314 and REQ-364 as dropped migration requirements. The `REQ-399` comments in the profile handlers and shared type move to REQ-493.

## Risks / Trade-offs

- [Orphans created before this change stay in task autocomplete] → They rank after every task with entries (REQ-133). The user chose not to migrate them away.
- [The ruleset lives in GitHub settings, outside this repository] → The spec states the required checks; the owner applies them in the ruleset, and `docs/development.md` stops calling `specs` optional.
- [Deleting the rounding helpers may break the bundler warmup] → The plugin keeps `applyRoundingRule`, which keeps the shared rounding module in the stable chunk; `pnpm test:e2e` (production build) verifies it.
