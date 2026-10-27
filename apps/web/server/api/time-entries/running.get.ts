import { and, eq, isNull } from 'drizzle-orm';
import { defineEventHandler } from 'nuxt/server';
import { getDb } from '../../db/index';
import { timeEntries } from '../../db/schema';
import { toTimeEntryDto } from '../../utils/time-entries';
import type { TimeEntryDto } from '../../../shared/types/time-entry';

export default defineEventHandler(async (event): Promise<TimeEntryDto | Response> => {
  const db = getDb();
  const { user } = await requireAuth(event);

  const [running] = await db
    .select()
    .from(timeEntries)
    .where(and(eq(timeEntries.userId, user.id), isNull(timeEntries.stoppedAt)))
    .limit(1);

  if (!running) {
    // Returning a bare `null` makes the server send an empty 204 instead of a
    // JSON `null` body, which breaks clients calling `.json()`. Respond with the
    // literal JSON `null` so the response body is always valid JSON.
    return new Response('null', { headers: { 'content-type': 'application/json' } });
  }

  return toTimeEntryDto(running);
});
