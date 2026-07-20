import { ZodError } from 'zod';
import { REMOTE_SECRET_HEADER } from '../../../shared/config/remote-secret';
import { proxiedRemoteActivitiesSchema } from '../../../shared/types/remote-activities';
import type {
  ProxiedRemoteActivitiesDto,
  ProxiedRemoteActivitiesResponseDto,
} from '../../../shared/types/remote-activities';
import { createServerRemoteAdapter } from '../../utils/remote/create-server-remote-adapter';
import { resolveOwnedRemoteConfig } from '../../utils/remote/resolve-owned-config';
import { toApiError } from '../../utils/remote/adapter-error';
import { mapZodError } from '../../utils/zod-error';
import type { ApiMessage } from '../../types/api-message';

/**
 * `server`-execution-mode time-entry activities options request
 * (REQ-114), mirroring `/api/remote/search`: the target base URL is
 * always derived server-side from the authenticated user's owned, stored
 * configuration.
 */
export default defineEventHandler(async (event): Promise<ProxiedRemoteActivitiesResponseDto> => {
  const { user } = await requireAuth(event);

  const secret = getRequestHeader(event, REMOTE_SECRET_HEADER);
  if (!secret) {
    throw createError({
      statusCode: 422,
      data: { messageKey: 'error.remoteServerModeSecretRequired' } satisfies ApiMessage,
    });
  }

  const body = await readBody(event);

  let parsedBody: ProxiedRemoteActivitiesDto;
  try {
    parsedBody = proxiedRemoteActivitiesSchema.parse(body);
  } catch (err: unknown) {
    if (err instanceof ZodError) {
      throw createError({
        statusCode: 422,
        data: mapZodError(err) satisfies ApiMessage,
      });
    }
    throw err;
  }

  const config = await resolveOwnedRemoteConfig(user.id, parsedBody.remoteSystemConfigId);
  const adapter = createServerRemoteAdapter(config, secret);

  try {
    return { options: await adapter.getActivityOptions(parsedBody.remoteIssueId) };
  } catch (err: unknown) {
    return toApiError(err);
  }
});
