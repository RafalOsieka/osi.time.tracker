import { and, eq } from 'drizzle-orm';
import {
  updateTimeEntrySchema,
  TIME_ENTRY_CLOCK_SKEW_TOLERANCE_MS,
} from '../../../shared/types/time-entry';
import type { TimeEntryDto } from '../../../shared/types/time-entry';
import { getDb } from '../../db/index';
import { timeEntries, tasks } from '../../db/schema';
import { resolveTaskId } from '../../utils/tasks';
import { toTimeEntryDto } from '../../utils/time-entries';
import { readZodBody } from '../../utils/zod-input';
import type { ApiMessage } from '../../types/api-message';

export default defineEventHandler(async (event): Promise<TimeEntryDto> => {
  const db = getDb();
  const { user } = await requireAuth(event);
  const id = getRouterParam(event, 'id');
  const parsedBody = await readZodBody(event, updateTimeEntrySchema);

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
  if (parsedBody.startedAt !== undefined && parsedBody.startedAt !== null) {
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
    if (parsedBody.taskId !== undefined && parsedBody.taskId !== null) {
      const [ownedTask] = await tx
        .select({ id: tasks.id })
        .from(tasks)
        .where(and(eq(tasks.id, parsedBody.taskId), eq(tasks.userId, user.id)))
        .limit(1);
      if (!ownedTask) {
        throw createError({
          statusCode: 404,
          data: { messageKey: 'error.notFound' } satisfies ApiMessage,
        });
      }
      taskId = ownedTask.id;
    } else if (parsedBody.title !== undefined || parsedBody.projectId !== undefined) {
      let title = parsedBody.title;
      let projectId = parsedBody.projectId;
      if (existing.taskId && (title === undefined || projectId === undefined)) {
        const [currentTask] = await tx
          .select({ name: tasks.name, projectId: tasks.projectId })
          .from(tasks)
          .where(eq(tasks.id, existing.taskId))
          .limit(1);
        if (title === undefined) title = currentTask?.name;
        if (projectId === undefined) projectId = currentTask?.projectId;
      }

      taskId = await resolveTaskId(tx, user.id, title, projectId);
    }

    type TimeEntryPatch = {
      taskId: typeof taskId;
      updatedAt: Date;
      stoppedAt?: Date | null;
      startedAt?: Date;
    };
    const patch: TimeEntryPatch = {
      taskId,
      updatedAt: new Date(),
    };
    if (stoppedAt !== undefined) patch.stoppedAt = stoppedAt;
    if (startedAt !== undefined) patch.startedAt = startedAt;

    const [row] = await tx
      .update(timeEntries)
      .set(patch)
      .where(and(eq(timeEntries.id, id!), eq(timeEntries.userId, user.id)))
      .returning();

    return row!;
  });

  return toTimeEntryDto(updated);
});
