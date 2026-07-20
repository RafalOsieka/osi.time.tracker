import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../../db/index';
import { remoteSystemConfigs } from '../../db/schema';
import type { ApiMessage } from '../../types/api-message';
import type { RemoteSystemType } from '../../../shared/types/remote-system-config';

/**
 * Resolves an owned, active (non-soft-deleted) remote-system configuration
 * for `server`-execution-mode endpoints. A foreign/unknown id is concealed
 * as a plain 404 without contacting any tracker.
 */
export async function resolveOwnedRemoteConfig(
  userId: string,
  remoteSystemConfigId: string,
): Promise<{ id: string; systemType: RemoteSystemType; baseUrl: string }> {
  const [config] = await db
    .select({
      id: remoteSystemConfigs.id,
      systemType: remoteSystemConfigs.systemType,
      baseUrl: remoteSystemConfigs.baseUrl,
    })
    .from(remoteSystemConfigs)
    .where(
      and(
        eq(remoteSystemConfigs.id, remoteSystemConfigId),
        eq(remoteSystemConfigs.userId, userId),
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

  return config;
}
