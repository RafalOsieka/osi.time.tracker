import { z } from 'zod';
import type {
  RemoteExecutionMode,
  RemoteRoundingRule,
  RemoteSystemType,
} from './remote-system-config';

/**
 * Explicit per-row state on the Remote Sync page, derived by a pure shared
 * function (`deriveRemoteSyncRowState`). `no_client`/`no_config`/
 * `system_not_implemented` render read-only with a stated reason;
 * `unlinked` is read-only but linkable; `manageable` exposes the editable
 * rounded duration and required-field controls. Activity load outcomes
 * (`activity_loading` / `activity_error` / `no_activity`) are applied by the
 * client after the static prerequisites resolve to manageable.
 */
export const remoteSyncRowStateSchema = z.enum([
  'no_client',
  'no_config',
  'system_not_implemented',
  'unlinked',
  'activity_loading',
  'activity_error',
  'no_activity',
  'manageable',
]);

export type RemoteSyncRowState = z.infer<typeof remoteSyncRowStateSchema>;

/**
 * Minimal config surface needed for row-state derivation and, on
 * manageable rows, for rounding and required-field pre-fill. Never carries
 * credential material.
 */
export interface RemoteSyncConfigSurfaceDto {
  id: string;
  systemType: RemoteSystemType;
  baseUrl: string;
  executionMode: RemoteExecutionMode;
  roundingRule: RemoteRoundingRule;
  requiredFieldDefaults: Record<string, string>;
}

/** A `RemoteIssueRefDto` shorn down to the fields the Remote Sync page needs. */
export interface RemoteSyncIssueRefDto {
  remoteIssueId: string;
  cachedTitle: string;
}

/** One completed local time entry under a day-review task row (REQ-TTR-120). */
export interface RemoteSyncDayEntryDto {
  id: string;
  startedAt: string;
  stoppedAt: string;
  durationSeconds: number;
  /** True when at least one prior finalized export included this entry. */
  previouslyExported: boolean;
}

/**
 * Append-only provenance for one successfully finalized remote log on this
 * task/day (REQ-TTR-122). Multiple records per task/day are allowed.
 */
export interface RemoteSyncExportProvenanceDto {
  exportId: string;
  remoteLogId: string;
  remoteIssueId: string;
  exportDurationSeconds: number;
  requiredFieldValues: Record<string, string>;
  entryIds: string[];
  createdAt: string;
}

export interface RemoteSyncDayRowDto {
  taskId: string;
  taskName: string;
  projectName: string | null;
  clientName: string | null;
  totalSeconds: number;
  config: RemoteSyncConfigSurfaceDto | null;
  issueRef: RemoteSyncIssueRefDto | null;
  /** Completed entries attributed to this task on the requested local day. */
  entries: RemoteSyncDayEntryDto[];
  /** Prior finalized exports for this task on the requested local day. */
  exports: RemoteSyncExportProvenanceDto[];
}

/** The day-review aggregate returned by `GET /api/sync/day`. */
export interface RemoteSyncDayDto {
  date: string;
  rows: RemoteSyncDayRowDto[];
  untitledTotalSeconds: number;
}

export const remoteSyncDayQuerySchema = z.object({
  date: z
    .string({
      required_error: 'error.remoteSyncDateRequired',
      invalid_type_error: 'error.remoteSyncDateRequired',
    })
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'error.remoteSyncDateInvalid' })
    .refine((value) => !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime()), {
      message: 'error.remoteSyncDateInvalid',
    }),
});

export type RemoteSyncDayQuery = z.infer<typeof remoteSyncDayQuerySchema>;

/** Input to `deriveRemoteSyncRowState`, the pure precedence-ordered state mapping. */
export interface RemoteSyncRowStateInput {
  hasProject: boolean;
  hasClient: boolean;
  config: { systemType: RemoteSystemType } | null;
  hasIssueRef: boolean;
  /**
   * Optional activity-fetch outcome applied only after static prerequisites
   * resolve to a linked, implemented configuration. Omitted/undefined leaves
   * the static mapping unchanged (typically `manageable`).
   */
  activityStatus?: 'loading' | 'error' | 'empty' | 'available';
}
