import { and, eq, inArray, isNull } from 'drizzle-orm';
import { ZodError } from 'zod';
import { bulkAssignSchema } from '../../../shared/types/time-entry';
import type { BulkAssignDto } from '../../../shared/types/time-entry';
import { db } from '../../db/index';
import { timeEntries } from '../../db/schema';
import { mapZodError } from '../../utils/zod-error';
import { resolveTaskId } from '../../utils/tasks';
import type { ApiMessage } from '../../types/api-message';

export default defineEventHandler(async (event): Promise<{ success: true }> => {
  const { user } = await requireAuth(event);
  const body = await readBody(event);

  let parsedBody: BulkAssignDto;
  try {
    parsedBody = bulkAssignSchema.parse(body);
  } catch (err: unknown) {
    if (err instanceof ZodError) {
      throw createError({
        statusCode: 422,
        data: mapZodError(err) satisfies ApiMessage,
      });
    }
    throw err;
  }

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
