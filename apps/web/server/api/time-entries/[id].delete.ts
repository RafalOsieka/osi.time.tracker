import { and, eq } from 'drizzle-orm';
import { getDb } from '../../db/index';
import { timeEntries } from '../../db/schema';
import { deleteTaskIfEmpty } from '../../utils/tasks';
import type { ApiMessage } from '../../types/api-message';

export default defineEventHandler(async (event) => {
  const db = getDb();
  const { user } = await requireAuth(event);
  const id = getRouterParam(event, 'id');

  // Verify ownership (404 for foreign/unknown id)
  const [existing] = await db
    .select({ id: timeEntries.id, taskId: timeEntries.taskId })
    .from(timeEntries)
    .where(and(eq(timeEntries.id, id!), eq(timeEntries.userId, user.id)))
    .limit(1);

  if (!existing) {
    throw createError({
      statusCode: 404,
      data: { messageKey: 'error.notFound' } satisfies ApiMessage,
    });
  }

  await db.transaction(async (tx) => {
    await tx
      .delete(timeEntries)
      .where(and(eq(timeEntries.id, id!), eq(timeEntries.userId, user.id)));

    await deleteTaskIfEmpty(tx, user.id, existing.taskId);
  });

  return { success: true };
});
