import { and, eq, gte, inArray, isNotNull, isNull, lt, sql } from 'drizzle-orm';
import {
  importRemoteLogsSchema,
  type ImportRemoteLogDto,
  type ImportRemoteLogsResultDto,
  type ImportRemoteLogsProjectResultDto,
} from '../../../../shared/types/remote-log-import';
import { getDb } from '../../../db/index';
import {
  users,
  projects,
  trackers,
  timeEntries,
  remoteExports,
  remoteExportEntries,
} from '../../../db/schema';
import { computeDayBoundary } from '../../../utils/day-boundary';
import { placeImportedEntries, type PlaceableLog } from '../../../utils/import-placement';
import { taskNameFromComment } from '../../../utils/task-name-from-comment';
import { resolveTaskId } from '../../../utils/tasks';
import { isUniqueViolation } from '../../../utils/is-unique-violation';
import { readZodBody } from '../../../utils/zod-input';
import type { ApiMessage } from '../../../types/api-message';

function reject(statusCode: number, messageKey: string): never {
  throw createError({
    statusCode,
    data: { messageKey } satisfies ApiMessage,
  });
}

interface PendingLog extends PlaceableLog {
  projectId: string;
  dto: ImportRemoteLogDto;
}

/**
 * Imports historical remote logs into local history (REQ-334/REQ-335): each
 * log becomes a linked Task, a stopped time entry placed per REQ-337, and
 * export provenance identical in shape to an app-exported entry (REQ-344).
 * Logs already covered by export provenance for this tracker are skipped
 * (REQ-338). Never writes to the tracker itself.
 */
