import { and, eq, isNull } from 'drizzle-orm';
import type { PgTransaction } from 'drizzle-orm/pg-core';
import { tasks } from '../db/schema';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- drizzle transaction type parameters vary by driver internals and aren't exported in a reusable form
type DrizzleTx = PgTransaction<any, any, any>;

/**
 * Resolves the task to associate with a time entry: trims `title`, returns
 * `null` for an empty/whitespace-only or missing title, otherwise matches an
 * existing non-deleted task scoped to `(userId, name, projectId)` (matching
 * `projectId ?? null` so project-less titles match project-less tasks), or
 * creates a new task when no match exists. Must run inside `tx` so the
 * lookup/insert participates in the caller's transaction.
 */
export async function resolveTaskId(
  tx: DrizzleTx,
  userId: string,
  title: string | null | undefined,
  projectId: string | null | undefined,
): Promise<string | null> {
  const trimmedTitle = title?.trim() ?? '';
  if (!trimmedTitle) {
    return null;
  }

  const scopedProjectId = projectId ?? null;
  const projectCondition =
    scopedProjectId === null ? isNull(tasks.projectId) : eq(tasks.projectId, scopedProjectId);

  const [existing] = await tx
    .select({ id: tasks.id })
    .from(tasks)
    .where(
      and(
        eq(tasks.userId, userId),
        eq(tasks.name, trimmedTitle),
        projectCondition,
        isNull(tasks.deletedAt),
      ),
    )
    .limit(1);

  if (existing) {
    return existing.id;
  }

  const [created] = await tx
    .insert(tasks)
    .values({ userId, name: trimmedTitle, projectId: scopedProjectId })
    .returning({ id: tasks.id });

  return created!.id;
}
