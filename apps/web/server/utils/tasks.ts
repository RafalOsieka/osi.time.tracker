import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import type { PgTransaction } from 'drizzle-orm/pg-core';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { tasks, timeEntries } from '../db/schema';
import type * as schema from '../db/schema';

// oxlint-disable-next-line typescript/no-explicit-any -- drizzle transaction type parameters vary by driver internals and aren't exported in a reusable form
type DrizzleTx = PgTransaction<any, any, any>;

/** Either the process-wide pool from `getDb()` or a transaction bound to it. */
type DrizzleExecutor = DrizzleTx | PostgresJsDatabase<typeof schema>;

/**
 * Correlated lateral subquery yielding a task's most-recently-used entry
 * `startedAt` (or no row when the task has none). Callers select it after
 * `tasks` is already in the query and join with
 * `.leftJoinLateral(taskLastUsedAt(executor), sql\`true\`)`, so each task
 * resolves via one backwards scan of `time_entries (taskId, startedAt)`
 * instead of an aggregate over every entry. Shared by the REQ-137
 * most-recently-used tie-break and the REQ-133 suggestion ranking so both
 * agree on what "most recently used" means.
 */
export function taskLastUsedAt(executor: DrizzleExecutor) {
  return executor
    .select({ lastUsedAt: timeEntries.startedAt })
    .from(timeEntries)
    .where(eq(timeEntries.taskId, tasks.id))
    .orderBy(desc(timeEntries.startedAt))
    .limit(1)
    .as('taskLastUsedAt');
}

export interface ResolveTaskRemoteIssueOptions {
  /**
   * When the property is present, resolution uses the full four-part key
   * `(userId, name, projectId, remoteIssueId)` (null = unlinked). When the
   * property is omitted, free-form titles apply the most-recently-used
   * tie-break over `(userId, name, projectId)` (REQ-137).
   */
  remoteIssueId?: string | null;
  /** Required when creating a newly linked task (`remoteIssueId` is a value). */
  trackerId?: string | null;
  /** Cached issue title stored on a newly linked task. */
  cachedTitle?: string | null;
  /** Cached remote project title stored on a newly linked task. */
  cachedRemoteProjectTitle?: string | null;
}

/**
 * Resolves the task to associate with a time entry: trims `title`, returns
 * `null` for an empty/whitespace-only or missing title, otherwise matches an
 * existing task or creates one.
 *
 * Matching key is `(userId, name, projectId, remoteIssueId)` when
 * `options.remoteIssueId` is supplied (including explicit `null` for
 * unlinked). Without it, candidates matching `(userId, name, projectId)` are
 * tie-broken by most recently used entry `startedAt` (falling back to task
 * creation order), and a new **unlinked** task is created only when none
 * exist.
 */
export async function resolveTaskId(
  tx: DrizzleTx,
  userId: string,
  title: string | null | undefined,
  projectId: string | null | undefined,
  options?: ResolveTaskRemoteIssueOptions,
): Promise<string | null> {
  const trimmedTitle = title?.trim() ?? '';
  if (!trimmedTitle) {
    return null;
  }

  const scopedProjectId = projectId ?? null;
  const projectCondition =
    scopedProjectId === null ? isNull(tasks.projectId) : eq(tasks.projectId, scopedProjectId);

  const exactRemote = options != null && 'remoteIssueId' in options;
  const remoteIssueId = exactRemote ? (options.remoteIssueId ?? null) : null;

  if (exactRemote) {
    const remoteCondition =
      remoteIssueId === null ? isNull(tasks.remoteIssueId) : eq(tasks.remoteIssueId, remoteIssueId);

    const [existing] = await tx
      .select({ id: tasks.id })
      .from(tasks)
      .where(
        and(
          eq(tasks.userId, userId),
          eq(tasks.name, trimmedTitle),
          projectCondition,
          remoteCondition,
        ),
      )
      .limit(1);

    if (existing) {
      return existing.id;
    }

    const now = new Date();
    const linked = remoteIssueId !== null;
    const [created] = await tx
      .insert(tasks)
      .values({
        userId,
        name: trimmedTitle,
        projectId: scopedProjectId,
        remoteIssueId: linked ? remoteIssueId : null,
        trackerId: linked ? (options.trackerId ?? null) : null,
        remoteIssueCachedTitle: linked ? options.cachedTitle?.trim() || remoteIssueId : null,
        remoteIssueCachedProjectTitle: linked
          ? options.cachedRemoteProjectTitle?.trim() || null
          : null,
        remoteIssueCreatedAt: linked ? now : null,
        remoteIssueUpdatedAt: linked ? now : null,
      })
      .returning({ id: tasks.id });

    return created!.id;
  }

  // Tie-break: most recently used task in the (user, name, project) scope.
  const lastUsed = taskLastUsedAt(tx);
  const candidates = await tx
    .select({
      id: tasks.id,
      createdAt: tasks.createdAt,
      lastUsedAt: lastUsed.lastUsedAt,
    })
    .from(tasks)
    .leftJoinLateral(lastUsed, sql`true`)
    .where(and(eq(tasks.userId, userId), eq(tasks.name, trimmedTitle), projectCondition))
    .orderBy(sql`${lastUsed.lastUsedAt} DESC NULLS LAST`, desc(tasks.createdAt))
    .limit(1);

  if (candidates[0]) {
    return candidates[0].id;
  }

  const [created] = await tx
    .insert(tasks)
    .values({
      userId,
      name: trimmedTitle,
      projectId: scopedProjectId,
      remoteIssueId: null,
      trackerId: null,
      remoteIssueCachedTitle: null,
      remoteIssueCachedProjectTitle: null,
      remoteIssueCreatedAt: null,
      remoteIssueUpdatedAt: null,
    })
    .returning({ id: tasks.id });

  return created!.id;
}
