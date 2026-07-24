import { and, eq, inArray, isNull } from 'drizzle-orm';
import { ZodError } from 'zod';
import { reassignTimeEntriesSchema } from '../../../shared/types/time-entry';
import type { ReassignTimeEntriesDto, TimeEntryDto } from '../../../shared/types/time-entry';
import { db } from '../../db/index';
import { timeEntries, tasks, projects } from '../../db/schema';
import { mapZodError } from '../../utils/zod-error';
import { resolveTaskId } from '../../utils/tasks';
import { toTimeEntryDto } from '../../utils/time-entries';
import type { ApiMessage } from '../../types/api-message';

export default defineEventHandler(async (event): Promise<TimeEntryDto[]> => {
  const { user } = await requireAuth(event);
  const body = await readBody(event);

  let parsedBody: ReassignTimeEntriesDto;
  try {
    parsedBody = reassignTimeEntriesSchema.parse(body);
  } catch (err: unknown) {
    if (err instanceof ZodError) {
      throw createError({
        statusCode: 422,
        data: mapZodError(err) satisfies ApiMessage,
      });
    }
    throw err;
  }

  const updatedRows = await db.transaction(async (tx) => {
    const rows = await tx
      .select({
        id: timeEntries.id,
        taskId: timeEntries.taskId,
      })
      .from(timeEntries)
      .where(and(inArray(timeEntries.id, parsedBody.ids), eq(timeEntries.userId, user.id)));

    const foundIds = new Set(rows.map((row) => row.id));
    if (!parsedBody.ids.every((id) => foundIds.has(id))) {
      throw createError({
        statusCode: 404,
        data: { messageKey: 'error.notFound' } satisfies ApiMessage,
      });
    }

    const sourceTaskIds = [...new Set(rows.map((row) => row.taskId).filter(Boolean))] as string[];
    const sourceTaskId = sourceTaskIds[0] ?? null;

    let sourceName: string | null = null;
    let sourceProjectId: string | null = null;
    if (sourceTaskId) {
      const [sourceTask] = await tx
        .select({ name: tasks.name, projectId: tasks.projectId })
        .from(tasks)
        .where(and(eq(tasks.id, sourceTaskId), eq(tasks.userId, user.id)))
        .limit(1);
      sourceName = sourceTask?.name ?? null;
      sourceProjectId = sourceTask?.projectId ?? null;
    }

    const effectiveName = parsedBody.name ?? sourceName;
    if (!effectiveName) {
      throw createError({
        statusCode: 422,
        data: { messageKey: 'error.timeEntryTitleInvalid' } satisfies ApiMessage,
      });
    }

    let effectiveProjectId: string | null;
    if (parsedBody.projectId === undefined) {
      effectiveProjectId = sourceProjectId;
    } else {
      effectiveProjectId = parsedBody.projectId;
    }

    if (effectiveProjectId !== null) {
      const [ownedProject] = await tx
        .select({ id: projects.id })
        .from(projects)
        .where(
          and(
            eq(projects.id, effectiveProjectId),
            eq(projects.userId, user.id),
            isNull(projects.deletedAt),
          ),
        )
        .limit(1);
      // Allow soft-deleted current project when projectId was omitted (keep scope).
      if (!ownedProject && parsedBody.projectId !== undefined) {
        throw createError({
          statusCode: 404,
          data: { messageKey: 'error.notFound' } satisfies ApiMessage,
        });
      }
    }

    const targetTaskId = await resolveTaskId(tx, user.id, effectiveName, effectiveProjectId);
    if (!targetTaskId) {
      throw createError({
        statusCode: 422,
        data: { messageKey: 'error.timeEntryTitleInvalid' } satisfies ApiMessage,
      });
    }

    const now = new Date();
    const updated = await tx
      .update(timeEntries)
      .set({ taskId: targetTaskId, updatedAt: now })
      .where(and(inArray(timeEntries.id, parsedBody.ids), eq(timeEntries.userId, user.id)))
      .returning();

    // Garbage-collect any emptied source tasks (excluding the target).
    for (const emptiedTaskId of sourceTaskIds) {
      if (emptiedTaskId === targetTaskId) continue;
      const [remaining] = await tx
        .select({ id: timeEntries.id })
        .from(timeEntries)
        .where(eq(timeEntries.taskId, emptiedTaskId))
        .limit(1);
      if (!remaining) {
        await tx.delete(tasks).where(and(eq(tasks.id, emptiedTaskId), eq(tasks.userId, user.id)));
      }
    }

    return updated;
  });

  return Promise.all(updatedRows.map((row) => toTimeEntryDto(row)));
});
