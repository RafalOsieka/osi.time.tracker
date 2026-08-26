import { and, eq, inArray, isNull } from 'drizzle-orm';
import { bulkAssignSchema } from '../../../shared/types/time-entry';
import { getDb } from '../../db/index';
import { timeEntries } from '../../db/schema';
import { resolveTaskId } from '../../utils/tasks';
import { readZodBody } from '../../utils/zod-input';
import type { ApiMessage } from '../../types/api-message';

export default defineEventHandler(async (event): Promise<{ success: true }> => {
  const db = getDb();
  const { user } = await requireAuth(event);
  const parsedBody = await readZodBody(event, bulkAssignSchema);

  await db.transaction(async (tx) => {
    const rows = await tx
      .select({ id: timeEntries.id, taskId: timeEntries.taskId })
      .from(timeEntries)
      .where(and(inArray(timeEntries.id, parsedBody.ids), eq(timeEntries.userId, user.id)));

    // All-or-nothing: every id must belong to the user, exist, and currently
    // be untitled (no task) or the whole operation fails with no partial writes.
    const foundIds = new Set(rows.map((row) => row.id));
    const allFoundAndUntitled =
      parsedBody.ids.every((id) => foundIds.has(id)) && rows.every((row) => row.taskId === null);

    if (!allFoundAndUntitled) {
      throw createError({
        statusCode: 422,
        data: { messageKey: 'error.timeEntryBulkAssignInvalid' } satisfies ApiMessage,
      });
    }

    const taskId = await resolveTaskId(tx, user.id, parsedBody.title, parsedBody.projectId);

    await tx
      .update(timeEntries)
      .set({ taskId, updatedAt: new Date() })
      .where(
        and(
          inArray(timeEntries.id, parsedBody.ids),
          eq(timeEntries.userId, user.id),
          isNull(timeEntries.taskId),
        ),
      );
  });

  return { success: true };
});
