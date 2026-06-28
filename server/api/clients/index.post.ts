import { and, eq, isNull } from 'drizzle-orm';
import { ZodError } from 'zod';
import { CreateClientDto, createClientSchema, type ClientDto } from '../../../shared/types/client';
import { db } from '../../db/index';
import { clients } from '../../db/schema';
import { mapZodError } from '../../utils/zod-error';

export default defineEventHandler(async (event): Promise<ClientDto> => {
  const { user } = await requireAuth(event);
  const body = await readBody(event);

  let parsedBody: CreateClientDto;
  try {
    parsedBody = createClientSchema.parse(body);
  } catch (err: unknown) {
    if (err instanceof ZodError) {
      const mapped = mapZodError(err);
      throw createError({
        statusCode: 422,
        data: { messageKey: mapped.messageKey, params: mapped.params },
      });
    }
    throw err;
  }

  // App-layer duplicate check (partial unique index is the primary guard)
  const existing = await db
    .select({ id: clients.id })
    .from(clients)
    .where(
      and(
        eq(clients.userId, user.id),
        eq(clients.name, parsedBody.name),
        isNull(clients.deletedAt),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    throw createError({ statusCode: 422, data: { messageKey: 'error.clientNameDuplicate' } });
  }

  try {
    const [created] = await db
      .insert(clients)
      .values({ userId: user.id, name: parsedBody.name })
      .returning();
    return {
      id: created.id,
      name: created.name,
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
      throw createError({ statusCode: 422, data: { messageKey: 'error.clientNameDuplicate' } });
    }
    throw err;
  }
});
