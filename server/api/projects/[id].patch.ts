import { and, eq, isNull, ne } from 'drizzle-orm';
import { ZodError } from 'zod';
import { updateProjectSchema } from '../../../shared/types/project';
import type { UpdateProjectDto, ProjectDto } from '../../../shared/types/project';
import { db } from '../../db/index';
import { projects, trackers } from '../../db/schema';
import { mapZodError } from '../../utils/zod-error';
import type { ApiMessage } from '../../types/api-message';

export default defineEventHandler(async (event): Promise<ProjectDto> => {
  const { user } = await requireAuth(event);
  const id = getRouterParam(event, 'id');
  const body = await readBody(event);

  let parsedBody: UpdateProjectDto;
  try {
    parsedBody = updateProjectSchema.parse(body);
  } catch (err: unknown) {
    if (err instanceof ZodError) {
      throw createError({
        statusCode: 422,
        data: mapZodError(err) satisfies ApiMessage,
      });
    }
    throw err;
  }

  const [existing] = await db
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
    const [tracker] = await db
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

  const duplicate = await db
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
    const [updated] = await db
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
      const [tracker] = await db
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
  } catch (err: unknown) {
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code: string }).code === '23505'
    ) {
      throw createError({
        statusCode: 422,
        data: { messageKey: 'error.projectNameDuplicate' } satisfies ApiMessage,
      });
    }
    throw err;
  }
});
