import { and, eq, gte, isNotNull, lt } from 'drizzle-orm';
import type { FinalizeRemoteExportResultDto } from '../../../shared/types/remote-export';
import { linkRemoteEntrySchema } from '../../../shared/types/remote-export';
import { getDb } from '../../db';
import {
  users,
  tasks,
  timeEntries,
  remoteExports,
  remoteExportEntries,
  trackers,
} from '../../db/schema';
import { computeDayBoundary } from '../../utils/day-boundary';
import { getRemoteIssueRefForTask } from '../../utils/remote-issue-refs';
import { isUniqueViolation } from '../../utils/is-unique-violation';
import { readZodBody } from '../../utils/zod-input';
import type { ApiMessage } from '../../types/api-message';

function reject(statusCode: number, messageKey: string): never {
  throw createError({
    statusCode,
    data: { messageKey } satisfies ApiMessage,
  });
}

export default defineEventHandler(async (event): Promise<FinalizeRemoteExportResultDto> => {
  const db = getDb();
  const { user } = await requireAuth(event);
  const parsed = await readZodBody(event, linkRemoteEntrySchema);

  if (parsed.spentOn !== parsed.localDate) {
    reject(422, 'error.remoteExportLinkMismatch');
  }

  const [task] = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.id, parsed.taskId), eq(tasks.userId, user.id)))
    .limit(1);
  if (!task) reject(404, 'error.notFound');

  const [tracker] = await db
    .select({ id: trackers.id })
    .from(trackers)
    .where(and(eq(trackers.id, parsed.trackerId), eq(trackers.userId, user.id)))
    .limit(1);
  if (!tracker) reject(404, 'error.notFound');

  const issueRef = await getRemoteIssueRefForTask(user.id, parsed.taskId);
  if (
    !issueRef ||
    issueRef.trackerId !== parsed.trackerId ||
    issueRef.remoteIssueId !== parsed.remoteIssueId
  ) {
    reject(422, 'error.remoteExportLinkMismatch');
  }

  const [existingIdentity] = await db
    .select({ id: remoteExports.id })
    .from(remoteExports)
    .where(
      and(
        eq(remoteExports.userId, user.id),
        eq(remoteExports.trackerId, parsed.trackerId),
        eq(remoteExports.remoteLogId, parsed.remoteLogId),
      ),
    )
    .limit(1);
  if (existingIdentity) reject(422, 'error.remoteExportAlreadyLinked');

  const [existingDay] = await db
    .select({ id: remoteExports.id })
    .from(remoteExports)
    .where(
      and(
        eq(remoteExports.userId, user.id),
        eq(remoteExports.taskId, parsed.taskId),
        eq(remoteExports.localDate, parsed.localDate),
      ),
    )
    .limit(1);
  if (existingDay) reject(422, 'error.remoteExportAlreadyFinalized');

  const [userRow] = await db
    .select({ timezone: users.timezone })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);
  const { from, to } = computeDayBoundary(parsed.localDate, userRow?.timezone ?? null);

  const entryRows = await db
    .select({
      id: timeEntries.id,
      taskId: timeEntries.taskId,
      startedAt: timeEntries.startedAt,
    })
    .from(timeEntries)
    .where(
      and(
        eq(timeEntries.userId, user.id),
        eq(timeEntries.taskId, parsed.taskId),
        isNotNull(timeEntries.stoppedAt),
        gte(timeEntries.startedAt, from),
        lt(timeEntries.startedAt, to),
      ),
    );

  if (entryRows.length === 0) {
    reject(422, 'error.remoteExportEntriesInvalid');
  }

  const entryIds = entryRows.map((row) => row.id);

  try {
    const inserted = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(remoteExports)
        .values({
          userId: user.id,
          taskId: parsed.taskId,
          trackerId: parsed.trackerId,
          localDate: parsed.localDate,
          remoteIssueId: parsed.remoteIssueId,
          remoteLogId: parsed.remoteLogId,
          exportDurationSeconds: parsed.exportDurationSeconds,
          requiredFieldValues: parsed.requiredFieldValues,
        })
        .returning();
      if (!row) reject(500, 'error.unknown');
      await tx.insert(remoteExportEntries).values(
        entryIds.map((entryId) => ({
          exportId: row.id,
          entryId,
          userId: user.id,
        })),
      );
      return row;
    });

    return {
      exportId: inserted.id,
      taskId: inserted.taskId,
      trackerId: inserted.trackerId,
      localDate: String(inserted.localDate),
      remoteIssueId: inserted.remoteIssueId,
      remoteLogId: inserted.remoteLogId,
      exportDurationSeconds: inserted.exportDurationSeconds,
      requiredFieldValues: inserted.requiredFieldValues ?? {},
      entryIds,
      exportRequestKey: inserted.exportRequestKey ?? null,
      createdAt: inserted.createdAt.toISOString(),
      replayed: false,
    };
  } catch (err) {
    if (err instanceof Error && isUniqueViolation(err)) {
      reject(422, 'error.remoteExportAlreadyLinked');
    }
    throw err;
  }
});
