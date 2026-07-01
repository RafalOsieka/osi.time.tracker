import { and, eq, isNull, ne } from 'drizzle-orm';
import { ZodError } from 'zod';
import { updateProjectSchema } from '../../../shared/types/project';
import type { UpdateProjectDto, ProjectDto } from '../../../shared/types/project';
import { db } from '../../db/index';
import { projects, clients } from '../../db/schema';
import { mapZodError } from '../../utils/zod-error';
import type { ApiMessage } from '../../types/api-message';

export default defineEventHandler(async (event): Promise<ProjectDto> => {
  const { user } = await requireAuth(event);
  const id = getRouterParam(event, 'id');
  const body = await readBody(event);

  let parsedBody: UpdateProjectDto;
  try {
    parsedBody = updateProjectSchema.parse(body);
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
    .select({ id: projects.id, clientId: projects.clientId })
    .from(projects)
    .where(and(eq(projects.id, id!), eq(projects.userId, user.id), isNull(projects.deletedAt)))
    .limit(1);

  if (!existing) {
    throw createError({
      statusCode: 404,
      data: { messageKey: 'error.notFound' } satisfies ApiMessage,
    });
  }

  // Only re-validate the client's ownership/soft-delete status when it changed,
  // so a rename works even if the current client was soft-deleted
  if (parsedBody.clientId !== existing.clientId) {
    const [client] = await db
      .select({ id: clients.id })
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
  }

  // App-layer duplicate check
  const duplicate = await db
    .select({ id: projects.id })
    .from(projects)
    .where(
      and(
        eq(projects.userId, user.id),
        eq(projects.clientId, parsedBody.clientId),
        eq(projects.name, parsedBody.name),
        isNull(projects.deletedAt),
        ne(projects.id, id!),
      ),
    )
    .limit(1);

  if (duplicate.length > 0) {
    throw createError({
      statusCode: 422,
      data: { messageKey: 'error.projectNameDuplicate' } satisfies ApiMessage,
    });
  }

  try {
    const [updated] = await db
      .update(projects)
      .set({ name: parsedBody.name, clientId: parsedBody.clientId, updatedAt: new Date() })
      .where(and(eq(projects.id, id!), eq(projects.userId, user.id)))
      .returning();

    if (!updated) {
      throw createError({
        statusCode: 500,
        data: { messageKey: 'error.unknown' } satisfies ApiMessage,
      });
    }

    const [updatedClient] = await db
      .select({ name: clients.name })
      .from(clients)
      .where(eq(clients.id, updated.clientId))
      .limit(1);

    return {
      id: updated.id,
      name: updated.name,
      clientId: updated.clientId,
      clientName: updatedClient?.name ?? '',
      createdAt: updated.createdAt.toISOString(),
    };
  } catch (err: unknown) {
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
