import { z } from 'zod';
import type { AdapterFieldOption } from '../utils/openproject-adapter';

/**
 * Request body accepted by the `proxied`-transport activities endpoint.
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
});

export type ProxiedRemoteActivitiesDto = z.infer<typeof proxiedRemoteActivitiesSchema>;

export interface ProxiedRemoteActivitiesResponseDto {
  options: AdapterFieldOption[];
}
