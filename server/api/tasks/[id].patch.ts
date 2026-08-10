import { and, eq, isNull, ne } from 'drizzle-orm';
import { ZodError } from 'zod';
import { updateTaskSchema } from '../../../shared/types/task';
import type { UpdateTaskDto, TaskDto } from '../../../shared/types/task';
import { db } from '../../db/index';
import { tasks, projects, timeEntries } from '../../db/schema';
import { mapZodError } from '../../utils/zod-error';
import { getRemoteIssueRefForTask } from '../../utils/remote-issue-refs';
import type { ApiMessage } from '../../types/api-message';

export default defineEventHandler(async (event): Promise<TaskDto> => {
  const { user } = await requireAuth(event);
  const id = getRouterParam(event, 'id');
  const body = await readBody(event);

  let parsedBody: UpdateTaskDto;
  try {
    parsedBody = updateTaskSchema.parse(body);
  } catch (err: unknown) {
    if (err instanceof ZodError) {
      throw createError({
        statusCode: 422,
        data: mapZodError(err) satisfies ApiMessage,
      });
    }
    throw err;
  }

  // Verify ownership (404 for foreign/unknown id). Capture the unchanged
  // remoteIssueId so collision scope includes it (REQ-134).
  const [existing] = await db
    .select({
      id: tasks.id,
      projectId: tasks.projectId,
      remoteIssueId: tasks.remoteIssueId,
    })
    .from(tasks)
    .where(and(eq(tasks.id, id!), eq(tasks.userId, user.id)))
    .limit(1);

  if (!existing) {
    throw createError({
      statusCode: 404,
      data: { messageKey: 'error.notFound' } satisfies ApiMessage,
    });
  }

  // An omitted projectId keeps the current project, an explicit null clears
  // it, and a provided uuid assigns it (ownership validated below).
  const projectProvided = parsedBody.projectId !== undefined;
  const targetProjectId = projectProvided ? (parsedBody.projectId ?? null) : existing.projectId;

  // Only re-validate the project's ownership/soft-delete status when changed
  // to a non-null project, so a rename works even after the current project
  // was soft-deleted, and clearing to null never needs validation.
  if (targetProjectId !== existing.projectId && targetProjectId !== null) {
    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(
        and(
          eq(projects.id, targetProjectId),
          eq(projects.userId, user.id),
          isNull(projects.deletedAt),
        ),
      )
      .limit(1);

    if (!project) {
      throw createError({
        statusCode: 404,
        data: { messageKey: 'error.notFound' } satisfies ApiMessage,
      });
    }
  }

  const projectCondition =
    targetProjectId === null ? isNull(tasks.projectId) : eq(tasks.projectId, targetProjectId);
  const remoteCondition =
    existing.remoteIssueId === null
      ? isNull(tasks.remoteIssueId)
      : eq(tasks.remoteIssueId, existing.remoteIssueId);

  const updatedId = await db.transaction(async (tx) => {
    // Detect a collision with another task already occupying the target
    // (userId, projectId, name, remoteIssueId) scope so the rename/move can
    // be merged instead of failing on the unique constraint. Differing
    // remote issues no longer collide (REQ-134).
    const [colliding] = await tx
      .select({ id: tasks.id })
      .from(tasks)
      .where(
        and(
          eq(tasks.userId, user.id),
          eq(tasks.name, parsedBody.name),
          projectCondition,
          remoteCondition,
          ne(tasks.id, id!),
        ),
      )
      .limit(1);

    if (colliding) {
      // Merge: re-point all time entries from the edited task onto the
      // surviving (colliding) task, then hard-delete the now-emptied row.
      // The survivor already shares the same remoteIssueId by construction.
      await tx
        .update(timeEntries)
        .set({ taskId: colliding.id, updatedAt: new Date() })
        .where(eq(timeEntries.taskId, id!));

      await tx.delete(tasks).where(and(eq(tasks.id, id!), eq(tasks.userId, user.id)));

      return colliding.id;
    }

    const [row] = await tx
      .update(tasks)
      .set({ name: parsedBody.name, projectId: targetProjectId, updatedAt: new Date() })
      .where(and(eq(tasks.id, id!), eq(tasks.userId, user.id)))
      .returning({ id: tasks.id });

    return row!.id;
  });

  const [updated] = await db.select().from(tasks).where(eq(tasks.id, updatedId)).limit(1);

  if (!updated) {
    throw createError({
      statusCode: 500,
      data: { messageKey: 'error.unknown' } satisfies ApiMessage,
    });
  }

  let projectName: string | null = null;

  if (updated.projectId) {
    const [project] = await db
      .select({ name: projects.name })
      .from(projects)
      .where(eq(projects.id, updated.projectId))
      .limit(1);

    projectName = project?.name ?? null;
  }

  const remoteIssueRef = await getRemoteIssueRefForTask(user.id, updated.id);

  return {
    id: updated.id,
    name: updated.name,
    projectId: updated.projectId,
    projectName,
    createdAt: updated.createdAt.toISOString(),
    remoteIssueRef: remoteIssueRef ?? undefined,
  };
});
