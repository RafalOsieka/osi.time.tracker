import { db } from '../../db/index';
import { clients } from '../../db/schema';
import { eq, isNull, asc, and } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event);

  const rows = await db
    .select()
    .from(clients)
    .where(and(eq(clients.userId, user.id), isNull(clients.deletedAt)))
    .orderBy(asc(clients.name));

  return rows;
});
