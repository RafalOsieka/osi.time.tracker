import { and, eq, isNull, ne } from 'drizzle-orm';
import { ZodError } from 'zod';
import { updateClientSchema } from '../../../shared/types/client';
import type { UpdateClientDto, ClientDto } from '../../../shared/types/client';
import { db } from '../../db/index';
import { clients } from '../../db/schema';
import { mapZodError } from '../../utils/zod-error';
import type { ApiMessage } from '../../types/api-message';

export default defineEventHandler(async (event): Promise<ClientDto> => {
  const { user } = await requireAuth(event);
  const id = getRouterParam(event, 'id');
  const body = await readBody(event);

  let parsedBody: UpdateClientDto;
  try {
    parsedBody = updateClientSchema.parse(body);
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
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.id, id!), eq(clients.userId, user.id), isNull(clients.deletedAt)))
    .limit(1);

  if (!existing) {
    throw createError({
      statusCode: 404,
      data: { messageKey: 'error.notFound' } satisfies ApiMessage,
    });
  }

  // App-layer duplicate check
  const duplicate = await db
    .select({ id: clients.id })
    .from(clients)
    .where(
      and(
        eq(clients.userId, user.id),
        eq(clients.name, parsedBody.name),
        isNull(clients.deletedAt),
        ne(clients.id, id!),
      ),
    )
    .limit(1);

  if (duplicate.length > 0) {
    throw createError({
      statusCode: 422,
      data: { messageKey: 'error.clientNameDuplicate' } satisfies ApiMessage,
    });
  }

  try {
    const [updated] = await db
      .update(clients)
      .set({ name: parsedBody.name, updatedAt: new Date() })
      .where(and(eq(clients.id, id!), eq(clients.userId, user.id)))
      .returning();

    if (!updated) {
      throw createError({
        statusCode: 500,
        data: { messageKey: 'error.unknown' } satisfies ApiMessage,
      });
    }

    return {
      id: updated.id,
      name: updated.name,
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
        data: { messageKey: 'error.clientNameDuplicate' } satisfies ApiMessage,
      });
    }
    throw err;
  }
});
