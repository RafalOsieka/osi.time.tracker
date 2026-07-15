import { and, eq } from 'drizzle-orm';
import { db } from '../../../db/index';
import { tasks } from '../../../db/schema';
import { unlinkRemoteIssueRef } from '../../../utils/remote-issue-refs';
import type { ApiMessage } from '../../../types/api-message';

export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event);
  const taskId = getRouterParam(event, 'id');

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

  await unlinkRemoteIssueRef(user.id, taskId!);

  return { success: true };
});
