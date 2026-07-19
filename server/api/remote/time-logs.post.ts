import { and, eq, isNull } from 'drizzle-orm';
import { ZodError } from 'zod';
import { REMOTE_PROXY_SECRET_HEADER } from '../../../shared/config/remote-proxy';
import {
  proxiedRemoteTimeLogsSchema,
  type ProxiedRemoteTimeLogsDto,
  type ProxiedRemoteTimeLogsResponseDto,
} from '../../../shared/types/remote-export';
import { db } from '../../db/index';
import { remoteSystemConfigs } from '../../db/schema';
import { proxyOpenProjectTimeLogs } from '../../utils/remote-issue-proxy';
import { mapZodError } from '../../utils/zod-error';
import type { ApiMessage } from '../../types/api-message';

/**
 * Proxied same-day current-account time-log context fetch.
 */
export default defineEventHandler(async (event): Promise<ProxiedRemoteTimeLogsResponseDto> => {
  const { user } = await requireAuth(event);

  const secret = getRequestHeader(event, REMOTE_PROXY_SECRET_HEADER);
  if (!secret) {
    throw createError({
      statusCode: 422,
      data: { messageKey: 'error.remoteProxySecretRequired' } satisfies ApiMessage,
    });
  }

  const body = await readBody(event);
  let parsedBody: ProxiedRemoteTimeLogsDto;
  try {
    parsedBody = proxiedRemoteTimeLogsSchema.parse(body);
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

  const logs = await proxyOpenProjectTimeLogs(config.baseUrl, secret, {
    spentOn: parsedBody.spentOn,
    workPackageIds: parsedBody.workPackageIds,
    userId: parsedBody.userId,
  });

  return { logs };
});
