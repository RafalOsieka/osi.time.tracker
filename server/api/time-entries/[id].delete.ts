import { and, eq, ne } from 'drizzle-orm';
import { db } from '../../db/index';
import { timeEntries, tasks } from '../../db/schema';
import type { ApiMessage } from '../../types/api-message';

export default defineEventHandler(async (event) => {
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

    if (existing.taskId) {
      const [otherEntry] = await tx
        .select({ id: timeEntries.id })
        .from(timeEntries)
        .where(and(eq(timeEntries.taskId, existing.taskId), ne(timeEntries.id, id!)))
        .limit(1);

      if (!otherEntry) {
        await tx.delete(tasks).where(and(eq(tasks.id, existing.taskId), eq(tasks.userId, user.id)));
      }
    }
  });

  return { success: true };
});
