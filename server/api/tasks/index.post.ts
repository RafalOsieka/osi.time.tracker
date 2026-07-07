import { and, eq, isNull } from 'drizzle-orm';
import { ZodError } from 'zod';
import { createTaskSchema } from '../../../shared/types/task';
import type { CreateTaskDto, TaskDto } from '../../../shared/types/task';
import { db } from '../../db/index';
import { tasks, projects, clients } from '../../db/schema';
import { mapZodError } from '../../utils/zod-error';
import type { ApiMessage } from '../../types/api-message';

export default defineEventHandler(async (event): Promise<TaskDto> => {
  const { user } = await requireAuth(event);
  const body = await readBody(event);

  let parsedBody: CreateTaskDto;
  try {
    parsedBody = createTaskSchema.parse(body);
  } catch (err: unknown) {
    if (err instanceof ZodError) {
      throw createError({
        statusCode: 422,
        data: mapZodError(err) satisfies ApiMessage,
      });
    }
    throw err;
  }

  const projectId = parsedBody.projectId ?? null;
  let projectName: string | null = null;
  let clientName: string | null = null;

  if (projectId) {
    const [project] = await db
      .select({ id: projects.id, name: projects.name, clientId: projects.clientId })
      .from(projects)
      .where(
        and(eq(projects.id, projectId), eq(projects.userId, user.id), isNull(projects.deletedAt)),
      )
      .limit(1);

    if (!project) {
      throw createError({
        statusCode: 404,
        data: { messageKey: 'error.notFound' } satisfies ApiMessage,
      });
    }

    projectName = project.name;

    const [client] = await db
      .select({ name: clients.name })
      .from(clients)
      .where(eq(clients.id, project.clientId))
      .limit(1);
    clientName = client?.name ?? null;
  }

  const projectCondition =
    projectId === null ? isNull(tasks.projectId) : eq(tasks.projectId, projectId);

  try {
    const [created] = await db
      .insert(tasks)
      .values({
        userId: user.id,
        projectId,
        name: parsedBody.name,
      })
      .returning();

    if (!created) {
      throw createError({
        statusCode: 500,
        data: { messageKey: 'error.unknown' } satisfies ApiMessage,
      });
    }

    return {
      id: created.id,
      name: created.name,
      projectId: created.projectId,
      projectName,
      clientName,
      createdAt: created.createdAt.toISOString(),
    };
  } catch (err: unknown) {
    const errorCode =
      err && typeof err === 'object'
        ? ((err as { code?: unknown; cause?: { code?: unknown } }).code ??
          (err as { cause?: { code?: unknown } }).cause?.code)
        : undefined;
    const isUniqueViolation = errorCode === '23505';

    if (!isUniqueViolation) {
      throw err;
    }

    // REQ-TTR-027: duplicate name within scope matches the existing task instead of duplicating.
    const [existing] = await db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.userId, user.id),
          eq(tasks.name, parsedBody.name),
          projectCondition,
          isNull(tasks.deletedAt),
        ),
      )
      .limit(1);

    if (!existing) {
      throw err;
    }

    return {
      id: existing.id,
      name: existing.name,
      projectId: existing.projectId,
      projectName,
      clientName,
      createdAt: existing.createdAt.toISOString(),
    };
  }
});
