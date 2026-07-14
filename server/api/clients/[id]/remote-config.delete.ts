import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../../../db/index';
import { clients, remoteSystemConfigs } from '../../../db/schema';
import type { ApiMessage } from '../../../types/api-message';

export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event);
  const clientId = getRouterParam(event, 'id');

  const [client] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.id, clientId!), eq(clients.userId, user.id), isNull(clients.deletedAt)))
    .limit(1);

  if (!client) {
    throw createError({
      statusCode: 404,
      data: { messageKey: 'error.notFound' } satisfies ApiMessage,
    });
  }

  const [existing] = await db
    .select({ id: remoteSystemConfigs.id })
    .from(remoteSystemConfigs)
    .where(
      and(
        eq(remoteSystemConfigs.clientId, clientId!),
        eq(remoteSystemConfigs.userId, user.id),
        isNull(remoteSystemConfigs.deletedAt),
      ),
    )
    .limit(1);

  if (!existing) {
    throw createError({
      statusCode: 404,
      data: { messageKey: 'error.notFound' } satisfies ApiMessage,
    });
  }

  await db
    .update(remoteSystemConfigs)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(remoteSystemConfigs.id, existing.id));

  return { success: true };
});
