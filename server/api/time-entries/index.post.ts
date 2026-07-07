import { and, eq, isNull } from 'drizzle-orm';
import { ZodError } from 'zod';
import { startTimeEntrySchema } from '../../../shared/types/time-entry';
import type { StartTimeEntryDto, TimeEntryDto } from '../../../shared/types/time-entry';
import { db } from '../../db/index';
import { timeEntries } from '../../db/schema';
import { mapZodError } from '../../utils/zod-error';
import { resolveTaskId } from '../../utils/tasks';
import { toTimeEntryDto } from '../../utils/time-entries';
import type { ApiMessage } from '../../types/api-message';

export default defineEventHandler(async (event): Promise<TimeEntryDto> => {
  const { user } = await requireAuth(event);
  const body = await readBody(event);

  let parsedBody: StartTimeEntryDto;
  try {
    parsedBody = startTimeEntrySchema.parse(body);
  } catch (err: unknown) {
    if (err instanceof ZodError) {
      throw createError({
        statusCode: 422,
        data: mapZodError(err) satisfies ApiMessage,
      });
    }
    throw err;
  }

  const startedAt = new Date();

  const created = await db.transaction(async (tx) => {
    await tx
      .update(timeEntries)
      .set({ stoppedAt: startedAt, updatedAt: startedAt })
      .where(and(eq(timeEntries.userId, user.id), isNull(timeEntries.stoppedAt)));

    const taskId = await resolveTaskId(tx, user.id, parsedBody.title, parsedBody.projectId);

    const [row] = await tx
      .insert(timeEntries)
      .values({
        userId: user.id,
        taskId,
        startedAt,
        stoppedAt: null,
      })
      .returning();

    return row!;
  });

  return toTimeEntryDto(created);
});
