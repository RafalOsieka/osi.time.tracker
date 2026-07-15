import { z } from 'zod';
import type {
  RemoteRoundingRule,
  RemoteSystemType,
  RemoteTransportMode,
} from './remote-system-config';

/**
 * Explicit per-row state on the Remote Sync page, derived by a pure shared
 * function (`deriveRemoteSyncRowState`). `no_client`/`no_config`/
 * `system_not_implemented` render read-only with a stated reason;
 * `unlinked` is read-only but linkable; `manageable` exposes the editable
 * rounded duration and required-field controls.
 */
export const remoteSyncRowStateSchema = z.enum([
  'no_client',
  'no_config',
  'system_not_implemented',
  'unlinked',
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
  transportMode: RemoteTransportMode;
  roundingRule: RemoteRoundingRule;
  requiredFieldDefaults: Record<string, string>;
}

/** A `RemoteIssueRefDto` shorn down to the fields the Remote Sync page needs. */
export interface RemoteSyncIssueRefDto {
  remoteIssueId: string;
  cachedTitle: string;
}

export interface RemoteSyncDayRowDto {
  taskId: string;
  taskName: string;
  projectName: string | null;
  clientName: string | null;
  totalSeconds: number;
  config: RemoteSyncConfigSurfaceDto | null;
  issueRef: RemoteSyncIssueRefDto | null;
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
}
