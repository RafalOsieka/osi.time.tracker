import { z } from 'zod';

const isoDateSchema = z
  .string({
    required_error: 'error.remoteSyncDateRequired',
    invalid_type_error: 'error.remoteSyncDateRequired',
  })
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'error.remoteSyncDateInvalid' })
  .refine((value) => !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime()), {
    message: 'error.remoteSyncDateInvalid',
  });

/**
 * Request body for local finalization after the browser successfully created
 * a remote time log (REQ-119 / REQ-120).
 */
export const finalizeRemoteExportSchema = z.object({
  taskId: z
    .string({
      required_error: 'error.remoteExportTaskIdRequired',
      invalid_type_error: 'error.remoteExportTaskIdInvalid',
    })
    .uuid({ message: 'error.remoteExportTaskIdInvalid' }),
  localDate: isoDateSchema,
  remoteIssueId: z
    .string({
      required_error: 'error.remoteExportRemoteIssueIdRequired',
      invalid_type_error: 'error.remoteExportRemoteIssueIdRequired',
    })
    .trim()
    .min(1, { message: 'error.remoteExportRemoteIssueIdRequired' }),
  remoteLogId: z
    .string({
      required_error: 'error.remoteExportRemoteLogIdRequired',
      invalid_type_error: 'error.remoteExportRemoteLogIdRequired',
    })
    .trim()
    .min(1, { message: 'error.remoteExportRemoteLogIdRequired' }),
  exportDurationSeconds: z
    .number({
      required_error: 'error.remoteExportDurationRequired',
      invalid_type_error: 'error.remoteExportDurationInvalid',
    })
    .int({ message: 'error.remoteExportDurationInvalid' })
    .positive({ message: 'error.remoteExportDurationInvalid' }),
  requiredFieldValues: z.record(z.string(), z.string()).default({}),
  entryIds: z
    .array(
      z
        .string({ invalid_type_error: 'error.remoteExportEntryIdsInvalid' })
        .uuid({ message: 'error.remoteExportEntryIdsInvalid' }),
    )
    .min(1, { message: 'error.remoteExportEntryIdsInvalid' }),
});

export type FinalizeRemoteExportDto = z.infer<typeof finalizeRemoteExportSchema>;

/** Successful finalization response, including known-result replay. */
export interface FinalizeRemoteExportResultDto {
  exportId: string;
  taskId: string;
  localDate: string;
  remoteIssueId: string;
  remoteLogId: string;
  exportDurationSeconds: number;
  requiredFieldValues: Record<string, string>;
  entryIds: string[];
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
  remoteSystemConfigId: z
    .string({
      required_error: 'error.remoteConfigIdRequired',
      invalid_type_error: 'error.remoteConfigIdRequired',
    })
    .uuid({ message: 'error.remoteConfigIdRequired' }),
});

export type ProxiedRemoteAccountDto = z.infer<typeof proxiedRemoteAccountSchema>;

export interface ProxiedRemoteAccountResponseDto {
  id: string;
  name: string;
}

/** Proxied same-day time-log context body. */
export const proxiedRemoteTimeLogsSchema = z.object({
  remoteSystemConfigId: z
    .string({
      required_error: 'error.remoteConfigIdRequired',
      invalid_type_error: 'error.remoteConfigIdRequired',
    })
    .uuid({ message: 'error.remoteConfigIdRequired' }),
  spentOn: isoDateSchema,
  workPackageIds: z
    .array(
      z
        .string({ invalid_type_error: 'error.remoteIssueIdRequired' })
        .min(1, { message: 'error.remoteIssueIdRequired' }),
    )
    .min(1, { message: 'error.remoteIssueIdRequired' }),
  userId: z.string().min(1).optional(),
});

export type ProxiedRemoteTimeLogsDto = z.infer<typeof proxiedRemoteTimeLogsSchema>;

export interface ProxiedRemoteTimeLogsResponseDto {
  logs: RemoteTimeLogDto[];
}

/** Proxied create-time-entry body. */
export const proxiedRemoteCreateTimeEntrySchema = z.object({
  remoteSystemConfigId: z
    .string({
      required_error: 'error.remoteConfigIdRequired',
      invalid_type_error: 'error.remoteConfigIdRequired',
    })
    .uuid({ message: 'error.remoteConfigIdRequired' }),
  remoteIssueId: z
    .string({
      required_error: 'error.remoteIssueIdRequired',
      invalid_type_error: 'error.remoteIssueIdRequired',
    })
    .min(1, { message: 'error.remoteIssueIdRequired' }),
  spentOn: isoDateSchema,
  durationSeconds: z
    .number({
      required_error: 'error.remoteExportDurationRequired',
      invalid_type_error: 'error.remoteExportDurationInvalid',
    })
    .int({ message: 'error.remoteExportDurationInvalid' })
    .positive({ message: 'error.remoteExportDurationInvalid' }),
  activityId: z
    .string({
      required_error: 'error.remoteExportActivityRequired',
      invalid_type_error: 'error.remoteExportActivityRequired',
    })
    .min(1, { message: 'error.remoteExportActivityRequired' }),
  comment: z.string().optional(),
});

export type ProxiedRemoteCreateTimeEntryDto = z.infer<typeof proxiedRemoteCreateTimeEntrySchema>;

export interface ProxiedRemoteCreateTimeEntryResponseDto {
  remoteLogId: string;
}
