import { and, eq, isNull, ne } from 'drizzle-orm';
import { ZodError } from 'zod';
import { updateTaskSchema } from '../../../shared/types/task';
import type { UpdateTaskDto, TaskDto } from '../../../shared/types/task';
import { db } from '../../db/index';
import { tasks, projects, clients, timeEntries } from '../../db/schema';
import { mapZodError } from '../../utils/zod-error';
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

  // Verify ownership (404 for foreign/unknown id)
  const [existing] = await db
    .select({ id: tasks.id, projectId: tasks.projectId })
    .from(tasks)
    .where(and(eq(tasks.id, id!), eq(tasks.userId, user.id)))
    .limit(1);

  if (!existing) {
    throw createError({
      statusCode: 404,
      data: { messageKey: 'error.notFound' } satisfies ApiMessage,
    });
  }

  const newProjectId = parsedBody.projectId ?? null;

  // Only re-validate the project's ownership/soft-delete status when changed
  // to a non-null project, so a rename works even after the current project
  // was soft-deleted, and clearing to null never needs validation.
  if (newProjectId !== existing.projectId && newProjectId !== null) {
    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(
        and(
          eq(projects.id, newProjectId),
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
    newProjectId === null ? isNull(tasks.projectId) : eq(tasks.projectId, newProjectId);

  const updatedId = await db.transaction(async (tx) => {
    // Detect a collision with another task already occupying the target
    // (userId, projectId, name) scope so the rename/move can be merged
    // instead of failing on the unique constraint.
    const [colliding] = await tx
      .select({ id: tasks.id })
      .from(tasks)
      .where(
        and(
          eq(tasks.userId, user.id),
          eq(tasks.name, parsedBody.name),
          projectCondition,
          ne(tasks.id, id!),
        ),
      )
      .limit(1);

    if (colliding) {
      // Merge: re-point all time entries from the edited task onto the
      // surviving (colliding) task, then hard-delete the now-emptied row.
      await tx
        .update(timeEntries)
        .set({ taskId: colliding.id, updatedAt: new Date() })
        .where(eq(timeEntries.taskId, id!));

      await tx.delete(tasks).where(and(eq(tasks.id, id!), eq(tasks.userId, user.id)));

      return colliding.id;
    }

    const [row] = await tx
      .update(tasks)
      .set({ name: parsedBody.name, projectId: newProjectId, updatedAt: new Date() })
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
  let clientName: string | null = null;

  if (updated.projectId) {
    const [project] = await db
      .select({ name: projects.name, clientId: projects.clientId })
      .from(projects)
      .where(eq(projects.id, updated.projectId))
      .limit(1);

    if (project) {
      projectName = project.name;
      const [client] = await db
        .select({ name: clients.name })
        .from(clients)
        .where(eq(clients.id, project.clientId))
        .limit(1);
      clientName = client?.name ?? null;
    }
  }

  return {
    id: updated.id,
    name: updated.name,
    projectId: updated.projectId,
    projectName,
    clientName,
    createdAt: updated.createdAt.toISOString(),
  };
});
