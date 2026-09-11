## Context

See `proposal.md` for motivation. Remote Sync currently orchestrates remote creates in the browser and
finalizes immutable-looking provenance through Nitro. Same-day remote logs already reach row details, but
they are not joined to provenance. Reports classify fetched logs by matching remote IDs without tracker
scope. Both client and extension modes use the shared provider adapter package.

## Goals / Non-Goals

**Goals:**

- Keep remote mutations in the browser/extension while local authorization and provenance stay server-side.
- Make link and delete operations idempotent at local boundaries and safe under ambiguous remote failures.
- Use one tracker-scoped identity consistently in sync review, persistence, and reports.

**Non-Goals:**

- Preserve an audit tombstone after deletion or infer links automatically.
- Select only some local entries when linking, or reconcile orphaned provenance without a task row.

## Decisions

### Use `(trackerId, remoteLogId)` as remote-entry identity

Add tracker provenance to each export and enforce workspace uniqueness for the pair. Existing exports are
backfilled from the export task/project relationship before adding the constraint. This avoids collisions
between independent tracker installations. A global `remoteLogId` constraint was rejected because provider
IDs are not globally unique.

### Separate remote deletion from local cleanup

The UI first invokes the neutral adapter delete operation, then calls an authenticated local cleanup
endpoint only for confirmed-deleted or not-found results. The cleanup endpoint verifies the export belongs
to the user and removes the export; dependent entry associations cascade in one transaction. Combining the
remote call into Nitro was rejected because browser-held credentials must not enter OSI APIs.

### Create links through a dedicated validated endpoint

The browser submits tracker identity, remote log values, and target task/day after confirmation. The server
re-resolves ownership, task issue identity, day membership, absence of task/day provenance, and uniqueness,
then atomically creates export provenance covering all completed entries. Client claims are validation
inputs, not authority. Reusing export finalization was rejected because linking has no preceding OSI export
attempt or request key.

### Derive linked state by joining fetched logs to local provenance

The day API exposes tracker-scoped provenance needed to classify fetched logs; remote payloads remain
current-account data from the adapter. Row details render explicit states and eligible actions, replacing
duration-based duplicate heuristics. Automatic duration/comment matching was rejected as unreliable.

### Keep batch execution but remove its report UI

The existing sequential orchestration may continue internally. The dialog becomes confirmation plus a
non-dismissible pending state; completion closes it, refreshes day data, and emits one toast based on all
scheduled outcomes. This preserves per-task isolation without duplicating durable row status in a report.

## Risks / Trade-offs

- [Migration cannot resolve tracker for malformed legacy exports] → Fail migration with diagnostics rather
  than creating an unsafe identity; repair data before retrying.
- [Remote delete succeeds but its response is lost] → Retain provenance; a later retry returning not found
  safely completes cleanup.
- [Remote values are forged by a modified client during linking] → Validate ownership and structural
  invariants server-side; accept remote fields as a snapshot because credentials remain browser-only.
- [Task garbage collection leaves provenance without a task row] → Keep report classification intact;
  management of such orphaned provenance remains outside this page-scoped MVP.

## Migration Plan

1. Add nullable tracker identity, backfill existing exports, then make it required and add the scoped unique
   constraint.
2. Deploy adapter and extension protocol deletion support before enabling delete controls.
3. Deploy APIs and UI together; old provenance remains valid after backfill.
4. Roll back UI/actions first if needed. Retain the additive identity column; do not reverse completed
   remote deletions.