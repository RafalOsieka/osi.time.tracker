import { ZodError } from 'zod';
import { REMOTE_SECRET_HEADER } from '../../../shared/config/remote-secret';
import {
  proxiedRemoteCreateTimeEntrySchema,
  type ProxiedRemoteCreateTimeEntryDto,
  type ProxiedRemoteCreateTimeEntryResponseDto,
} from '../../../shared/types/remote-export';
import { createServerRemoteAdapter } from '../../utils/remote/create-server-remote-adapter';
import { resolveOwnedRemoteConfig } from '../../utils/remote/resolve-owned-config';
import { toApiError } from '../../utils/remote/adapter-error';
import { mapZodError } from '../../utils/zod-error';
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

    const body = await readBody(event);
    let parsedBody: ProxiedRemoteCreateTimeEntryDto;
    try {
      parsedBody = proxiedRemoteCreateTimeEntrySchema.parse(body);
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
      return await adapter.createTimeEntry({
        remoteIssueId: parsedBody.remoteIssueId,
        spentOn: parsedBody.spentOn,
        durationSeconds: parsedBody.durationSeconds,
        activityId: parsedBody.activityId,
        comment: parsedBody.comment,
      });
    } catch (err: unknown) {
      return toApiError(err);
    }
  },
);
