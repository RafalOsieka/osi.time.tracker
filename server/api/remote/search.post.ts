import { ZodError } from 'zod';
import { REMOTE_SECRET_HEADER } from '../../../shared/config/remote-secret';
import { proxiedRemoteIssueSearchSchema } from '../../../shared/types/remote-issue-ref';
import type {
  ProxiedRemoteIssueSearchDto,
  ProxiedRemoteIssueSearchResponseDto,
} from '../../../shared/types/remote-issue-ref';
import { createServerRemoteAdapter } from '../../utils/remote/create-server-remote-adapter';
import { resolveOwnedRemoteConfig } from '../../utils/remote/resolve-owned-config';
import { toApiError } from '../../utils/remote/adapter-error';
import { mapZodError } from '../../utils/zod-error';
import type { ApiMessage } from '../../types/api-message';

/**
 * `server`-execution-mode title-search / exact issue-ID lookup (REQ-108).
 * The target base URL is always derived server-side from the authenticated
 * user's owned, stored configuration; only the two known adapter operations
 * are forwarded (no generic pass-through), delegating to the same provider
 * adapter used in `client` execution mode so quirks and error classification
 * stay identical.
 */
export default defineEventHandler(async (event): Promise<ProxiedRemoteIssueSearchResponseDto> => {
  const { user } = await requireAuth(event);

  const secret = getRequestHeader(event, REMOTE_SECRET_HEADER);
  if (!secret) {
    throw createError({
      statusCode: 422,
      data: { messageKey: 'error.remoteServerModeSecretRequired' } satisfies ApiMessage,
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

  const config = await resolveOwnedRemoteConfig(user.id, parsedBody.remoteSystemConfigId);
  const adapter = createServerRemoteAdapter(config, secret);

  try {
    if (parsedBody.mode === 'id') {
      const result = await adapter.getIssueById(value);
      if (!result) {
        throw createError({
          statusCode: 404,
          data: { messageKey: 'error.remoteIssueSearchNotFound' } satisfies ApiMessage,
        });
      }
      return { results: [result] };
    }
    return { results: await adapter.searchIssues(value) };
  } catch (err: unknown) {
    return toApiError(err);
  }
});
