import { and, eq } from 'drizzle-orm';
import { ZodError } from 'zod';
import { linkRemoteIssueSchema } from '../../../../shared/types/remote-issue-ref';
import type {
  LinkRemoteIssueDto,
  RemoteIssueRefDto,
} from '../../../../shared/types/remote-issue-ref';
import { db } from '../../../db/index';
import { tasks } from '../../../db/schema';
import { mapZodError } from '../../../utils/zod-error';
import {
  resolveActiveConfigForTask,
  upsertRemoteIssueRef,
  getRemoteIssueRefForTask,
} from '../../../utils/remote-issue-refs';
import type { ApiMessage } from '../../../types/api-message';

export default defineEventHandler(async (event): Promise<RemoteIssueRefDto> => {
  const { user } = await requireAuth(event);
  const taskId = getRouterParam(event, 'id');
  const body = await readBody(event);

  let parsedBody: LinkRemoteIssueDto;
  try {
    parsedBody = linkRemoteIssueSchema.parse(body);
  } catch (err: unknown) {
    if (err instanceof ZodError) {
      throw createError({
        statusCode: 422,
        data: mapZodError(err) satisfies ApiMessage,
      });
    }
    throw err;
  }

  // Verify ownership (404 for foreign/unknown id)
  const [existing] = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.id, taskId!), eq(tasks.userId, user.id)))
    .limit(1);

  if (!existing) {
    throw createError({
      statusCode: 404,
      data: { messageKey: 'error.notFound' } satisfies ApiMessage,
    });
  }

  const config = await resolveActiveConfigForTask(user.id, taskId!);

  if (!config) {
    throw createError({
      statusCode: 409,
      data: { messageKey: 'error.remoteIssueTaskNoConfig' } satisfies ApiMessage,
    });
  }

  await upsertRemoteIssueRef(
    user.id,
    taskId!,
    config.id,
    parsedBody.remoteIssueId,
    parsedBody.cachedTitle,
  );

  // Re-fetch through the batched helper so the response includes the derived
  // `url` (only present while the configuration remains active), matching the
  // enrichment applied to Task/Timer list responses.
  const saved = await getRemoteIssueRefForTask(user.id, taskId!);

  if (!saved) {
    throw createError({
      statusCode: 500,
      data: { messageKey: 'error.unknown' } satisfies ApiMessage,
    });
  }

  return saved;
});
