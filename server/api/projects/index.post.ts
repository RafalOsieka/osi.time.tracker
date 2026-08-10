import { and, eq, isNull } from 'drizzle-orm';
import { ZodError } from 'zod';
import { createProjectSchema } from '../../../shared/types/project';
import type { CreateProjectDto, ProjectDto } from '../../../shared/types/project';
import { db } from '../../db/index';
import { projects, trackers } from '../../db/schema';
import { mapZodError } from '../../utils/zod-error';
import type { ApiMessage } from '../../types/api-message';

export default defineEventHandler(async (event): Promise<ProjectDto> => {
  const { user } = await requireAuth(event);
  const body = await readBody(event);

  let parsedBody: CreateProjectDto;
  try {
    parsedBody = createProjectSchema.parse(body);
  } catch (err: unknown) {
    if (err instanceof ZodError) {
      throw createError({
        statusCode: 422,
        data: mapZodError(err) satisfies ApiMessage,
      });
    }
    throw err;
  }

  const trackerId = parsedBody.trackerId ?? null;
  let trackerName: string | null = null;

  if (trackerId) {
    const [tracker] = await db
      .select({ id: trackers.id, name: trackers.name })
      .from(trackers)
      .where(
        and(eq(trackers.id, trackerId), eq(trackers.userId, user.id), isNull(trackers.deletedAt)),
      )
      .limit(1);

    if (!tracker) {
      throw createError({
        statusCode: 404,
        data: { messageKey: 'error.notFound' } satisfies ApiMessage,
      });
    }
    trackerName = tracker.name;
  }

  const existing = await db
    .select({ id: projects.id })
    .from(projects)
    .where(
      and(
        eq(projects.userId, user.id),
        trackerId ? eq(projects.trackerId, trackerId) : isNull(projects.trackerId),
        eq(projects.name, parsedBody.name),
        isNull(projects.deletedAt),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    throw createError({
      statusCode: 422,
      data: { messageKey: 'error.projectNameDuplicate' } satisfies ApiMessage,
    });
  }

  try {
    const [created] = await db
      .insert(projects)
      .values({ userId: user.id, trackerId, name: parsedBody.name })
      .returning();

    if (!created) {
      throw createError({
        statusCode: 500,
        data: { messageKey: 'error.unknown' } satisfies ApiMessage,
      });
    }

    return {
      id: created.id,
      name: created.name,
      trackerId: created.trackerId,
      trackerName,
      createdAt: created.createdAt.toISOString(),
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
