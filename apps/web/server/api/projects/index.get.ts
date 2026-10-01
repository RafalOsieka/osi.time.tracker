import { getDb } from '../../db/index';
import { projects, trackers } from '../../db/schema';
import { eq, isNull, asc, and } from 'drizzle-orm';
import { listProjectsQuerySchema, type ProjectDto } from '../../../shared/types/project';
import { getZodQuery } from '../../utils/zod-input';
import { recentTrackedSecondsSubquery } from '../../utils/project-recent-time';

export default defineEventHandler(async (event): Promise<ProjectDto[]> => {
  const db = getDb();
  const { user } = await requireAuth(event);
  const { trackerId: trackerIdRaw } = await getZodQuery(event, listProjectsQuerySchema);

  const conditions = [eq(projects.userId, user.id), isNull(projects.deletedAt)];
  if (trackerIdRaw === 'null' || trackerIdRaw === 'local') {
    conditions.push(isNull(projects.trackerId));
  } else if (trackerIdRaw) {
    conditions.push(eq(projects.trackerId, trackerIdRaw));
  }

  const recent = recentTrackedSecondsSubquery(db, user.id);

  const rows = await db
    .select({
      id: projects.id,
      name: projects.name,
      trackerId: projects.trackerId,
      trackerName: trackers.name,
      remoteProjectId: projects.remoteProjectId,
      remoteProjectTitle: projects.remoteProjectTitle,
      recentSeconds: recent.seconds,
      createdAt: projects.createdAt,
    })
    .from(projects)
    // Keep trackerName even when the tracker is soft-deleted (REQ-084).
    .leftJoin(trackers, eq(trackers.id, projects.trackerId))
    .leftJoin(recent, eq(recent.projectId, projects.id))
    .where(and(...conditions))
    .orderBy(asc(projects.name));

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    trackerId: row.trackerId,
    trackerName: row.trackerName ?? null,
    remoteProjectId: row.remoteProjectId,
    remoteProjectTitle: row.remoteProjectTitle,
    recentTrackedSeconds: Number(row.recentSeconds ?? 0),
    createdAt: row.createdAt.toISOString(),
  }));
});