export default defineEventHandler(async (event): Promise<ImportRemoteLogsResultDto> => {
  const db = getDb();
  const { user } = await requireAuth(event);
  const trackerId = getRouterParam(event, 'id');
  const parsed = await readZodBody(event, importRemoteLogsSchema);

  const [tracker] = await db
    .select({ id: trackers.id })
    .from(trackers)
    .where(
      and(eq(trackers.id, trackerId!), eq(trackers.userId, user.id), isNull(trackers.deletedAt)),
    )
    .limit(1);
  if (!tracker) reject(404, 'error.notFound');

  const projectIds = [...new Set(parsed.groups.map((group) => group.projectId))];
  const projectRows = await db
    .select({ id: projects.id, trackerId: projects.trackerId, deletedAt: projects.deletedAt })
    .from(projects)
    .where(and(eq(projects.userId, user.id), inArray(projects.id, projectIds)));
  const projectById = new Map(projectRows.map((row) => [row.id, row]));

  for (const group of parsed.groups) {
    const project = projectById.get(group.projectId);
    if (!project || project.deletedAt != null || project.trackerId !== trackerId) {
      reject(422, 'error.remoteLogImportProjectNotBound');
    }
  }

  const allRemoteLogIds = parsed.groups.flatMap((group) => group.logs.map((l) => l.remoteLogId));
  const existingRows =
    allRemoteLogIds.length > 0
      ? await db
          .select({ remoteLogId: remoteExports.remoteLogId })
          .from(remoteExports)
          .where(
            and(
              eq(remoteExports.userId, user.id),
              eq(remoteExports.trackerId, trackerId!),
              inArray(remoteExports.remoteLogId, allRemoteLogIds),
            ),
          )
      : [];
  const existingIds = new Set(existingRows.map((row) => row.remoteLogId));

  const projectResults = new Map<string, ImportRemoteLogsProjectResultDto>();
  for (const group of parsed.groups) {
    const skippedExisting = group.logs.filter((l) => existingIds.has(l.remoteLogId)).length;
    const wouldImport = group.logs.length - skippedExisting;
    projectResults.set(group.projectId, {
      projectId: group.projectId,
      imported: 0,
      wouldImport,
      skippedExisting,
    });
  }

  if (parsed.dryRun) {
    const projectsResult = [...projectResults.values()];
    return {
      dryRun: true,
      projects: projectsResult,
      totalImported: 0,
      totalWouldImport: projectsResult.reduce((sum, p) => sum + p.wouldImport, 0),
      totalSkippedExisting: projectsResult.reduce((sum, p) => sum + p.skippedExisting, 0),
    };
  }

  const [userRow] = await db
    .select({ timezone: users.timezone })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);
  const timezone = userRow?.timezone ?? null;

  const byDay = new Map<string, PendingLog[]>();
  for (const group of parsed.groups) {
    for (const log of group.logs) {
      if (existingIds.has(log.remoteLogId)) continue;
      const bucket = byDay.get(log.spentOn) ?? [];
      bucket.push({
        projectId: group.projectId,
        dto: log,
        remoteLogId: log.remoteLogId,
        durationSeconds: log.durationSeconds,
      });
      byDay.set(log.spentOn, bucket);
    }
  }

  await db.transaction(async (tx) => {
    for (const [spentOn, pendingLogs] of byDay) {
      const { from: dayStart, to: dayEnd } = computeDayBoundary(spentOn, timezone);

      const [maxStopRow] = await tx
        .select({ maxStoppedAt: sql<Date | null>`max(${timeEntries.stoppedAt})` })
        .from(timeEntries)
        .where(
          and(
            eq(timeEntries.userId, user.id),
            isNotNull(timeEntries.stoppedAt),
            gte(timeEntries.startedAt, dayStart),
            lt(timeEntries.startedAt, dayEnd),
          ),
        );
      // The `sql<Date | null>` annotation is compile-time only: postgres.js
      // does not deserialize a raw aggregate expression's result into a Date
      // the way it does a typed column, so this comes back as an ISO string
      // whenever a row matches. Normalize explicitly rather than trusting it.
      const existingMaxStop = maxStopRow?.maxStoppedAt ? new Date(maxStopRow.maxStoppedAt) : null;

      const placed = placeImportedEntries(dayStart, dayEnd, existingMaxStop, pendingLogs);

      for (const { log: pendingLog, startedAt, stoppedAt } of placed) {
        const { dto: log, projectId } = pendingLog;
        const projectResult = projectResults.get(projectId)!;

        try {
          await tx.transaction(async (savepoint) => {
            const taskName = taskNameFromComment(log.comment);
            const taskId = await resolveTaskId(savepoint, user.id, taskName, projectId, {
              remoteIssueId: log.remoteIssueId,
              trackerId: trackerId!,
              cachedTitle: log.remoteIssueTitle ?? null,
              cachedRemoteProjectTitle: log.remoteProjectTitle ?? null,
            });

            const [entry] = await savepoint
              .insert(timeEntries)
              .values({ userId: user.id, taskId, startedAt, stoppedAt })
              .returning({ id: timeEntries.id });
            if (!entry) reject(500, 'error.unknown');

            const [exportRow] = await savepoint
              .insert(remoteExports)
              .values({
                userId: user.id,
                taskId,
                trackerId: trackerId!,
                localDate: spentOn,
                remoteIssueId: log.remoteIssueId,
                remoteLogId: log.remoteLogId,
                exportDurationSeconds: log.durationSeconds,
                requiredFieldValues: log.activityId ? { activity: log.activityId } : {},
              })
              .returning({ id: remoteExports.id });
            if (!exportRow) reject(500, 'error.unknown');

            await savepoint.insert(remoteExportEntries).values({
              exportId: exportRow.id,
              entryId: entry.id,
              userId: user.id,
            });
          });

          projectResult.imported += 1;
        } catch (err) {
          if (err instanceof Error && isUniqueViolation(err)) {
            // Race with a concurrent import/export of the same remote log
            // (REQ-338): treat as already-linked rather than failing the batch.
            // `wouldImport` is recomputed from `imported` below, so no
            // adjustment is needed here.
            projectResult.skippedExisting += 1;
            continue;
          }
          throw err;
        }
      }
    }
  });

  const projectsResult = [...projectResults.values()].map((p) => ({
    ...p,
    wouldImport: p.imported,
  }));
  return {
    dryRun: false,
    projects: projectsResult,
    totalImported: projectsResult.reduce((sum, p) => sum + p.imported, 0),
    totalWouldImport: projectsResult.reduce((sum, p) => sum + p.wouldImport, 0),
    totalSkippedExisting: projectsResult.reduce((sum, p) => sum + p.skippedExisting, 0),
  };
});
