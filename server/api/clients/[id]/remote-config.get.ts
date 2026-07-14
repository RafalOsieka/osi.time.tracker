import { and, eq, isNull } from 'drizzle-orm';
import type { RemoteSystemConfigDto } from '../../../../shared/types/remote-system-config';
import { db } from '../../../db/index';
import { clients, remoteSystemConfigs } from '../../../db/schema';
import type { ApiMessage } from '../../../types/api-message';

export default defineEventHandler(async (event): Promise<RemoteSystemConfigDto> => {
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

  const [config] = await db
    .select()
    .from(remoteSystemConfigs)
    .where(
      and(
        eq(remoteSystemConfigs.clientId, clientId!),
        eq(remoteSystemConfigs.userId, user.id),
        isNull(remoteSystemConfigs.deletedAt),
      ),
    )
    .limit(1);

  if (!config) {
    throw createError({
      statusCode: 404,
      data: { messageKey: 'error.notFound' } satisfies ApiMessage,
    });
  }

  return {
    id: config.id,
    clientId: config.clientId,
    systemType: config.systemType,
    baseUrl: config.baseUrl,
    executionMode: config.executionMode,
    roundingRule: config.roundingRule,
    requiredFieldDefaults: config.requiredFieldDefaults,
    createdAt: config.createdAt.toISOString(),
    updatedAt: config.updatedAt.toISOString(),
  };
});
