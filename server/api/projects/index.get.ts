import { db } from '../../db/index';
import { projects, trackers } from '../../db/schema';
import { eq, isNull, asc, and } from 'drizzle-orm';
import type { ProjectDto } from '../../../shared/types/project';

export default defineEventHandler(async (event): Promise<ProjectDto[]> => {
  const { user } = await requireAuth(event);
  const query = getQuery<{ trackerId?: string }>(event);
  const trackerIdRaw = query.trackerId;

  const conditions = [eq(projects.userId, user.id), isNull(projects.deletedAt)];
  if (trackerIdRaw === 'null' || trackerIdRaw === 'local') {
    conditions.push(isNull(projects.trackerId));
  } else if (trackerIdRaw) {
    conditions.push(eq(projects.trackerId, trackerIdRaw));
  }

  const rows = await db
    .select({
      id: projects.id,
      name: projects.name,
      trackerId: projects.trackerId,
      trackerName: trackers.name,
      createdAt: projects.createdAt,
    })
    .from(projects)
    // Keep trackerName even when the tracker is soft-deleted (REQ-084).
    .leftJoin(trackers, eq(trackers.id, projects.trackerId))
    .where(and(...conditions))
    .orderBy(asc(projects.name));

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    trackerId: row.trackerId,
    trackerName: row.trackerName ?? null,
    createdAt: row.createdAt.toISOString(),
  }));
});
