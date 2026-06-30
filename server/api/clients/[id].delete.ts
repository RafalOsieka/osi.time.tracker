import { db } from '../../db/index';
import { clients } from '../../db/schema';
import { eq, isNull, and } from 'drizzle-orm';
import type { ApiMessage } from '../../types/api-message';

export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event);
  const id = getRouterParam(event, 'id');

  // Verify ownership (404 for foreign/unknown id)
  const [existing] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.id, id!), eq(clients.userId, user.id), isNull(clients.deletedAt)))
    .limit(1);

  if (!existing) {
    throw createError({
      statusCode: 404,
      data: { messageKey: 'error.notFound' } satisfies ApiMessage,
    });
  }

  await db
    .update(clients)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(clients.id, id!), eq(clients.userId, user.id)));

  return { success: true };
});
