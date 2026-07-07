import { and, eq, isNull } from 'drizzle-orm';
import { send, setResponseHeader } from 'h3';
import { db } from '../../db/index';
import { timeEntries } from '../../db/schema';
import { toTimeEntryDto } from '../../utils/time-entries';
import type { TimeEntryDto } from '../../../shared/types/time-entry';

export default defineEventHandler(async (event): Promise<TimeEntryDto | null | undefined> => {
  const { user } = await requireAuth(event);

  const [running] = await db
    .select()
    .from(timeEntries)
    .where(and(eq(timeEntries.userId, user.id), isNull(timeEntries.stoppedAt)))
    .limit(1);

  if (!running) {
    // Returning a bare `null` causes h3 to send an empty 204 response instead
    // of a JSON `null` body, which breaks clients calling `.json()`. Send the
    // literal JSON `null` explicitly so the response body is always valid JSON.
    setResponseHeader(event, 'content-type', 'application/json');
    await send(event, 'null');
    return;
  }

  return toTimeEntryDto(running);
});
