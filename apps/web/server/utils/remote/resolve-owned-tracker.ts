import { and, eq, isNull } from 'drizzle-orm';
import { getDb } from '../../db/index';
import { trackers } from '../../db/schema';
import type { ApiMessage } from '../../types/api-message';
import type { TrackerSystemType } from '@osi/remote-trackers/contracts';
import type { TrackerExecutionMode } from '../../../shared/types/tracker';

/**
 * Resolves an owned, active (non-soft-deleted) tracker for `server`
 * execution-mode endpoints. A foreign/unknown id is concealed as a plain
 * 404 without contacting any remote system. Extension-mode trackers are
 * rejected after ownership is confirmed, with no upstream request.
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
      executionMode: trackers.executionMode,
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

  const executionMode: TrackerExecutionMode = tracker.executionMode;
  if (executionMode === 'extension') {
    throw createError({
      statusCode: 422,
      data: { messageKey: 'error.extensionUnavailable' } satisfies ApiMessage,
    });
  }

  return { id: tracker.id, systemType: tracker.systemType, baseUrl: tracker.baseUrl };
}
