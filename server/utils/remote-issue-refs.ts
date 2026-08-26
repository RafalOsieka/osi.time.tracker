import { and, eq, inArray, isNull } from 'drizzle-orm';
import { getDb } from '../db/index';
import { tasks, projects, trackers } from '../db/schema';
import { deriveIssueUrl } from '../../shared/remote/issue-url';
import type { RemoteIssueRefDto } from '../../shared/types/remote-issue-ref';
import { isImplementedTrackerSystemType } from '../../shared/utils/remote-sync-row-state';

type TaskRefRow = {
  id: string;
  userId: string;
  trackerId: string | null;
  remoteIssueId: string | null;
  remoteIssueCachedTitle: string | null;
  remoteIssueCachedProjectTitle: string | null;
  remoteIssueCreatedAt: Date | null;
  remoteIssueUpdatedAt: Date | null;
};

/**
 * Resolves the active (non-soft-deleted) tracker reachable from an owned
 * Task through its Project.trackerId. Returns `null` when the Task is
 * unowned/unknown, project-less, local, or the tracker is missing/soft-deleted.
 */
export async function resolveActiveTrackerForTask(
  userId: string,
  taskId: string,
): Promise<{ id: string; systemType: string; baseUrl: string } | null> {
  const [task] = await getDb()
    .select({ id: tasks.id, projectId: tasks.projectId })
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
    .limit(1);

  if (!task || !task.projectId) {
    return null;
  }

  return resolveActiveTrackerForProject(userId, task.projectId);
}

/**
 * Resolves the active tracker for an owned, non-deleted project via
 * `project.trackerId`. Used by day-scoped reassignment when the target
 * project is known without a task id yet.
 */
export async function resolveActiveTrackerForProject(
  userId: string,
  projectId: string,
): Promise<{ id: string; systemType: string; baseUrl: string } | null> {
  const [project] = await getDb()
    .select({ id: projects.id, trackerId: projects.trackerId })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId), isNull(projects.deletedAt)))
    .limit(1);

  if (!project?.trackerId) {
    return null;
  }

  const [tracker] = await getDb()
    .select({
      id: trackers.id,
      systemType: trackers.systemType,
      baseUrl: trackers.baseUrl,
    })
    .from(trackers)
    .where(
      and(
        eq(trackers.id, project.trackerId),
        eq(trackers.userId, userId),
        isNull(trackers.deletedAt),
      ),
    )
    .limit(1);

  return tracker ?? null;
}

/**
 * Builds a `RemoteIssueRefDto` from an inline task-row reference, or `null`
 * when the task is unlinked. `url` is included only when the reference's
 * tracker is currently active (non-soft-deleted).
 */
export function taskRowToRemoteIssueRefDto(
  row: TaskRefRow,
  tracker?: {
    baseUrl: string | null;
    systemType: string | null;
    deletedAt: Date | null;
  } | null,
): RemoteIssueRefDto | null {
  if (
    !row.remoteIssueId ||
    !row.trackerId ||
    !row.remoteIssueCachedTitle ||
    !row.remoteIssueCreatedAt ||
    !row.remoteIssueUpdatedAt
  ) {
    return null;
  }

  const url =
    tracker &&
    tracker.deletedAt === null &&
    tracker.baseUrl != null &&
    isImplementedTrackerSystemType(tracker.systemType)
      ? deriveIssueUrl(tracker.systemType, tracker.baseUrl, row.remoteIssueId)
      : undefined;

  return {
    id: row.id,
    taskId: row.id,
    userId: row.userId,
    trackerId: row.trackerId,
    remoteIssueId: row.remoteIssueId,
    cachedTitle: row.remoteIssueCachedTitle,
    cachedRemoteProjectTitle: row.remoteIssueCachedProjectTitle?.trim() || undefined,
    url,
    createdAt: row.remoteIssueCreatedAt.toISOString(),
    updatedAt: row.remoteIssueUpdatedAt.toISOString(),
  };
}

/**
 * Returns the cached remote issue reference for a single Task, scoped to
 * `userId`, or `null` when none exists.
 */
export async function getRemoteIssueRefForTask(
  userId: string,
  taskId: string,
): Promise<RemoteIssueRefDto | null> {
  const refs = await getRemoteIssueRefsForTasks(userId, [taskId]);
  return refs.get(taskId) ?? null;
}

/**
 * Returns cached remote issue references for many Tasks at once, scoped to
 * `userId`, keyed by `taskId`.
 */
export async function getRemoteIssueRefsForTasks(
  userId: string,
  taskIds: string[],
): Promise<Map<string, RemoteIssueRefDto>> {
  const result = new Map<string, RemoteIssueRefDto>();
  if (taskIds.length === 0) {
    return result;
  }

  const rows = await getDb()
    .select({
      id: tasks.id,
      userId: tasks.userId,
      trackerId: tasks.trackerId,
      remoteIssueId: tasks.remoteIssueId,
      remoteIssueCachedTitle: tasks.remoteIssueCachedTitle,
      remoteIssueCachedProjectTitle: tasks.remoteIssueCachedProjectTitle,
      remoteIssueCreatedAt: tasks.remoteIssueCreatedAt,
      remoteIssueUpdatedAt: tasks.remoteIssueUpdatedAt,
      trackerBaseUrl: trackers.baseUrl,
      trackerSystemType: trackers.systemType,
      trackerDeletedAt: trackers.deletedAt,
    })
    .from(tasks)
    .leftJoin(trackers, eq(tasks.trackerId, trackers.id))
    .where(and(eq(tasks.userId, userId), inArray(tasks.id, taskIds)));

  for (const row of rows) {
    const dto = taskRowToRemoteIssueRefDto(row, {
      baseUrl: row.trackerBaseUrl,
      systemType: row.trackerSystemType,
      deletedAt: row.trackerDeletedAt,
    });
    if (dto) {
      result.set(row.id, dto);
    }
  }

  return result;
}
