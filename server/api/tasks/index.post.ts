import { and, eq, isNull, sql } from 'drizzle-orm';
import { ZodError } from 'zod';
import { createTaskSchema } from '../../../shared/types/task';
import type { CreateTaskDto, TaskDto } from '../../../shared/types/task';
import { db } from '../../db/index';
import { tasks, projects, clients } from '../../db/schema';
import { mapZodError } from '../../utils/zod-error';
import type { ApiMessage } from '../../types/api-message';

const MAX_NUMBER_ALLOCATION_ATTEMPTS = 5;

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

  for (let attempt = 0; attempt < MAX_NUMBER_ALLOCATION_ATTEMPTS; attempt++) {
    try {
      const [created] = await db
        .insert(tasks)
        .values({
          userId: user.id,
          projectId,
          name: parsedBody.name,
          number: sql`COALESCE((SELECT MAX(${tasks.number}) FROM ${tasks} WHERE ${tasks.userId} = ${user.id}), 0) + 1`,
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
        number: created.number,
        name: created.name,
        projectId: created.projectId,
        projectName,
        clientName,
        createdAt: created.createdAt.toISOString(),
      };
    } catch (err: unknown) {
      const isUniqueViolation =
        err &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code: string }).code === '23505';

      if (isUniqueViolation && attempt < MAX_NUMBER_ALLOCATION_ATTEMPTS - 1) {
        continue;
      }
      throw err;
    }
  }

  throw createError({
    statusCode: 500,
    data: { messageKey: 'error.unknown' } satisfies ApiMessage,
  });
});
