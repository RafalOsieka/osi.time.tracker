import { ZodError } from 'zod';
import { REMOTE_SECRET_HEADER } from '../../../shared/config/remote-secret';
import {
  proxiedRemoteTimeLogsSchema,
  type ProxiedRemoteTimeLogsDto,
  type ProxiedRemoteTimeLogsResponseDto,
} from '../../../shared/types/remote-export';
import { createServerRemoteAdapter } from '../../utils/remote/create-server-remote-adapter';
import { resolveOwnedTracker } from '../../utils/remote/resolve-owned-tracker';
import { RemoteAdapterError } from '../../../shared/types/remote-adapter';
import { toApiError } from '../../utils/remote/adapter-error';
import { mapZodError } from '../../utils/zod-error';
import type { ApiMessage } from '../../types/api-message';

/**
 * `server`-execution-mode same-day current-account time-log context fetch.
 */
export default defineEventHandler(async (event): Promise<ProxiedRemoteTimeLogsResponseDto> => {
  const { user } = await requireAuth(event);

  const secret = getRequestHeader(event, REMOTE_SECRET_HEADER);
  if (!secret) {
    throw createError({
      statusCode: 422,
      data: { messageKey: 'error.remoteServerModeSecretRequired' } satisfies ApiMessage,
    });
  }

  const body = await readBody(event);
  let parsedBody: ProxiedRemoteTimeLogsDto;
  try {
    parsedBody = proxiedRemoteTimeLogsSchema.parse(body);
  } catch (err) {
    if (err instanceof ZodError) {
      throw createError({
        statusCode: 422,
        data: mapZodError(err) satisfies ApiMessage,
      });
    }
    throw err;
  }

  const config = await resolveOwnedTracker(user.id, parsedBody.trackerId);
  const adapter = createServerRemoteAdapter(config, secret);

  try {
    const logs = await adapter.fetchTimeLogs({
      spentOn: parsedBody.spentOn,
      workPackageIds: parsedBody.workPackageIds,
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
