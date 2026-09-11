import { and, eq, isNull, ne } from 'drizzle-orm';
import { updateProjectSchema } from '../../../shared/types/project';
import type { ProjectDto } from '../../../shared/types/project';
import { getDb } from '../../db/index';
import { projects, trackers } from '../../db/schema';
import { isUniqueViolation } from '../../utils/is-unique-violation';
import { readZodBody } from '../../utils/zod-input';
import type { ApiMessage } from '../../types/api-message';

export default defineEventHandler(async (event): Promise<ProjectDto> => {
  const db = getDb();
  const { user } = await requireAuth(event);
  const id = getRouterParam(event, 'id');
  const parsedBody = await readZodBody(event, updateProjectSchema);

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

  // A remote project id is meaningful only for the tracker it came from (REQ-326):
  // changing or clearing trackerId forces the scope to null regardless of the
  // request body, even when the client still echoed the old scope.
  const trackerChanged = nextTrackerId !== existing.trackerId;
  const nextRemoteProjectId = trackerChanged ? null : (parsedBody.remoteProjectId ?? null);
  const nextRemoteProjectTitle = trackerChanged ? null : (parsedBody.remoteProjectTitle ?? null);

  // A local project (no tracker, and not being reassigned to one this request)
  // cannot carry a remote project scope (REQ-325). A tracker change/detach is
  // handled above by force-nulling instead of rejecting (REQ-326).
  if (!trackerChanged && !nextTrackerId && parsedBody.remoteProjectId) {
    throw createError({
      statusCode: 422,
      data: { messageKey: 'error.projectRemoteScopeRequiresTracker' } satisfies ApiMessage,
    });
  }

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
      .set({
        name: parsedBody.name,
        trackerId: nextTrackerId,
        remoteProjectId: nextRemoteProjectId,
        remoteProjectTitle: nextRemoteProjectTitle,
        updatedAt: new Date(),
      })
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
      remoteProjectId: updated.remoteProjectId,
      remoteProjectTitle: updated.remoteProjectTitle,
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
