import { and, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '../db/index';
import { tasks, projects, remoteSystemConfigs } from '../db/schema';
import { deriveIssueUrl } from '../../shared/remote/issue-url';
import type { RemoteIssueRefDto } from '../../shared/types/remote-issue-ref';
import type { RemoteSystemType } from '../../shared/types/remote-system-config';

type TaskRefRow = {
  id: string;
  userId: string;
  remoteSystemConfigId: string | null;
  remoteIssueId: string | null;
  remoteIssueCachedTitle: string | null;
  remoteIssueCreatedAt: Date | null;
  remoteIssueUpdatedAt: Date | null;
};

/**
 * Resolves the active (non-soft-deleted) remote-system configuration
 * reachable from an owned Task through its Project -> Client chain.
 * Returns `null` when the Task is unowned/unknown, project-less, or the
 * configuration is missing/soft-deleted. Callers enforce any adapter-type
 * restriction (e.g. OpenProject-only).
 */
export async function resolveActiveConfigForTask(
  userId: string,
  taskId: string,
): Promise<{ id: string; systemType: string; baseUrl: string } | null> {
  const [task] = await db
    .select({ id: tasks.id, projectId: tasks.projectId })
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
    .limit(1);

  if (!task || !task.projectId) {
    return null;
  }

  return resolveActiveConfigForProject(userId, task.projectId);
}

/**
 * Resolves the active remote-system configuration for an owned, non-deleted
 * project through its Client chain. Used by day-scoped reassignment when the
 * target project is known without a task id yet.
 */
export async function resolveActiveConfigForProject(
  userId: string,
  projectId: string,
): Promise<{ id: string; systemType: string; baseUrl: string } | null> {
  const [project] = await db
    .select({ id: projects.id, clientId: projects.clientId })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId), isNull(projects.deletedAt)))
    .limit(1);

  if (!project) {
    return null;
  }

  const [config] = await db
    .select({
      id: remoteSystemConfigs.id,
      systemType: remoteSystemConfigs.systemType,
      baseUrl: remoteSystemConfigs.baseUrl,
    })
    .from(remoteSystemConfigs)
    .where(
      and(
        eq(remoteSystemConfigs.clientId, project.clientId),
        eq(remoteSystemConfigs.userId, userId),
        isNull(remoteSystemConfigs.deletedAt),
      ),
    )
    .limit(1);

  return config ?? null;
}

/**
 * Builds a `RemoteIssueRefDto` from an inline task-row reference, or `null`
 * when the task is unlinked. `url` is included only when the reference's
 * configuration is currently active (non-soft-deleted).
 */
export function taskRowToRemoteIssueRefDto(
  row: TaskRefRow,
  config?: {
    baseUrl: string | null;
    systemType: string | null;
    deletedAt: Date | null;
  } | null,
): RemoteIssueRefDto | null {
  if (
    !row.remoteIssueId ||
    !row.remoteSystemConfigId ||
    !row.remoteIssueCachedTitle ||
    !row.remoteIssueCreatedAt ||
    !row.remoteIssueUpdatedAt
  ) {
    return null;
  }

  const isActive =
    !!config && config.deletedAt === null && config.baseUrl != null && config.systemType != null;

  return {
    id: row.id,
    taskId: row.id,
    userId: row.userId,
    remoteSystemConfigId: row.remoteSystemConfigId,
    remoteIssueId: row.remoteIssueId,
    cachedTitle: row.remoteIssueCachedTitle,
    url: isActive
      ? deriveIssueUrl(config.systemType as RemoteSystemType, config.baseUrl!, row.remoteIssueId)
      : undefined,
    createdAt: row.remoteIssueCreatedAt.toISOString(),
    updatedAt: row.remoteIssueUpdatedAt.toISOString(),
  };
}

/**
 * Returns the cached remote issue reference for a single Task, scoped to
 * `userId`, or `null` when none exists. `url` is included only when the
 * reference's configuration is currently active (non-soft-deleted).
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
 * `userId`, keyed by `taskId`. `url` is included only when the reference's
 * configuration is currently active (non-soft-deleted); otherwise the DTO
 * carries only the cached id/title with `url` left undefined.
 */
export async function getRemoteIssueRefsForTasks(
  userId: string,
  taskIds: string[],
): Promise<Map<string, RemoteIssueRefDto>> {
  const result = new Map<string, RemoteIssueRefDto>();
  if (taskIds.length === 0) {
    return result;
  }

  const rows = await db
    .select({
      id: tasks.id,
      userId: tasks.userId,
      remoteSystemConfigId: tasks.remoteSystemConfigId,
      remoteIssueId: tasks.remoteIssueId,
      remoteIssueCachedTitle: tasks.remoteIssueCachedTitle,
      remoteIssueCreatedAt: tasks.remoteIssueCreatedAt,
      remoteIssueUpdatedAt: tasks.remoteIssueUpdatedAt,
      configBaseUrl: remoteSystemConfigs.baseUrl,
      configSystemType: remoteSystemConfigs.systemType,
      configDeletedAt: remoteSystemConfigs.deletedAt,
    })
    .from(tasks)
    .leftJoin(remoteSystemConfigs, eq(tasks.remoteSystemConfigId, remoteSystemConfigs.id))
    .where(and(eq(tasks.userId, userId), inArray(tasks.id, taskIds)));

  for (const row of rows) {
    const dto = taskRowToRemoteIssueRefDto(row, {
      baseUrl: row.configBaseUrl,
      systemType: row.configSystemType,
      deletedAt: row.configDeletedAt,
    });
    if (dto) {
      result.set(row.id, dto);
    }
  }

  return result;
}
