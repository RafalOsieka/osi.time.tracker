import { and, desc, eq, lt, or, isNull, gte } from 'drizzle-orm';
import { listTimeEntriesQuerySchema } from '../../../shared/types/time-entry';
import type { TimeEntryDto } from '../../../shared/types/time-entry';
import { db } from '../../db/index';
import { timeEntries, tasks, projects } from '../../db/schema';
import { getRemoteIssueRefsForTasks } from '../../utils/remote-issue-refs';
import { getZodQuery } from '../../utils/zod-input';

export default defineEventHandler(async (event): Promise<TimeEntryDto[]> => {
  const { user } = await requireAuth(event);
  const parsedQuery = await getZodQuery(event, listTimeEntriesQuerySchema);

  const from = new Date(parsedQuery.from);
  const to = new Date(parsedQuery.to);

  const rows = await db
    .select({
      id: timeEntries.id,
      taskId: timeEntries.taskId,
      taskName: tasks.name,
      projectId: tasks.projectId,
      projectName: projects.name,
      startedAt: timeEntries.startedAt,
      stoppedAt: timeEntries.stoppedAt,
    })
    .from(timeEntries)
    .leftJoin(tasks, eq(tasks.id, timeEntries.taskId))
    .leftJoin(projects, eq(projects.id, tasks.projectId))
    .where(
      and(
        eq(timeEntries.userId, user.id),
        lt(timeEntries.startedAt, to),
        or(isNull(timeEntries.stoppedAt), gte(timeEntries.stoppedAt, from)),
      ),
    )
    .orderBy(desc(timeEntries.startedAt));

  const taskIds = [...new Set(rows.map((row) => row.taskId).filter((id): id is string => !!id))];
  const refs = await getRemoteIssueRefsForTasks(user.id, taskIds);

  return rows.map((row) => ({
    id: row.id,
    taskId: row.taskId,
    taskName: row.taskName ?? null,
    projectId: row.projectId ?? null,
    projectName: row.projectName ?? null,
    startedAt: row.startedAt.toISOString(),
    stoppedAt: row.stoppedAt ? row.stoppedAt.toISOString() : null,
    remoteIssueRef: row.taskId ? refs.get(row.taskId) : undefined,
  }));
});
