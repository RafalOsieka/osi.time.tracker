import { db } from '../../db/index';
import { clients } from '../../db/schema';
import { eq, isNull, and } from 'drizzle-orm';
import { validateClientName } from '../../utils/validation';

export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event);
  const body = await readBody(event);

  const validation = validateClientName(body?.name);
  if (!validation.valid) {
    throw createError({ statusCode: 422, data: { messageKey: validation.messageKey } });
  }

  const trimmedName = (body.name as string).trim();

  // App-layer duplicate check (partial unique index is the primary guard)
  const existing = await db
    .select({ id: clients.id })
    .from(clients)
    .where(
      and(eq(clients.userId, user.id), eq(clients.name, trimmedName), isNull(clients.deletedAt)),
    )
    .limit(1);

  if (existing.length > 0) {
    throw createError({ statusCode: 422, data: { messageKey: 'error.clientNameDuplicate' } });
  }

  try {
    const [created] = await db
      .insert(clients)
      .values({ userId: user.id, name: trimmedName })
      .returning();
    return created;
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
