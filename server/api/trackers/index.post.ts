import { and, eq, isNull } from 'drizzle-orm';
import { createTrackerSchema } from '../../../shared/types/tracker';
import type { TrackerDto } from '../../../shared/types/tracker';
import { getDb } from '../../db/index';
import { trackers } from '../../db/schema';
import { isUniqueViolation } from '../../utils/is-unique-violation';
import { readZodBody } from '../../utils/zod-input';
import type { ApiMessage } from '../../types/api-message';

function toTrackerDto(row: typeof trackers.$inferSelect): TrackerDto {
  return {
    id: row.id,
    name: row.name,
    systemType: row.systemType,
    baseUrl: row.baseUrl,
    executionMode: row.executionMode,
    roundingRule: row.roundingRule,
    requiredFieldDefaults: row.requiredFieldDefaults,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export default defineEventHandler(async (event): Promise<TrackerDto> => {
  const { user } = await requireAuth(event);
  const parsedBody = await readZodBody(event, createTrackerSchema);

  const existing = await getDb()
    .select({ id: trackers.id })
    .from(trackers)
    .where(
      and(
        eq(trackers.userId, user.id),
        eq(trackers.name, parsedBody.name),
        isNull(trackers.deletedAt),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    throw createError({
      statusCode: 422,
      data: { messageKey: 'error.trackerNameDuplicate' } satisfies ApiMessage,
    });
  }

  try {
    const [created] = await getDb()
      .insert(trackers)
      .values({
        userId: user.id,
        name: parsedBody.name,
        systemType: parsedBody.systemType,
        baseUrl: parsedBody.baseUrl,
        executionMode: parsedBody.executionMode,
        roundingRule: parsedBody.roundingRule,
        requiredFieldDefaults: parsedBody.requiredFieldDefaults ?? {},
      })
      .returning();

    if (!created) {
      throw createError({
        statusCode: 500,
        data: { messageKey: 'error.unknown' } satisfies ApiMessage,
      });
    }

    return toTrackerDto(created);
  } catch (err) {
    if (err instanceof Error && isUniqueViolation(err)) {
      throw createError({
        statusCode: 422,
        data: { messageKey: 'error.trackerNameDuplicate' } satisfies ApiMessage,
      });
    }
    throw err;
  }
});
