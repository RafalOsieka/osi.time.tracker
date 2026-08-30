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

/** Successful finalization response, including known-result replay. */
export interface FinalizeRemoteExportResultDto {
  exportId: string;
  /** Nullable after the source task is garbage-collected (ON DELETE SET NULL). */
  taskId: string | null;
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

/**
 * A single same-day remote time log shown as informational context beside a
 * linked task (REQ-118). Never used to infer local provenance.
 */
export interface RemoteTimeLogDto {
  remoteLogId: string;
  remoteIssueId: string;
  /** Local calendar day the remote log is spent on (`YYYY-MM-DD`). */
  spentOn: string;
  /** Duration in seconds as reported by the remote system. */
  durationSeconds: number;
  activityId: string | null;
  activityName: string | null;
  comment: string | null;
  /** Remote user id of the log author (current account only is displayed). */
  remoteUserId: string | null;
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

/** Proxied current-account resolution body. */
export const proxiedRemoteAccountSchema = z.object({
  trackerId: z.uuid({ error: 'error.trackerIdRequired' }),
});

export type ProxiedRemoteAccountDto = z.infer<typeof proxiedRemoteAccountSchema>;

export interface ProxiedRemoteAccountResponseDto {
  id: string;
  name: string;
}

/** Proxied same-day time-log context body. */
export const proxiedRemoteTimeLogsSchema = z.object({
  trackerId: z.uuid({ error: 'error.trackerIdRequired' }),
  spentOn: isoDateSchema,
  workPackageIds: z
    .array(
      z
        .string({ error: 'error.remoteIssueIdRequired' })
        .min(1, { error: 'error.remoteIssueIdRequired' }),
    )
    .min(1, { error: 'error.remoteIssueIdRequired' }),
  userId: z.string().min(1).optional(),
});

export type ProxiedRemoteTimeLogsDto = z.infer<typeof proxiedRemoteTimeLogsSchema>;

export interface ProxiedRemoteTimeLogsResponseDto {
  logs: RemoteTimeLogDto[];
}

/** Proxied date-range time-log fetch body (reports; no issue filter). */
export const proxiedRemoteTimeLogsRangeSchema = z
  .object({
    trackerId: z.uuid({ error: 'error.trackerIdRequired' }),
    from: isoDateSchema,
    to: isoDateSchema,
    userId: z.string().min(1).optional(),
  })
  .refine((value) => value.from <= value.to, {
    path: ['from'],
    error: 'error.remoteSyncDateInvalid',
  });

export type ProxiedRemoteTimeLogsRangeDto = z.infer<typeof proxiedRemoteTimeLogsRangeSchema>;

export interface ProxiedRemoteTimeLogsRangeResponseDto {
  logs: RemoteTimeLogDto[];
}

/** Proxied create-time-entry body. */
export const proxiedRemoteCreateTimeEntrySchema = z.object({
  trackerId: z.uuid({ error: 'error.trackerIdRequired' }),
  remoteIssueId: z
    .string({ error: 'error.remoteIssueIdRequired' })
    .min(1, { error: 'error.remoteIssueIdRequired' }),
  spentOn: isoDateSchema,
  durationSeconds: z
    .int({ error: 'error.remoteExportDurationInvalid' })
    .positive({ error: 'error.remoteExportDurationInvalid' }),
  activityId: z
    .string({ error: 'error.remoteExportActivityRequired' })
    .min(1, { error: 'error.remoteExportActivityRequired' }),
  comment: z.string().optional(),
});

export type ProxiedRemoteCreateTimeEntryDto = z.infer<typeof proxiedRemoteCreateTimeEntrySchema>;

export interface ProxiedRemoteCreateTimeEntryResponseDto {
  remoteLogId: string;
}
