import { getDb } from '../../db/index';
import { trackers } from '../../db/schema';
import { eq, isNull, asc, and } from 'drizzle-orm';
import type { TrackerDto } from '../../../shared/types/tracker';

export default defineEventHandler(async (event): Promise<TrackerDto[]> => {
  const db = getDb();
  const { user } = await requireAuth(event);

  const rows = await db
    .select()
    .from(trackers)
    .where(and(eq(trackers.userId, user.id), isNull(trackers.deletedAt)))
    .orderBy(asc(trackers.name));

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    systemType: row.systemType,
    baseUrl: row.baseUrl,
    executionMode: row.executionMode,
    roundingRule: row.roundingRule,
    requiredFieldDefaults: row.requiredFieldDefaults,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
});
