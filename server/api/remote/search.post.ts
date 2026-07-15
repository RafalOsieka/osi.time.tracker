import { and, eq, isNull } from 'drizzle-orm';
import { ZodError } from 'zod';
import { REMOTE_PROXY_SECRET_HEADER } from '../../../shared/config/remote-proxy';
import { proxiedRemoteIssueSearchSchema } from '../../../shared/types/remote-issue-ref';
import type {
  ProxiedRemoteIssueSearchDto,
  ProxiedRemoteIssueSearchResponseDto,
} from '../../../shared/types/remote-issue-ref';
import { db } from '../../db/index';
import { remoteSystemConfigs } from '../../db/schema';
import { proxyOpenProjectSearch } from '../../utils/remote-issue-proxy';
import { mapZodError } from '../../utils/zod-error';
import type { ApiMessage } from '../../types/api-message';

/**
 * Forwards a `proxied`-transport title-search or exact issue-ID lookup to
 * the caller's own configured tracker (REQ-TTR-111). The target base URL is
 * always derived server-side from the authenticated user's owned, stored
 * configuration; the client never supplies a target URL, and only the two
 * known adapter operations are forwarded (no generic pass-through).
 */
export default defineEventHandler(async (event): Promise<ProxiedRemoteIssueSearchResponseDto> => {
  const { user } = await requireAuth(event);

  const secret = getRequestHeader(event, REMOTE_PROXY_SECRET_HEADER);
  if (!secret) {
    throw createError({
      statusCode: 422,
      data: { messageKey: 'error.remoteProxySecretRequired' } satisfies ApiMessage,
    });
  }

  const body = await readBody(event);

  let parsedBody: ProxiedRemoteIssueSearchDto;
  try {
    parsedBody = proxiedRemoteIssueSearchSchema.parse(body);
  } catch (err: unknown) {
    if (err instanceof ZodError) {
      throw createError({
        statusCode: 422,
        data: mapZodError(err) satisfies ApiMessage,
      });
    }
    throw err;
  }

  const value = parsedBody.query.trim();
  if (parsedBody.mode === 'title' && value.length < 3) {
    throw createError({
      statusCode: 422,
      data: { messageKey: 'error.remoteIssueSearchTitleTooShort' } satisfies ApiMessage,
    });
  }
  if (parsedBody.mode === 'id' && value.length === 0) {
    throw createError({
      statusCode: 422,
      data: { messageKey: 'error.remoteIssueSearchIdInvalid' } satisfies ApiMessage,
    });
  }

  // Resolve the owned, active configuration server-side; a foreign/unknown
  // id is concealed as 404 without contacting any tracker.
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

  const results = await proxyOpenProjectSearch(config.baseUrl, secret, parsedBody.mode, value);

  return { results };
});
