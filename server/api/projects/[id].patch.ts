import { and, eq, isNull, ne } from 'drizzle-orm';
import { updateProjectSchema } from '../../../shared/types/project';
import type { ProjectDto } from '../../../shared/types/project';
import { getDb } from '../../db/index';
import { projects, trackers } from '../../db/schema';
import { isUniqueViolation } from '../../utils/is-unique-violation';
import { readZodBody } from '../../utils/zod-input';
import type { ApiMessage } from '../../types/api-message';

export default defineEventHandler(async (event): Promise<ProjectDto> => {
  const { user } = await requireAuth(event);
  const id = getRouterParam(event, 'id');
  const parsedBody = await readZodBody(event, updateProjectSchema);

  const [existing] = await getDb()
    .select({ id: projects.id, trackerId: projects.trackerId })
    .from(projects)
    .where(and(eq(projects.id, id!), eq(projects.userId, user.id), isNull(projects.deletedAt)))
    .limit(1);

  if (!existing) {
    throw createError({
      statusCode: 404,
      data: { messageKey: 'error.notFound' } satisfies ApiMessage,
    });
  }

  const nextTrackerId =
    parsedBody.trackerId === undefined ? existing.trackerId : (parsedBody.trackerId ?? null);

  // Only re-validate tracker ownership/soft-delete when attaching a different
  // non-null tracker, so rename works after the current tracker is soft-deleted.
  if (nextTrackerId && nextTrackerId !== existing.trackerId) {
    const [tracker] = await getDb()
      .select({ id: trackers.id })
      .from(trackers)
      .where(
        and(
          eq(trackers.id, nextTrackerId),
          eq(trackers.userId, user.id),
          isNull(trackers.deletedAt),
        ),
      )
      .limit(1);

    if (!tracker) {
      throw createError({
        statusCode: 404,
        data: { messageKey: 'error.notFound' } satisfies ApiMessage,
      });
    }
  }

  const duplicate = await getDb()
    .select({ id: projects.id })
    .from(projects)
    .where(
      and(
        eq(projects.userId, user.id),
        nextTrackerId ? eq(projects.trackerId, nextTrackerId) : isNull(projects.trackerId),
        eq(projects.name, parsedBody.name),
        isNull(projects.deletedAt),
        ne(projects.id, id!),
      ),
    )
    .limit(1);

  if (duplicate.length > 0) {
    throw createError({
      statusCode: 422,
      data: { messageKey: 'error.projectNameDuplicate' } satisfies ApiMessage,
    });
  }

  try {
    const [updated] = await getDb()
      .update(projects)
      .set({ name: parsedBody.name, trackerId: nextTrackerId, updatedAt: new Date() })
      .where(and(eq(projects.id, id!), eq(projects.userId, user.id)))
      .returning();

    if (!updated) {
      throw createError({
        statusCode: 500,
        data: { messageKey: 'error.unknown' } satisfies ApiMessage,
      });
    }

    // Name lookup must include soft-deleted trackers so the DTO keeps trackerName (REQ-084).
    let trackerName: string | null = null;
    if (updated.trackerId) {
      const [tracker] = await getDb()
        .select({ name: trackers.name })
        .from(trackers)
        .where(eq(trackers.id, updated.trackerId))
        .limit(1);
      trackerName = tracker?.name ?? null;
    }

    return {
      id: updated.id,
      name: updated.name,
      trackerId: updated.trackerId,
      trackerName,
      createdAt: updated.createdAt.toISOString(),
    };
  } catch (err) {
    if (err instanceof Error && isUniqueViolation(err)) {
      throw createError({
        statusCode: 422,
        data: { messageKey: 'error.projectNameDuplicate' } satisfies ApiMessage,
      });
    }
    throw err;
  }
});
