import { z } from 'zod';
import { remoteIssueSearchModeSchema } from '@osi/remote-trackers/contracts';

/**
 * Client-side form schema for the remote issue picker popover (mode + query).
 * Business validation (e.g. title min length) stays in the search composable.
 */
export const remoteIssuePickerFormSchema = z.object({
  mode: remoteIssueSearchModeSchema,
  query: z.string({ error: 'error.remoteIssueSearchQueryRequired' }),
});

export type RemoteIssuePickerFormDto = z.infer<typeof remoteIssuePickerFormSchema>;

/**
 * Request body accepted by the link endpoint. Only the remote issue id and
 * cached title (from the search result) are accepted from the client; Task
 * ownership and the Project -> active tracker provenance are derived
 * server-side (REQ-106), never accepted from the request body.
 */
export const linkRemoteIssueSchema = z.object({
  remoteIssueId: z
    .string({ error: 'error.remoteIssueIdRequired' })
    .trim()
    .min(1, { error: 'error.remoteIssueIdRequired' }),
  cachedTitle: z
    .string({ error: 'error.remoteIssueTitleRequired' })
    .trim()
    .min(1, { error: 'error.remoteIssueTitleRequired' }),
});

export type LinkRemoteIssueDto = z.infer<typeof linkRemoteIssueSchema>;

/**
 * Persisted remote issue reference DTO. `url` is included only when the
 * reference's `trackerId` currently points to an active (non-soft-deleted)
 * tracker; otherwise it is omitted and only the cached id/title remain
 * available as provenance.
 */
export interface RemoteIssueRefDto {
  id: string;
  taskId: string;
  userId: string;
  trackerId: string;
  remoteIssueId: string;
  cachedTitle: string;
  cachedRemoteProjectTitle?: string;
  url?: string;
  createdAt: string;
  updatedAt: string;
}
