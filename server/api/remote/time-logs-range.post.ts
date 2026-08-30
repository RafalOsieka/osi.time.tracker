import { REMOTE_SECRET_HEADER } from '../../../shared/config/remote-secret';
import {
  proxiedRemoteTimeLogsRangeSchema,
  type ProxiedRemoteTimeLogsRangeResponseDto,
} from '../../../shared/types/remote-export';
import { createServerRemoteAdapter } from '../../utils/remote/create-server-remote-adapter';
import { resolveOwnedTracker } from '../../utils/remote/resolve-owned-tracker';
import { RemoteAdapterError } from '../../../shared/types/remote-adapter';
import { toApiError } from '../../utils/remote/adapter-error';
import { readZodBody } from '../../utils/zod-input';
import type { ApiMessage } from '../../types/api-message';

/**
 * `server`-execution-mode date-range current-account time-log fetch.
 */
export default defineEventHandler(async (event): Promise<ProxiedRemoteTimeLogsRangeResponseDto> => {
  const { user } = await requireAuth(event);

  const secret = getRequestHeader(event, REMOTE_SECRET_HEADER);
  if (!secret) {
    throw createError({
      statusCode: 422,
      data: { messageKey: 'error.remoteServerModeSecretRequired' } satisfies ApiMessage,
    });
  }

  const parsedBody = await readZodBody(event, proxiedRemoteTimeLogsRangeSchema);

  const config = await resolveOwnedTracker(user.id, parsedBody.trackerId);
  const adapter = createServerRemoteAdapter(config, secret);

  try {
    const logs = await adapter.fetchTimeLogsInRange({
      from: parsedBody.from,
      to: parsedBody.to,
      userId: parsedBody.userId,
    });
    return { logs };
  } catch (err) {
    if (err instanceof RemoteAdapterError) {
      return toApiError(err);
    }
    throw err;
  }
});
