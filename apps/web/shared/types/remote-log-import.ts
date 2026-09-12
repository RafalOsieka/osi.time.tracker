import { z } from 'zod';
import { isoDateSchema } from './remote-export';

/** Hard cap on remote logs accepted in one import request (REQ-339). */
export const IMPORT_REMOTE_LOGS_MAX_PER_REQUEST = 500;

/** One remote log submitted for import, already routed to a Project by the client (REQ-334). */
export const importRemoteLogSchema = z.object({
  remoteLogId: z
    .string({ error: 'error.remoteLogImportRemoteLogIdRequired' })
    .trim()
    .min(1, { error: 'error.remoteLogImportRemoteLogIdRequired' }),
  remoteIssueId: z
    .string({ error: 'error.remoteLogImportRemoteIssueIdRequired' })
    .trim()
    .min(1, { error: 'error.remoteLogImportRemoteIssueIdRequired' }),
  spentOn: isoDateSchema,
  durationSeconds: z
    .int({
      error: (issue) =>
        issue.input === undefined
          ? 'error.remoteLogImportDurationRequired'
          : 'error.remoteLogImportDurationInvalid',
    })
    .positive({ error: 'error.remoteLogImportDurationInvalid' }),
  activityId: z.string().trim().min(1).nullable(),
  comment: z.string().nullable(),
  /** Present only when the fetched log carried it (REQ-341); never fetched separately. */
  remoteIssueTitle: z.string().trim().min(1).optional(),
  remoteProjectTitle: z.string().trim().min(1).optional(),
});

export type ImportRemoteLogDto = z.infer<typeof importRemoteLogSchema>;

/** One local Project's routed logs. */
export const importRemoteLogGroupSchema = z.object({
  projectId: z.uuid({
    error: (issue) =>
      issue.input === undefined
        ? 'error.remoteLogImportProjectIdRequired'
        : 'error.remoteLogImportProjectIdInvalid',
  }),
  logs: z.array(importRemoteLogSchema).min(1, { error: 'error.remoteLogImportLogsRequired' }),
});

export type ImportRemoteLogGroupDto = z.infer<typeof importRemoteLogGroupSchema>;

function allRemoteLogIds(value: { groups: ImportRemoteLogGroupDto[] }): string[] {
  return value.groups.flatMap((group) => group.logs.map((log) => log.remoteLogId));
}

/** Request body for `POST /api/trackers/[id]/import` (REQ-339). */
export const importRemoteLogsSchema = z
  .object({
    dryRun: z.boolean({ error: 'error.remoteLogImportDryRunInvalid' }),
    groups: z
      .array(importRemoteLogGroupSchema)
      .min(1, { error: 'error.remoteLogImportGroupsRequired' }),
  })
  .refine((value) => allRemoteLogIds(value).length <= IMPORT_REMOTE_LOGS_MAX_PER_REQUEST, {
    path: ['groups'],
    error: 'error.remoteLogImportTooManyLogs',
  })
  .refine(
    (value) => {
      const ids = allRemoteLogIds(value);
      return new Set(ids).size === ids.length;
    },
    { path: ['groups'], error: 'error.remoteLogImportDuplicateRemoteLogId' },
  );

export type ImportRemoteLogsDto = z.infer<typeof importRemoteLogsSchema>;

/** Per-Project counts in an import response (REQ-339). */
export interface ImportRemoteLogsProjectResultDto {
  projectId: string;
  /** Logs persisted this request. Always 0 on a dry run. */
  imported: number;
  /** Logs that are new (not already-linked) — what a write run would import. */
  wouldImport: number;
  /** Logs already covered by existing export provenance for this tracker (REQ-338). */
  skippedExisting: number;
}

export interface ImportRemoteLogsResultDto {
  dryRun: boolean;
  projects: ImportRemoteLogsProjectResultDto[];
  totalImported: number;
  totalWouldImport: number;
  totalSkippedExisting: number;
}
