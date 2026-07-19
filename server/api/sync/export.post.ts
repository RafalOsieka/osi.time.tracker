import { and, eq, inArray, isNotNull } from 'drizzle-orm';
import { ZodError } from 'zod';
import {
  finalizeRemoteExportSchema,
  type FinalizeRemoteExportDto,
  type FinalizeRemoteExportResultDto,
} from '../../../shared/types/remote-export';
import { db } from '../../db/index';
import { users, tasks, timeEntries, remoteExports, remoteExportEntries } from '../../db/schema';
import { computeDayBoundary } from '../../utils/day-boundary';
import { getRemoteIssueRefForTask } from '../../utils/remote-issue-refs';
import { mapZodError } from '../../utils/zod-error';
import type { ApiMessage } from '../../types/api-message';

/**
 * Finalizes a browser-orchestrated remote export after OpenProject (or the
 * proxy) returned a remote log id. Re-authorizes the task and selected
 * entries against the requested local day, then appends provenance
 * atomically (REQ-TTR-122 / REQ-TTR-123). Known remote log ids are replayed
 * without creating another remote log or provenance row.
 */
export default defineEventHandler(async (event): Promise<FinalizeRemoteExportResultDto> => {
  const { user } = await requireAuth(event);
  const body = await readBody(event);

  let parsed: FinalizeRemoteExportDto;
  try {
    parsed = finalizeRemoteExportSchema.parse(body);
  } catch (err: unknown) {
    if (err instanceof ZodError) {
      throw createError({
        statusCode: 422,
        data: mapZodError(err) satisfies ApiMessage,
      });
    }
    throw err;
  }

  const uniqueEntryIds = [...new Set(parsed.entryIds)];
  if (uniqueEntryIds.length !== parsed.entryIds.length) {
    throw createError({
      statusCode: 422,
      data: { messageKey: 'error.remoteExportEntryIdsInvalid' } satisfies ApiMessage,
    });
  }

  // Known-result replay: never recreate provenance for an already-finalized remote log.
  const [existing] = await db
    .select()
    .from(remoteExports)
    .where(
      and(eq(remoteExports.userId, user.id), eq(remoteExports.remoteLogId, parsed.remoteLogId)),
    )
    .limit(1);

  if (existing) {
    const links = await db
      .select({ entryId: remoteExportEntries.entryId })
      .from(remoteExportEntries)
      .where(eq(remoteExportEntries.exportId, existing.id));

    return {
      exportId: existing.id,
      taskId: existing.taskId,
      localDate: String(existing.localDate),
      remoteIssueId: existing.remoteIssueId,
      remoteLogId: existing.remoteLogId,
      exportDurationSeconds: existing.exportDurationSeconds,
      requiredFieldValues: existing.requiredFieldValues ?? {},
      entryIds: links.map((link) => link.entryId),
      createdAt: existing.createdAt.toISOString(),
      replayed: true,
    };
  }

  const [task] = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.id, parsed.taskId), eq(tasks.userId, user.id)))
    .limit(1);

  if (!task) {
    throw createError({
      statusCode: 404,
      data: { messageKey: 'error.notFound' } satisfies ApiMessage,
    });
  }

  const issueRef = await getRemoteIssueRefForTask(user.id, parsed.taskId);
  if (!issueRef || issueRef.remoteIssueId !== parsed.remoteIssueId) {
    throw createError({
      statusCode: 422,
      data: { messageKey: 'error.remoteExportIssueMismatch' } satisfies ApiMessage,
    });
  }

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
      stoppedAt: timeEntries.stoppedAt,
    })
    .from(timeEntries)
    .where(
      and(
        eq(timeEntries.userId, user.id),
        inArray(timeEntries.id, uniqueEntryIds),
        isNotNull(timeEntries.stoppedAt),
      ),
    );

  if (entryRows.length !== uniqueEntryIds.length) {
    throw createError({
      statusCode: 422,
      data: { messageKey: 'error.remoteExportEntriesInvalid' } satisfies ApiMessage,
    });
  }

  for (const entry of entryRows) {
    if (entry.taskId !== parsed.taskId) {
      throw createError({
        statusCode: 422,
        data: { messageKey: 'error.remoteExportEntriesInvalid' } satisfies ApiMessage,
      });
    }
    const started = entry.startedAt.getTime();
    if (started < from.getTime() || started >= to.getTime()) {
      throw createError({
        statusCode: 422,
        data: { messageKey: 'error.remoteExportEntriesInvalid' } satisfies ApiMessage,
      });
    }
  }

  const result = await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(remoteExports)
      .values({
        userId: user.id,
        taskId: parsed.taskId,
        localDate: parsed.localDate,
        remoteIssueId: parsed.remoteIssueId,
        remoteLogId: parsed.remoteLogId,
        exportDurationSeconds: parsed.exportDurationSeconds,
        requiredFieldValues: parsed.requiredFieldValues,
      })
      .returning();

    if (!inserted) {
      throw createError({
        statusCode: 500,
        data: { messageKey: 'error.unknown' } satisfies ApiMessage,
      });
    }

    await tx.insert(remoteExportEntries).values(
      uniqueEntryIds.map((entryId) => ({
        exportId: inserted.id,
        entryId,
        userId: user.id,
      })),
    );

    return inserted;
  });

  return {
    exportId: result.id,
    taskId: result.taskId,
    localDate: String(result.localDate),
    remoteIssueId: result.remoteIssueId,
    remoteLogId: result.remoteLogId,
    exportDurationSeconds: result.exportDurationSeconds,
    requiredFieldValues: result.requiredFieldValues ?? {},
    entryIds: uniqueEntryIds,
    createdAt: result.createdAt.toISOString(),
    replayed: false,
  };
});
