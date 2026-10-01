import { and, eq, gte, sql } from 'drizzle-orm';
import { getDb } from '../db/index';
import { tasks, timeEntries } from '../db/schema';

const RECENT_WINDOW_DAYS = 30;

/**
 * Grouped subquery: seconds the user tracked per project over the last 30 days (REQ-371).
 * A running entry counts up to now. Join it on `projectId`; absent projects mean 0.
 */
export function recentTrackedSecondsSubquery(db: ReturnType<typeof getDb>, userId: string) {
  return db
    .select({
      projectId: tasks.projectId,
      seconds:
        sql<number>`coalesce(sum(extract(epoch from (coalesce(${timeEntries.stoppedAt}, now()) - ${timeEntries.startedAt}))), 0)::bigint`.as(
          'recent_seconds',
        ),
    })
    .from(timeEntries)
    .innerJoin(tasks, eq(tasks.id, timeEntries.taskId))
    .where(
      and(
        eq(timeEntries.userId, userId),
        gte(
          timeEntries.startedAt,
          sql`now() - interval '${sql.raw(String(RECENT_WINDOW_DAYS))} days'`,
        ),
      ),
    )
    .groupBy(tasks.projectId)
    .as('recent_time');
}

/** Recent tracked seconds for one project (used by single-project responses). */
export async function getRecentTrackedSeconds(userId: string, projectId: string): Promise<number> {
  const db = getDb();
  const recent = recentTrackedSecondsSubquery(db, userId);
  const [row] = await db
    .select({ seconds: recent.seconds })
    .from(recent)
    .where(eq(recent.projectId, projectId))
    .limit(1);
  return Number(row?.seconds ?? 0);
}
