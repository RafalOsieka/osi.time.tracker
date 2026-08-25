import { and, eq, isNull, ne } from 'drizzle-orm';
import { ZodError } from 'zod';
import { updateTrackerSchema } from '../../../shared/types/tracker';
import type { UpdateTrackerDto, TrackerDto } from '../../../shared/types/tracker';
import { db } from '../../db/index';
import { trackers } from '../../db/schema';
import { mapZodError } from '../../utils/zod-error';
import { isUniqueViolation } from '../../utils/is-unique-violation';
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
  const id = getRouterParam(event, 'id');
  const body = await readBody(event);

  let parsedBody: UpdateTrackerDto;
  try {
    parsedBody = updateTrackerSchema.parse(body);
  } catch (err) {
    if (err instanceof ZodError) {
      throw createError({
        statusCode: 422,
        data: mapZodError(err) satisfies ApiMessage,
      });
    }
    throw err;
  }

  const [existing] = await db
    .select({ id: trackers.id })
    .from(trackers)
    .where(and(eq(trackers.id, id!), eq(trackers.userId, user.id), isNull(trackers.deletedAt)))
    .limit(1);

  if (!existing) {
    throw createError({
      statusCode: 404,
      data: { messageKey: 'error.notFound' } satisfies ApiMessage,
    });
  }

  const duplicate = await db
    .select({ id: trackers.id })
    .from(trackers)
    .where(
      and(
        eq(trackers.userId, user.id),
        eq(trackers.name, parsedBody.name),
        isNull(trackers.deletedAt),
        ne(trackers.id, id!),
      ),
    )
    .limit(1);

  if (duplicate.length > 0) {
    throw createError({
      statusCode: 422,
      data: { messageKey: 'error.trackerNameDuplicate' } satisfies ApiMessage,
    });
  }

  try {
    const [updated] = await db
      .update(trackers)
      .set({
        name: parsedBody.name,
        systemType: parsedBody.systemType,
        baseUrl: parsedBody.baseUrl,
        executionMode: parsedBody.executionMode,
        roundingRule: parsedBody.roundingRule,
        requiredFieldDefaults: parsedBody.requiredFieldDefaults ?? {},
        updatedAt: new Date(),
      })
      .where(and(eq(trackers.id, id!), eq(trackers.userId, user.id)))
      .returning();

    if (!updated) {
      throw createError({
        statusCode: 500,
        data: { messageKey: 'error.unknown' } satisfies ApiMessage,
      });
    }

    return toTrackerDto(updated);
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
