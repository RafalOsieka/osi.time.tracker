import { and, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '../db/index';
import { tasks, projects, remoteSystemConfigs, remoteIssueRefs } from '../db/schema';
import { deriveIssueUrl } from '../../shared/utils/openproject-adapter';
import type { RemoteIssueRefDto } from '../../shared/types/remote-issue-ref';

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

  const [project] = await db
    .select({ id: projects.id, clientId: projects.clientId })
    .from(projects)
    .where(
      and(eq(projects.id, task.projectId), eq(projects.userId, userId), isNull(projects.deletedAt)),
    )
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
 * Persists or replaces the one-to-one remote issue reference for a Task,
 * overwriting `remoteSystemConfigId`, `remoteIssueId`, and `cachedTitle`.
 */
export async function upsertRemoteIssueRef(
  userId: string,
  taskId: string,
  remoteSystemConfigId: string,
  remoteIssueId: string,
  cachedTitle: string,
): Promise<RemoteIssueRefDto> {
  const [existing] = await db
    .select({ id: remoteIssueRefs.id })
    .from(remoteIssueRefs)
    .where(and(eq(remoteIssueRefs.taskId, taskId), eq(remoteIssueRefs.userId, userId)))
    .limit(1);

  const values = { remoteSystemConfigId, remoteIssueId, cachedTitle };

  const [saved] = existing
    ? await db
        .update(remoteIssueRefs)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(remoteIssueRefs.id, existing.id))
        .returning()
    : await db
        .insert(remoteIssueRefs)
        .values({ taskId, userId, ...values })
        .returning();

  if (!saved) {
    throw new Error('Failed to persist remote issue reference');
  }

  return toDto(saved);
}

/**
 * Idempotently removes the reference for a Task scoped to `userId`.
 * Unlinking a Task with no reference is a no-op.
 */
export async function unlinkRemoteIssueRef(userId: string, taskId: string): Promise<void> {
  await db
    .delete(remoteIssueRefs)
    .where(and(eq(remoteIssueRefs.taskId, taskId), eq(remoteIssueRefs.userId, userId)));
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
      ref: remoteIssueRefs,
      configBaseUrl: remoteSystemConfigs.baseUrl,
      configDeletedAt: remoteSystemConfigs.deletedAt,
    })
    .from(remoteIssueRefs)
    .leftJoin(remoteSystemConfigs, eq(remoteIssueRefs.remoteSystemConfigId, remoteSystemConfigs.id))
    .where(and(eq(remoteIssueRefs.userId, userId), inArray(remoteIssueRefs.taskId, taskIds)));

  for (const row of rows) {
    const isActive = row.configDeletedAt === null && row.configBaseUrl != null;
    result.set(row.ref.taskId, {
      ...toDto(row.ref),
      url: isActive ? deriveIssueUrl(row.configBaseUrl!, row.ref.remoteIssueId) : undefined,
    });
  }

  return result;
}

function toDto(row: typeof remoteIssueRefs.$inferSelect): RemoteIssueRefDto {
  return {
    id: row.id,
    taskId: row.taskId,
    userId: row.userId,
    remoteSystemConfigId: row.remoteSystemConfigId,
    remoteIssueId: row.remoteIssueId,
    cachedTitle: row.cachedTitle,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
