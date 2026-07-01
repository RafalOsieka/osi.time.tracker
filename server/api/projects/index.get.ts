import { db } from '../../db/index';
import { projects, clients } from '../../db/schema';
import { eq, isNull, asc, and } from 'drizzle-orm';
import type { ProjectDto } from '../../../shared/types/project';

export default defineEventHandler(async (event): Promise<ProjectDto[]> => {
  const { user } = await requireAuth(event);
  const query = getQuery(event);
  const clientId = typeof query.clientId === 'string' ? query.clientId : undefined;

  const conditions = [eq(projects.userId, user.id), isNull(projects.deletedAt)];
  if (clientId) {
    conditions.push(eq(projects.clientId, clientId));
  }

  const rows = await db
    .select({
      id: projects.id,
      name: projects.name,
      clientId: projects.clientId,
      clientName: clients.name,
      createdAt: projects.createdAt,
    })
    .from(projects)
    .leftJoin(clients, eq(clients.id, projects.clientId))
    .where(and(...conditions))
    .orderBy(asc(projects.name));

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    clientId: row.clientId,
    clientName: row.clientName ?? '',
    createdAt: row.createdAt.toISOString(),
  }));
});
