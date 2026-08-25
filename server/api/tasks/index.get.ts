import { db } from '../../db/index';
import { tasks, projects } from '../../db/schema';
import { eq, isNull, asc, and, ilike } from 'drizzle-orm';
import type { TaskDto } from '../../../shared/types/task';
import { getRemoteIssueRefsForTasks } from '../../utils/remote-issue-refs';

export default defineEventHandler(async (event): Promise<TaskDto[]> => {
  const { user } = await requireAuth(event);
  const query = getQuery<{ projectId?: string; search?: string }>(event);
  const projectId = query.projectId;
  const search = query.search?.trim();

  const conditions = [eq(tasks.userId, user.id)];
  if (projectId === 'none') {
    conditions.push(isNull(tasks.projectId));
  } else if (projectId) {
    conditions.push(eq(tasks.projectId, projectId));
  }
  if (search) {
    conditions.push(ilike(tasks.name, `%${search}%`));
  }

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
    .where(and(...conditions))
    .orderBy(asc(tasks.name));

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
