import { z } from 'zod';
import type { RemoteFieldOption } from './remote-field-option';

/**
 * Request body accepted by the `server`-execution-mode activities endpoint.
 * Mirrors `proxiedRemoteIssueSearchSchema`: the client identifies only the
 * owned configuration, and the server derives the target tracker base URL
 * server-side.
 */
export const proxiedRemoteActivitiesSchema = z.object({
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
});

export type ProxiedRemoteActivitiesDto = z.infer<typeof proxiedRemoteActivitiesSchema>;

export interface ProxiedRemoteActivitiesResponseDto {
  options: RemoteFieldOption[];
}
