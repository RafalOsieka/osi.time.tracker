import { and, eq, inArray, isNull } from 'drizzle-orm';
import { reassignTimeEntriesSchema } from '../../../shared/types/time-entry';
import type { TimeEntryDto } from '../../../shared/types/time-entry';
import { db } from '../../db/index';
import { timeEntries, tasks, projects } from '../../db/schema';
import { resolveTaskId } from '../../utils/tasks';
import { resolveActiveTrackerForProject } from '../../utils/remote-issue-refs';
import { toTimeEntryDto } from '../../utils/time-entries';
import { readZodBody } from '../../utils/zod-input';
import type { ApiMessage } from '../../types/api-message';

export default defineEventHandler(async (event): Promise<TimeEntryDto[]> => {
  const { user } = await requireAuth(event);
  const parsedBody = await readZodBody(event, reassignTimeEntriesSchema);
  const remoteIssueProvided = parsedBody.remoteIssueId !== undefined;

  const updatedRows = await db.transaction(async (tx) => {
    const rows = await tx
      .select({
        id: timeEntries.id,
        taskId: timeEntries.taskId,
      })
      .from(timeEntries)
      .where(and(inArray(timeEntries.id, parsedBody.ids), eq(timeEntries.userId, user.id)));

    const foundIds = new Set(rows.map((row) => row.id));
    if (!parsedBody.ids.every((id) => foundIds.has(id))) {
      throw createError({
        statusCode: 404,
        data: { messageKey: 'error.notFound' } satisfies ApiMessage,
      });
    }

    const sourceTaskIds = [...new Set(rows.flatMap((row) => (row.taskId ? [row.taskId] : [])))];
    const sourceTaskId = sourceTaskIds[0] ?? null;

    let sourceName: string | null = null;
    let sourceProjectId: string | null = null;
    let sourceRemoteIssueId: string | null = null;
    let sourceTrackerId: string | null = null;
    let sourceCachedTitle: string | null = null;
    let sourceCachedRemoteProjectTitle: string | null = null;
    if (sourceTaskId) {
      const [sourceTask] = await tx
        .select({
          name: tasks.name,
          projectId: tasks.projectId,
          remoteIssueId: tasks.remoteIssueId,
          trackerId: tasks.trackerId,
          remoteIssueCachedTitle: tasks.remoteIssueCachedTitle,
          remoteIssueCachedProjectTitle: tasks.remoteIssueCachedProjectTitle,
        })
        .from(tasks)
        .where(and(eq(tasks.id, sourceTaskId), eq(tasks.userId, user.id)))
        .limit(1);
      sourceName = sourceTask?.name ?? null;
      sourceProjectId = sourceTask?.projectId ?? null;
      sourceRemoteIssueId = sourceTask?.remoteIssueId ?? null;
      sourceTrackerId = sourceTask?.trackerId ?? null;
      sourceCachedTitle = sourceTask?.remoteIssueCachedTitle ?? null;
      sourceCachedRemoteProjectTitle = sourceTask?.remoteIssueCachedProjectTitle ?? null;
    }

    const effectiveName = parsedBody.name ?? sourceName;
    if (!effectiveName) {
      throw createError({
        statusCode: 422,
        data: { messageKey: 'error.timeEntryTitleInvalid' } satisfies ApiMessage,
      });
    }

    let effectiveProjectId: string | null;
    if (parsedBody.projectId === undefined) {
      effectiveProjectId = sourceProjectId;
    } else {
      effectiveProjectId = parsedBody.projectId;
    }

    if (effectiveProjectId !== null) {
      const [ownedProject] = await tx
        .select({ id: projects.id })
        .from(projects)
        .where(
          and(
            eq(projects.id, effectiveProjectId),
            eq(projects.userId, user.id),
            isNull(projects.deletedAt),
          ),
        )
        .limit(1);
      // Allow soft-deleted current project when projectId was omitted (keep scope).
      if (!ownedProject && parsedBody.projectId !== undefined) {
        throw createError({
          statusCode: 404,
          data: { messageKey: 'error.notFound' } satisfies ApiMessage,
        });
      }
    }

    let effectiveRemoteIssueId: string | null;
    let effectiveTrackerId: string | null;
    let effectiveCachedTitle: string | null;
    let effectiveCachedRemoteProjectTitle: string | null;

    if (!remoteIssueProvided) {
      // Omitted: keep the source task's current remote issue.
      effectiveRemoteIssueId = sourceRemoteIssueId;
      effectiveTrackerId = sourceTrackerId;
      effectiveCachedTitle = sourceCachedTitle;
      effectiveCachedRemoteProjectTitle = sourceCachedRemoteProjectTitle;
    } else if (parsedBody.remoteIssueId == null) {
      // Explicit null: target the unlinked twin.
      effectiveRemoteIssueId = null;
      effectiveTrackerId = null;
      effectiveCachedTitle = null;
      effectiveCachedRemoteProjectTitle = null;
    } else {
      // Value: target the task carrying that remote issue. Derive tracker
      // provenance server-side from the target project's active tracker (REQ-179).
      // Cached title comes from the client search result; tracker id is never
      // client-trusted.
      if (effectiveProjectId === null) {
        throw createError({
          statusCode: 409,
          data: { messageKey: 'error.remoteIssueTaskNoConfig' } satisfies ApiMessage,
        });
      }

      const tracker = await resolveActiveTrackerForProject(user.id, effectiveProjectId);
      if (!tracker) {
        throw createError({
          statusCode: 409,
          data: { messageKey: 'error.remoteIssueTaskNoConfig' } satisfies ApiMessage,
        });
      }

      effectiveRemoteIssueId = parsedBody.remoteIssueId;
      effectiveTrackerId = tracker.id;
      effectiveCachedTitle = parsedBody.cachedTitle ?? parsedBody.remoteIssueId;
      effectiveCachedRemoteProjectTitle = parsedBody.cachedRemoteProjectTitle ?? null;
    }

    const targetTaskId = await resolveTaskId(tx, user.id, effectiveName, effectiveProjectId, {
      remoteIssueId: effectiveRemoteIssueId,
      trackerId: effectiveTrackerId,
      cachedTitle: effectiveCachedTitle,
      cachedRemoteProjectTitle: effectiveCachedRemoteProjectTitle,
    });
    if (!targetTaskId) {
      throw createError({
        statusCode: 422,
        data: { messageKey: 'error.timeEntryTitleInvalid' } satisfies ApiMessage,
      });
    }

    const now = new Date();
    const updated = await tx
      .update(timeEntries)
      .set({ taskId: targetTaskId, updatedAt: now })
      .where(and(inArray(timeEntries.id, parsedBody.ids), eq(timeEntries.userId, user.id)))
      .returning();

    // Garbage-collect any emptied source tasks (excluding the target).
    for (const emptiedTaskId of sourceTaskIds) {
      if (emptiedTaskId === targetTaskId) continue;
      const [remaining] = await tx
        .select({ id: timeEntries.id })
        .from(timeEntries)
        .where(eq(timeEntries.taskId, emptiedTaskId))
        .limit(1);
      if (!remaining) {
        await tx.delete(tasks).where(and(eq(tasks.id, emptiedTaskId), eq(tasks.userId, user.id)));
      }
    }

    return updated;
  });

  return Promise.all(updatedRows.map((row) => toTimeEntryDto(row)));
});
