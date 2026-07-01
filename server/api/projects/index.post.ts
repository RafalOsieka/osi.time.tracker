import { and, eq, isNull } from 'drizzle-orm';
import { ZodError } from 'zod';
import { createProjectSchema } from '../../../shared/types/project';
import type { CreateProjectDto, ProjectDto } from '../../../shared/types/project';
import { db } from '../../db/index';
import { projects, clients } from '../../db/schema';
import { mapZodError } from '../../utils/zod-error';
import type { ApiMessage } from '../../types/api-message';

export default defineEventHandler(async (event): Promise<ProjectDto> => {
  const { user } = await requireAuth(event);
  const body = await readBody(event);

  let parsedBody: CreateProjectDto;
  try {
    parsedBody = createProjectSchema.parse(body);
  } catch (err: unknown) {
    if (err instanceof ZodError) {
      throw createError({
        statusCode: 422,
        data: mapZodError(err) satisfies ApiMessage,
      });
    }
    throw err;
  }

  // Verify the client exists, is owned by the user, and is not soft-deleted
  const [client] = await db
    .select({ id: clients.id, name: clients.name })
    .from(clients)
    .where(
      and(
        eq(clients.id, parsedBody.clientId),
        eq(clients.userId, user.id),
        isNull(clients.deletedAt),
      ),
    )
    .limit(1);

  if (!client) {
    throw createError({
      statusCode: 404,
      data: { messageKey: 'error.notFound' } satisfies ApiMessage,
    });
  }

  // App-layer duplicate check (partial unique index is the primary guard)
  const existing = await db
    .select({ id: projects.id })
    .from(projects)
    .where(
      and(
        eq(projects.userId, user.id),
        eq(projects.clientId, parsedBody.clientId),
        eq(projects.name, parsedBody.name),
        isNull(projects.deletedAt),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    throw createError({
      statusCode: 422,
      data: { messageKey: 'error.projectNameDuplicate' } satisfies ApiMessage,
    });
  }

  try {
    const [created] = await db
      .insert(projects)
      .values({ userId: user.id, clientId: parsedBody.clientId, name: parsedBody.name })
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
      clientId: created.clientId,
      clientName: client.name,
      createdAt: created.createdAt.toISOString(),
    };
  } catch (err: unknown) {
    // Map DB unique constraint violation to duplicate error
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code: string }).code === '23505'
    ) {
      throw createError({
        statusCode: 422,
        data: { messageKey: 'error.projectNameDuplicate' } satisfies ApiMessage,
      });
    }
    throw err;
  }
});
