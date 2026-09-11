import { and, eq } from 'drizzle-orm';
import type { CleanupRemoteExportResultDto } from '../../../shared/types/remote-export';
import { cleanupRemoteExportSchema } from '../../../shared/types/remote-export';
import { getDb } from '../../db';
import { remoteExports } from '../../db/schema';
import { readZodBody } from '../../utils/zod-input';
import type { ApiMessage } from '../../types/api-message';

export default defineEventHandler(async (event): Promise<CleanupRemoteExportResultDto> => {
  const db = getDb();
  const { user } = await requireAuth(event);
  const parsed = await readZodBody(event, cleanupRemoteExportSchema);

  const deleted = await db
    .delete(remoteExports)
    .where(and(eq(remoteExports.id, parsed.exportId), eq(remoteExports.userId, user.id)))
    .returning({ id: remoteExports.id });

  if (deleted.length === 0) {
    throw createError({
      statusCode: 404,
      data: { messageKey: 'error.notFound' } satisfies ApiMessage,
    });
  }

  return { exportId: parsed.exportId, cleaned: true };
});
