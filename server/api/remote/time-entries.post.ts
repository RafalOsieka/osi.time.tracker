import { REMOTE_SECRET_HEADER } from '../../../shared/config/remote-secret';
import {
  proxiedRemoteCreateTimeEntrySchema,
  type ProxiedRemoteCreateTimeEntryResponseDto,
} from '../../../shared/types/remote-export';
import { createServerRemoteAdapter } from '../../utils/remote/create-server-remote-adapter';
import { resolveOwnedTracker } from '../../utils/remote/resolve-owned-tracker';
import { RemoteAdapterError } from '../../../shared/types/remote-adapter';
import { toApiError } from '../../utils/remote/adapter-error';
import { readZodBody } from '../../utils/zod-input';
import type { ApiMessage } from '../../types/api-message';

/**
 * `server`-execution-mode time-entry creation for browser-orchestrated export.
 */
export default defineEventHandler(
  async (event): Promise<ProxiedRemoteCreateTimeEntryResponseDto> => {
    const { user } = await requireAuth(event);

    const secret = getRequestHeader(event, REMOTE_SECRET_HEADER);
    if (!secret) {
      throw createError({
        statusCode: 422,
        data: { messageKey: 'error.remoteServerModeSecretRequired' } satisfies ApiMessage,
      });
    }

    const parsedBody = await readZodBody(event, proxiedRemoteCreateTimeEntrySchema);

    const config = await resolveOwnedTracker(user.id, parsedBody.trackerId);
    const adapter = createServerRemoteAdapter(config, secret);

    try {
      return await adapter.createTimeEntry({
        remoteIssueId: parsedBody.remoteIssueId,
        spentOn: parsedBody.spentOn,
        durationSeconds: parsedBody.durationSeconds,
        activityId: parsedBody.activityId,
        comment: parsedBody.comment,
      });
    } catch (err) {
      if (err instanceof RemoteAdapterError) {
        return toApiError(err);
      }
      throw err;
    }
  },
);
