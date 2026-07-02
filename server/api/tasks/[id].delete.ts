import { db } from '../../db/index';
import { tasks } from '../../db/schema';
import { eq, isNull, and } from 'drizzle-orm';
import type { ApiMessage } from '../../types/api-message';

export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event);
  const id = getRouterParam(event, 'id');

  // Verify ownership (404 for foreign/unknown id)
  const [existing] = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.id, id!), eq(tasks.userId, user.id), isNull(tasks.deletedAt)))
    .limit(1);

  if (!existing) {
    throw createError({
      statusCode: 404,
      data: { messageKey: 'error.notFound' } satisfies ApiMessage,
    });
  }

  await db
    .update(tasks)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(tasks.id, id!), eq(tasks.userId, user.id)));

  return { success: true };
});
