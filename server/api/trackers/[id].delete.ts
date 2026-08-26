import { getDb } from '../../db/index';
import { trackers } from '../../db/schema';
import { eq, isNull, and } from 'drizzle-orm';
import type { ApiMessage } from '../../types/api-message';

export default defineEventHandler(async (event) => {
  const db = getDb();
  const { user } = await requireAuth(event);
  const id = getRouterParam(event, 'id');

  const [existing] = await db
    .select({ id: trackers.id })
    .from(trackers)
    .where(and(eq(trackers.id, id!), eq(trackers.userId, user.id), isNull(trackers.deletedAt)))
    .limit(1);

  if (!existing) {
    throw createError({
      statusCode: 404,
      data: { messageKey: 'error.notFound' } satisfies ApiMessage,
    });
  }

  await db
    .update(trackers)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(trackers.id, id!), eq(trackers.userId, user.id)));

  return { success: true };
});
