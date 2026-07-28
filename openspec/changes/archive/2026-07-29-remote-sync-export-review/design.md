## Context

`useSyncExport.runExport(tasks)` loops sequentially over the pushable rows. Per task it calls `createTimeEntry` (directly or proxied) and then `POST /api/sync/export` to finalize, writing one of three outcomes into a `Record<taskId, RemoteExportTaskOutcomeDto>`: `success`, `remote_failure`, or `uncertain_finalization`. The whole batch shares a single `isRunning` boolean; the page renders each outcome as one small muted `<p>`. The comment sent to the tracker is `row.taskName`, hard-coded in the composable. Repeat risk is handled before the loop by a single `useAppConfirm` listing affected task names.

```
today                            proposed
──────────────────────────       ──────────────────────────────────────────
[Export] ─▶ (silent loop)        [Export] ─▶ REVIEW ─confirm─▶ RUNNING ─▶ REPORT
        ─▶ grey text lines                     │                 │
                                             cancel        stop after current task
                                                                 │
                                                          per-task [Retry]
```

The dangerous state is `uncertain_finalization`: the remote log exists, local provenance does not. REQ-120 currently only requires warning that a retry may duplicate — which makes retry unusable in exactly the case where the user most wants it.

## Goals / Non-Goals

**Goals:**

- Never press Export blind: one screen states exactly what leaves, what is skipped and why.
- Never lose the mapping between approved rows and their result.
- Make failure recoverable per task, without re-confirming the whole batch.
- Make retry after an uncertain finalization safe rather than merely warned about.
- Keep the export loop sequential and browser-orchestrated (REQ-121 unchanged).

**Non-Goals:**

- Server-side job state, durable queue, pause/resume, parallelism.
- Any change to how durations or rounding are computed.

## Decisions

**1. One dialog, three phases, one table.**
Alternative considered: a review `UModal`, then inline progress on the page, then a results `USlideover`. Rejected — the user would have to re-find each task three times in three different layouts. A single `UModal` that swaps only its footer actions and adds a status column keeps row identity constant. The dialog is not dismissible while running (only the explicit stop action ends it early) so a mid-flight run cannot be orphaned by a stray click.

**2. Review is mandatory.**
Alternative considered: an opt-out fast path for repeat-free days. Rejected for now — the review screen is where rounding deltas and duplicate warnings become visible, which is the whole point; skipping it re-creates today's blind Export. It also unifies the repeat confirmation into one place instead of a second dialog. If it proves annoying in daily use, an opt-out is a small follow-up.

**3. Progress is per-task state in the composable, not a boolean.**
`useSyncExport` gains `progress: Ref<Record<taskId, 'queued' | 'creating' | 'finalizing' | 'done' | 'failed' | 'uncertain'>>` plus `completedCount` / `totalCount`. The dialog renders it; `aria-live="polite"` announces the `n / total` change, not every row, to avoid announcement storms. Outcomes keep their existing `RemoteExportTaskOutcomeDto` shape so nothing downstream breaks.

**4. Stop is cooperative and only between tasks.**
A `requestStop()` sets a flag the loop checks before starting the next task. Aborting a task mid-flight would risk creating a remote log whose response we never read — precisely the uncertain state we are trying to reduce. Remaining tasks end as `queued`/not attempted, and the report says so explicitly.

**5. Per-task retry, not an export queue.**
`retryTask(taskId)` re-runs the single-task path with the same inputs, replacing that row's outcome in place and re-confirming nothing (the batch was already approved). The queue alternative — persistent job state, backoff, attempt history — was rejected: a day is at most ~15 tasks, sequential, with the user watching; durable state would need server support and a schema for something the user can simply press again.

**6. Idempotency via a client-generated export request key.**
The key is a stable hash of `(taskId, localDate, sorted entryIds, exportDurationSeconds)`, generated in the browser and sent both to the finalize endpoint and (as the retry identity) on re-attempt. It is persisted on the export record with a per-user unique constraint.

```
create remote log ──▶ finalize(key) ──▶ provenance stored with key
        │                   ✗ fails
        └──────── retry(key) ─▶ finalize(key) with the known remoteLogId
                                   │
                    key already stored ─▶ return the stored result (no new remote log)
```

So a retry after an uncertain finalization completes the *same* logical export rather than starting a second one, and a double-submit of an identical export is rejected/reconciled instead of duplicating. It cannot cover the case where the remote log id was never received by the browser at all (network died mid-create) — that remains genuinely uncertain and is reported as needing verification with a deep link. Alternative considered: server-side reconciliation by querying the tracker for logs created in the last N seconds — provider-specific, racy, and it would push credential use into a background path.

**7. The comment is authored locally, remembered remotely.**
Default: the comment of the most recent fetched remote log for that issue, falling back to the task name (today's behaviour). Editable per task in the row detail and visible in the review table. Held in a `ref<Record<taskId, string>>` for the current day only — no column, no migration, because the tracker stores the comment and `useRemoteDayLogs` already reads it back.

**8. Uncertain is loud.**
Report groups are succeeded / failed / needs verification; the needs-verification group is a warning-level block naming the `remoteLogId` and linking to `config.baseUrl` + the log, with the retry action explained as reconciling rather than re-sending.

## Risks / Trade-offs

- **The mandatory review adds a click to every export** → it replaces the existing repeat confirmation, so a repeat day gains nothing; a clean day gains one confirm in exchange for seeing the rounding delta before it is billed.
- **Request key persistence needs a migration and a unique constraint** → single column plus a per-user unique index; nullable so pre-existing export records stay valid, with reconciliation applying only when a key is present.
- **A hash collision would suppress a legitimate second export** → the key includes the entry ids and duration, so a legitimate second export of the same day always differs in at least one input; identical inputs are exactly the duplicate we want to reconcile.
- **Stop between tasks is not a cancel** → labelled explicitly as "stop after the current task"; a true cancel is impossible without risking orphaned remote logs.
- **Long-running dialog blocks the page** → acceptable for a sequential, user-supervised batch of a single day; the dialog shows progress and can be stopped.
