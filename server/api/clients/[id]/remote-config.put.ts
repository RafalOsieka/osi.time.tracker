import { and, eq, isNull } from 'drizzle-orm';
import { ZodError } from 'zod';
import { createRemoteSystemConfigSchema } from '../../../../shared/types/remote-system-config';
import type {
  CreateRemoteSystemConfigDto,
  RemoteSystemConfigDto,
} from '../../../../shared/types/remote-system-config';
import { db } from '../../../db/index';
import { clients, remoteSystemConfigs } from '../../../db/schema';
import { mapZodError } from '../../../utils/zod-error';
import type { ApiMessage } from '../../../types/api-message';

export default defineEventHandler(async (event): Promise<RemoteSystemConfigDto> => {
  const { user } = await requireAuth(event);
  const clientId = getRouterParam(event, 'id');
  const body = await readBody(event);

  let parsedBody: CreateRemoteSystemConfigDto;
  try {
    parsedBody = createRemoteSystemConfigSchema.parse(body);
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

  const values = {
    systemType: parsedBody.systemType,
    baseUrl: parsedBody.baseUrl,
    executionMode: parsedBody.executionMode,
    roundingRule: parsedBody.roundingRule,
    requiredFieldDefaults: parsedBody.requiredFieldDefaults ?? {},
  };

  const [saved] = existing
    ? await db
        .update(remoteSystemConfigs)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(remoteSystemConfigs.id, existing.id))
        .returning()
    : await db
        .insert(remoteSystemConfigs)
        .values({ userId: user.id, clientId: clientId!, ...values })
        .returning();

  if (!saved) {
    throw createError({
      statusCode: 500,
      data: { messageKey: 'error.unknown' } satisfies ApiMessage,
    });
  }

  return {
    id: saved.id,
    clientId: saved.clientId,
    systemType: saved.systemType,
    baseUrl: saved.baseUrl,
    executionMode: saved.executionMode,
    roundingRule: saved.roundingRule,
    requiredFieldDefaults: saved.requiredFieldDefaults,
    createdAt: saved.createdAt.toISOString(),
    updatedAt: saved.updatedAt.toISOString(),
  };
});
