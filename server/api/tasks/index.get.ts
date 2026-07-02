import { db } from '../../db/index';
import { tasks, projects, clients } from '../../db/schema';
import { eq, isNull, asc, and } from 'drizzle-orm';
import type { TaskDto } from '../../../shared/types/task';

export default defineEventHandler(async (event): Promise<TaskDto[]> => {
  const { user } = await requireAuth(event);
  const query = getQuery(event);
  const projectId = typeof query.projectId === 'string' ? query.projectId : undefined;

  const conditions = [eq(tasks.userId, user.id), isNull(tasks.deletedAt)];
  if (projectId === 'none') {
    conditions.push(isNull(tasks.projectId));
  } else if (projectId) {
    conditions.push(eq(tasks.projectId, projectId));
  }

  const rows = await db
    .select({
      id: tasks.id,
      number: tasks.number,
      name: tasks.name,
      projectId: tasks.projectId,
      projectName: projects.name,
      clientName: clients.name,
      createdAt: tasks.createdAt,
    })
    .from(tasks)
    .leftJoin(projects, eq(projects.id, tasks.projectId))
    .leftJoin(clients, eq(clients.id, projects.clientId))
    .where(and(...conditions))
    .orderBy(asc(tasks.number));

  return rows.map((row) => ({
    id: row.id,
    number: row.number,
    name: row.name,
    projectId: row.projectId,
    projectName: row.projectName ?? null,
    clientName: row.clientName ?? null,
    createdAt: row.createdAt.toISOString(),
  }));
});
