import { z } from 'zod';

export const isoDateSchema = z
  .string({ error: 'error.remoteSyncDateRequired' })
  .regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'error.remoteSyncDateInvalid' })
  .refine((value) => !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime()), {
    error: 'error.remoteSyncDateInvalid',
  });

/**
 * Request body for local finalization after the browser successfully created
 * a remote time log (REQ-119 / REQ-120).
 */
export const finalizeRemoteExportSchema = z.object({
  taskId: z.uuid({
    error: (issue) =>
      issue.input === undefined
        ? 'error.remoteExportTaskIdRequired'
        : 'error.remoteExportTaskIdInvalid',
  }),
  localDate: isoDateSchema,
  remoteIssueId: z
    .string({ error: 'error.remoteExportRemoteIssueIdRequired' })
    .trim()
    .min(1, { error: 'error.remoteExportRemoteIssueIdRequired' }),
  remoteLogId: z
    .string({ error: 'error.remoteExportRemoteLogIdRequired' })
    .trim()
    .min(1, { error: 'error.remoteExportRemoteLogIdRequired' }),
  exportDurationSeconds: z
    .int({
      error: (issue) =>
        issue.input === undefined
          ? 'error.remoteExportDurationRequired'
          : 'error.remoteExportDurationInvalid',
    })
    .positive({ error: 'error.remoteExportDurationInvalid' }),
  requiredFieldValues: z.record(z.string(), z.string()).default({}),
  entryIds: z
    .array(z.uuid({ error: 'error.remoteExportEntryIdsInvalid' }))
    .min(1, { error: 'error.remoteExportEntryIdsInvalid' }),
  /** Client-generated idempotency key for this logical export attempt (REQ-233). */
  exportRequestKey: z
    .string({ error: 'error.remoteExportRequestKeyRequired' })
    .trim()
    .min(1, { error: 'error.remoteExportRequestKeyRequired' })
    .max(256, { error: 'error.remoteExportRequestKeyInvalid' }),
  /** Optional free-text comment that was submitted with the remote log. */
  comment: z.string().optional(),
});

export type FinalizeRemoteExportDto = z.infer<typeof finalizeRemoteExportSchema>;

/** Request body for linking a discovered remote entry to a local task/day. */
export const linkRemoteEntrySchema = z.object({
  taskId: z.uuid({
    error: (issue) =>
      issue.input === undefined
        ? 'error.remoteExportTaskIdRequired'
        : 'error.remoteExportTaskIdInvalid',
  }),
  trackerId: z.uuid({
    error: (issue) =>
      issue.input === undefined
        ? 'error.remoteExportTrackerIdRequired'
        : 'error.remoteExportTrackerIdInvalid',
  }),
  localDate: isoDateSchema,
  remoteIssueId: z
    .string({ error: 'error.remoteExportRemoteIssueIdRequired' })
    .trim()
    .min(1, { error: 'error.remoteExportRemoteIssueIdRequired' }),
  remoteLogId: z
    .string({ error: 'error.remoteExportRemoteLogIdRequired' })
    .trim()
    .min(1, { error: 'error.remoteExportRemoteLogIdRequired' }),
  exportDurationSeconds: z
    .int({
      error: (issue) =>
        issue.input === undefined
          ? 'error.remoteExportDurationRequired'
          : 'error.remoteExportDurationInvalid',
    })
    .positive({ error: 'error.remoteExportDurationInvalid' }),
  requiredFieldValues: z.record(z.string(), z.string()).default({}),
  spentOn: isoDateSchema,
});

export type LinkRemoteEntryDto = z.infer<typeof linkRemoteEntrySchema>;

/** Request body for removing local provenance after confirmed remote deletion. */
export const cleanupRemoteExportSchema = z.object({
  exportId: z.uuid({
    error: (issue) =>
      issue.input === undefined ? 'error.remoteExportIdRequired' : 'error.remoteExportIdInvalid',
  }),
});

export type CleanupRemoteExportDto = z.infer<typeof cleanupRemoteExportSchema>;

export interface CleanupRemoteExportResultDto {
  exportId: string;
  cleaned: true;
}

/** Successful finalization response, including known-result replay. */
export interface FinalizeRemoteExportResultDto {
  exportId: string;
  /** Nullable after the source task is garbage-collected (ON DELETE SET NULL). */
  taskId: string | null;
  trackerId: string;
  localDate: string;
  remoteIssueId: string;
  remoteLogId: string;
  exportDurationSeconds: number;
  requiredFieldValues: Record<string, string>;
  entryIds: string[];
  exportRequestKey: string | null;
  createdAt: string;
  /** True when an existing finalized record for this remote log was returned. */
  replayed: boolean;
}

/** Per-task outcome of one browser-orchestrated export batch (REQ-120). */
export const remoteExportOutcomeStatusSchema = z.enum([
  'success',
  'remote_failure',
  'uncertain_finalization',
  'excluded',
]);

export type RemoteExportOutcomeStatus = z.infer<typeof remoteExportOutcomeStatusSchema>;

export interface RemoteExportTaskOutcomeDto {
  taskId: string;
  status: RemoteExportOutcomeStatus;
  remoteLogId?: string;
  exportId?: string;
  /** Translation key for failure/uncertain/excluded explanations. */
  messageKey?: string;
  messageParams?: Record<string, string | number>;
}
