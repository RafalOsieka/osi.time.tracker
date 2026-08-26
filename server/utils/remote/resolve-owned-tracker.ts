import { and, eq, isNull } from 'drizzle-orm';
import { getDb } from '../../db/index';
import { trackers } from '../../db/schema';
import type { ApiMessage } from '../../types/api-message';
import type { TrackerSystemType } from '../../../shared/types/tracker';

/**
 * Resolves an owned, active (non-soft-deleted) tracker for `server`
 * execution-mode endpoints. A foreign/unknown id is concealed as a plain
 * 404 without contacting any remote system.
 */
export async function resolveOwnedTracker(
  userId: string,
  trackerId: string,
): Promise<{ id: string; systemType: TrackerSystemType; baseUrl: string }> {
  const db = getDb();
  const [tracker] = await db
    .select({
      id: trackers.id,
      systemType: trackers.systemType,
      baseUrl: trackers.baseUrl,
    })
    .from(trackers)
    .where(and(eq(trackers.id, trackerId), eq(trackers.userId, userId), isNull(trackers.deletedAt)))
    .limit(1);

  if (!tracker) {
    throw createError({
      statusCode: 404,
      data: { messageKey: 'error.notFound' } satisfies ApiMessage,
    });
  }

  return tracker;
}
