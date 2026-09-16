import { getDb } from '../../db/index';
import { tasks, projects } from '../../db/schema';
import { eq, isNull, asc, and, ilike, sql } from 'drizzle-orm';
import { listTasksQuerySchema, type TaskDto } from '../../../shared/types/task';
import { getRemoteIssueRefsForTasks } from '../../utils/remote-issue-refs';
import { taskLastUsedAt } from '../../utils/tasks';
import { getZodQuery } from '../../utils/zod-input';

export default defineEventHandler(async (event): Promise<TaskDto[]> => {
  const db = getDb();
  const { user } = await requireAuth(event);
  const { projectId, search, limit } = await getZodQuery(event, listTasksQuerySchema);

  const conditions = [eq(tasks.userId, user.id)];
  if (projectId === 'none') {
    conditions.push(isNull(tasks.projectId));
  } else if (projectId) {
    conditions.push(eq(tasks.projectId, projectId));
  }
  if (search) {
    conditions.push(ilike(tasks.name, `%${search}%`));
  }

  // Ranked most-recently-used first (REQ-133/REQ-137 share this notion of
  // "recently used"), tasks with no entries last, then alphabetically; capped
  // so a large task history never renders unbounded suggestions.
  const lastUsed = taskLastUsedAt(db);
  const rows = await db
    .select({
      id: tasks.id,
      name: tasks.name,
      projectId: tasks.projectId,
      projectName: projects.name,
      createdAt: tasks.createdAt,
    })
    .from(tasks)
    .leftJoin(projects, eq(projects.id, tasks.projectId))
    .leftJoinLateral(lastUsed, sql`true`)
    .where(and(...conditions))
    .orderBy(sql`${lastUsed.lastUsedAt} DESC NULLS LAST`, asc(tasks.name))
    .limit(limit);

  const refs = await getRemoteIssueRefsForTasks(
    user.id,
    rows.map((row) => row.id),
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    projectId: row.projectId,
    projectName: row.projectName ?? null,
    createdAt: row.createdAt.toISOString(),
    remoteIssueRef: refs.get(row.id),
  }));
});
