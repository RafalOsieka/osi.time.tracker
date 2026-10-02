import { and, eq } from 'drizzle-orm';
import { getDb } from '../../db/index';
import { reportPresets } from '../../db/schema';
import type { ApiMessage } from '../../types/api-message';

export default defineEventHandler(async (event): Promise<{ success: true }> => {
  const db = getDb();
  const { user } = await requireAuth(event);
  const id = getRouterParam(event, 'id');

  // Tracker rows cascade with the preset (REQ-383).
  const deleted = await db
    .delete(reportPresets)
    .where(and(eq(reportPresets.id, id!), eq(reportPresets.userId, user.id)))
    .returning({ id: reportPresets.id });

  if (deleted.length === 0) {
    throw createError({
      statusCode: 404,
      data: { messageKey: 'error.notFound' } satisfies ApiMessage,
    });
  }

  return { success: true };
});
