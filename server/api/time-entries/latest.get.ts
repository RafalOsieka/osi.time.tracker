import { desc, eq } from 'drizzle-orm';
import { send, setResponseHeader } from 'h3';
import { db } from '../../db/index';
import { timeEntries } from '../../db/schema';
import type { LatestTimeEntryDto } from '../../../shared/types/time-entry';

export default defineEventHandler(async (event): Promise<LatestTimeEntryDto | undefined> => {
  const { user } = await requireAuth(event);

  const [latest] = await db
    .select({ startedAt: timeEntries.startedAt })
    .from(timeEntries)
    .where(eq(timeEntries.userId, user.id))
    .orderBy(desc(timeEntries.startedAt))
    .limit(1);

  if (!latest) {
    // Returning a bare `null` causes h3 to send an empty 204 response instead
    // of a JSON `null` body, which breaks clients calling `.json()`. Send the
    // literal JSON `null` explicitly so the response body is always valid JSON.
    setResponseHeader(event, 'content-type', 'application/json');
    await send(event, 'null');
    return;
  }

  return { startedAt: latest.startedAt.toISOString() };
});
