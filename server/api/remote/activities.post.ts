import { and, eq, isNull } from 'drizzle-orm';
import { ZodError } from 'zod';
import { REMOTE_PROXY_SECRET_HEADER } from '../../../shared/config/remote-proxy';
import { proxiedRemoteActivitiesSchema } from '../../../shared/types/remote-activities';
import type {
  ProxiedRemoteActivitiesDto,
  ProxiedRemoteActivitiesResponseDto,
} from '../../../shared/types/remote-activities';
import { db } from '../../db/index';
import { remoteSystemConfigs } from '../../db/schema';
import { proxyOpenProjectActivities } from '../../utils/remote-issue-proxy';
import { mapZodError } from '../../utils/zod-error';
import type { ApiMessage } from '../../types/api-message';

/**
 * Forwards a `proxied`-transport time-entry activities options request to
 * the caller's own configured tracker (REQ-TTR-117), mirroring
 * `/api/remote/search`: the target base URL is always derived server-side
 * from the authenticated user's owned, stored configuration.
 */
export default defineEventHandler(async (event): Promise<ProxiedRemoteActivitiesResponseDto> => {
  const { user } = await requireAuth(event);

  const secret = getRequestHeader(event, REMOTE_PROXY_SECRET_HEADER);
  if (!secret) {
    throw createError({
      statusCode: 422,
      data: { messageKey: 'error.remoteProxySecretRequired' } satisfies ApiMessage,
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

  const [config] = await db
    .select({ id: remoteSystemConfigs.id, baseUrl: remoteSystemConfigs.baseUrl })
    .from(remoteSystemConfigs)
    .where(
      and(
        eq(remoteSystemConfigs.id, parsedBody.remoteSystemConfigId),
        eq(remoteSystemConfigs.userId, user.id),
        isNull(remoteSystemConfigs.deletedAt),
      ),
    )
    .limit(1);

  if (!config) {
    throw createError({
      statusCode: 404,
      data: { messageKey: 'error.notFound' } satisfies ApiMessage,
    });
  }

  const options = await proxyOpenProjectActivities(config.baseUrl, secret);

  return { options };
});
