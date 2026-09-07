import { z } from 'zod';
import type { RemoteFieldOption } from './remote-field-option';

/**
 * Request body accepted by the `server`-execution-mode activities endpoint.
 * Mirrors `proxiedRemoteIssueSearchSchema`: the client identifies only the
 * owned tracker, and the server derives the target tracker base URL
 * server-side.
 */
export const proxiedRemoteActivitiesSchema = z.object({
  trackerId: z.uuid({ error: 'error.trackerIdRequired' }),
  remoteIssueId: z
    .string({ error: 'error.remoteIssueIdRequired' })
    .min(1, { error: 'error.remoteIssueIdRequired' }),
});

export type ProxiedRemoteActivitiesDto = z.infer<typeof proxiedRemoteActivitiesSchema>;

export interface ProxiedRemoteActivitiesResponseDto {
  options: RemoteFieldOption[];
}
