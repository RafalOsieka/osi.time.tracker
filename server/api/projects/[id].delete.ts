import { db } from '../../db/index';
import { projects } from '../../db/schema';
import { eq, isNull, and } from 'drizzle-orm';
import type { ApiMessage } from '../../types/api-message';

export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event);
  const id = getRouterParam(event, 'id');

  // Verify ownership (404 for foreign/unknown id)
  const [existing] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, id!), eq(projects.userId, user.id), isNull(projects.deletedAt)))
    .limit(1);

  if (!existing) {
    throw createError({
      statusCode: 404,
      data: { messageKey: 'error.notFound' } satisfies ApiMessage,
    });
  }

  await db
    .update(projects)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(projects.id, id!), eq(projects.userId, user.id)));

  return { success: true };
});
