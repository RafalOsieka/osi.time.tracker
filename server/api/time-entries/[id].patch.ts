import { and, eq } from 'drizzle-orm';
import { ZodError } from 'zod';
import {
  updateTimeEntrySchema,
  TIME_ENTRY_CLOCK_SKEW_TOLERANCE_MS,
} from '../../../shared/types/time-entry';
import type { UpdateTimeEntryDto, TimeEntryDto } from '../../../shared/types/time-entry';
import { db } from '../../db/index';
import { timeEntries, tasks } from '../../db/schema';
import { mapZodError } from '../../utils/zod-error';
import { resolveTaskId } from '../../utils/tasks';
import { toTimeEntryDto } from '../../utils/time-entries';
import type { ApiMessage } from '../../types/api-message';

export default defineEventHandler(async (event): Promise<TimeEntryDto> => {
  const { user } = await requireAuth(event);
  const id = getRouterParam(event, 'id');
  const body = await readBody(event);

  let parsedBody: UpdateTimeEntryDto;
  try {
    parsedBody = updateTimeEntrySchema.parse(body);
  } catch (err: unknown) {
    if (err instanceof ZodError) {
      throw createError({
        statusCode: 422,
        data: mapZodError(err) satisfies ApiMessage,
      });
    }
    throw err;
  }

  const [existing] = await db
    .select()
    .from(timeEntries)
    .where(and(eq(timeEntries.id, id!), eq(timeEntries.userId, user.id)))
    .limit(1);

  if (!existing) {
    throw createError({
      statusCode: 404,
      data: { messageKey: 'error.notFound' } satisfies ApiMessage,
    });
  }

  let stoppedAt: Date | null | undefined;
  if (parsedBody.stoppedAt !== undefined) {
    stoppedAt = parsedBody.stoppedAt === null ? null : new Date(parsedBody.stoppedAt);
  }

  let startedAt: Date | undefined;
  if (parsedBody.startedAt !== undefined) {
    startedAt = new Date(parsedBody.startedAt);
  }

  const effectiveStartedAt = startedAt ?? existing.startedAt;
  const effectiveStoppedAt = stoppedAt !== undefined ? stoppedAt : existing.stoppedAt;

  if (effectiveStoppedAt !== null && effectiveStartedAt > effectiveStoppedAt) {
    throw createError({
      statusCode: 422,
      data: { messageKey: 'error.timeEntryStoppedBeforeStarted' } satisfies ApiMessage,
    });
  }

  if (
    effectiveStoppedAt === null &&
    effectiveStartedAt.getTime() > Date.now() + TIME_ENTRY_CLOCK_SKEW_TOLERANCE_MS
  ) {
    throw createError({
      statusCode: 422,
      data: { messageKey: 'error.timeEntryStartedAtInFuture' } satisfies ApiMessage,
    });
  }

  const updated = await db.transaction(async (tx) => {
    let taskId = existing.taskId;
    if (parsedBody.title !== undefined || parsedBody.projectId !== undefined) {
      let title = parsedBody.title;
      if (title === undefined && existing.taskId) {
        const [currentTask] = await tx
          .select({ name: tasks.name })
          .from(tasks)
          .where(eq(tasks.id, existing.taskId))
          .limit(1);
        title = currentTask?.name;
      }

      taskId = await resolveTaskId(tx, user.id, title, parsedBody.projectId);
    }

    const [row] = await tx
      .update(timeEntries)
      .set({
        taskId,
        ...(stoppedAt !== undefined ? { stoppedAt } : {}),
        ...(startedAt !== undefined ? { startedAt } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(timeEntries.id, id!), eq(timeEntries.userId, user.id)))
      .returning();

    return row!;
  });

  return toTimeEntryDto(updated);
});
