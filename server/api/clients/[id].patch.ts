import { db } from '../../db/index';
import { clients } from '../../db/schema';
import { eq, isNull, and, ne } from 'drizzle-orm';
import { validateClientName } from '../../utils/validation';

export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event);
  const id = getRouterParam(event, 'id');
  const body = await readBody(event);

  const validation = validateClientName(body?.name);
  if (!validation.valid) {
    throw createError({ statusCode: 422, data: { messageKey: validation.messageKey } });
  }

  const trimmedName = (body.name as string).trim();

  // Verify ownership (404 for foreign/unknown id)
  const [existing] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.id, id!), eq(clients.userId, user.id), isNull(clients.deletedAt)))
    .limit(1);

  if (!existing) {
    throw createError({ statusCode: 404, data: { messageKey: 'error.notFound' } });
  }

  // App-layer duplicate check
  const duplicate = await db
    .select({ id: clients.id })
    .from(clients)
    .where(
      and(
        eq(clients.userId, user.id),
        eq(clients.name, trimmedName),
        isNull(clients.deletedAt),
        ne(clients.id, id!),
      ),
    )
    .limit(1);

  if (duplicate.length > 0) {
    throw createError({ statusCode: 422, data: { messageKey: 'error.clientNameDuplicate' } });
  }

  try {
    const [updated] = await db
      .update(clients)
      .set({ name: trimmedName, updatedAt: new Date() })
      .where(and(eq(clients.id, id!), eq(clients.userId, user.id)))
      .returning();
    return updated;
  } catch (err: unknown) {
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
