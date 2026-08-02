# migrate-zod-v4 notes

## 1.1 Pre-migration baseline

### `error.*` message keys in `shared/types`

- Total occurrences: 153
- Unique keys: 41

```
error.clientNameRequired
error.clientNameTooLong
error.projectClientRequired
error.projectNameRequired
error.projectNameTooLong
error.remoteConfigBaseUrlInvalid
error.remoteConfigBaseUrlRequired
error.remoteConfigExecutionModeRequired
error.remoteConfigIdRequired
error.remoteConfigRoundingRuleRequired
error.remoteConfigSystemTypeRequired
error.remoteExportActivityRequired
error.remoteExportDurationInvalid
error.remoteExportDurationRequired
error.remoteExportEntryIdsInvalid
error.remoteExportRemoteIssueIdRequired
error.remoteExportRemoteLogIdRequired
error.remoteExportRequestKeyInvalid
error.remoteExportRequestKeyRequired
error.remoteExportTaskIdInvalid
error.remoteExportTaskIdRequired
error.remoteIssueIdRequired
error.remoteIssueSearchModeRequired
error.remoteIssueSearchQueryRequired
error.remoteIssueTitleRequired
error.remoteSyncDateInvalid
error.remoteSyncDateRequired
error.taskNameRequired
error.taskNameTooLong
error.taskProjectInvalid
error.timeEntryIdsInvalid
error.timeEntryManualPairIncomplete
error.timeEntryProjectInvalid
error.timeEntryRangeInvalid
error.timeEntryStartAfterStop
error.timeEntryStartedAtInFuture
error.timeEntryStartedAtInvalid
error.timeEntryStoppedAtInvalid
error.timeEntryTaskInvalid
error.timeEntryTitleInvalid
error.timeEntryTitleTooLong
```

Also present (auth, not `error.*` prefix): `errors.auth.credentialsRequired`.

### Nil UUID `00000000-0000-0000-0000-000000000000` in `test/`

All current occurrences are **unknown id** fixtures (expect `404`). None are deliberately **malformed id** assertions.

| File | Line(s) | Classification | Context |
| ---- | ------- | -------------- | ------- |
| `test/e2e/clients.spec.ts` | 147, 187 | unknown id | path param PATCH/DELETE client |
| `test/e2e/projects.spec.ts` | 87, 180, 256, 380 | unknown id | path/body project/client refs |
| `test/e2e/remote-activities-proxy.spec.ts` | 215 | unknown id | body `remoteSystemConfigId` |
| `test/e2e/remote-export-proxy.spec.ts` | 236 | unknown id | body `remoteSystemConfigId` |
| `test/e2e/tasks-remote-issue-ref.spec.ts` | 272 | unknown id | unknown task/ref id |
| `test/e2e/tasks.spec.ts` | 251 | unknown id | path/body task id |
| `test/e2e/time-entries.spec.ts` | 195, 228, 352, 492, 622, 635, 760, 785 | unknown id | path ids, body `taskId`/`ids[]` |

## 1.2 Dependency tree

- Direct dependency: `zod@4.4.3` (`^4` in package.json).
- `pnpm why zod` reports a single version: `4.4.3`.
- Consumers: app direct dep, `@nuxt/ui@4.10.0` peer, transitive tooling peers.
- A leftover `node_modules/.pnpm/zod@3.25.76` folder may remain from the prior install but is not reachable (`pnpm why zod@3.25.76` empty; lockfile has no zod@3 importers).

## 1.3 Nuxt UI zod peer

- `@nuxt/ui@4.10.0` resolves `zod@4.4.3` as peer — no peer dependency warnings during `pnpm install`.
- Install output: `- zod 3.25.76` / `+ zod 4.4.3`.

## Zod 4.4 `z.uuid()` note

Zod 4.4's `z.uuid()` pattern **accepts** the RFC nil and max sentinels
(`00000000-…` / `ffffffff-…`) while still rejecting other invalid version/variant
nibbles (e.g. `00000000-0000-0000-0000-000000000001`). The change design assumed
nil would fail validation; implementation uses a non-nil malformed fixture for
422 cases and a valid UUIDv7 constant for unknown-id 404 cases.

