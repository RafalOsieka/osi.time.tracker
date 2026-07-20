import { and, eq, isNull, gte, lt, inArray } from 'drizzle-orm';
import { ZodError } from 'zod';
import { remoteSyncDayQuerySchema } from '../../../shared/types/remote-sync-day';
import type {
  RemoteSyncDayDto,
  RemoteSyncDayEntryDto,
  RemoteSyncDayQuery,
  RemoteSyncExportProvenanceDto,
} from '../../../shared/types/remote-sync-day';
import { db } from '../../db/index';
import {
  timeEntries,
  tasks,
  projects,
  clients,
  remoteSystemConfigs,
  users,
  remoteExports,
  remoteExportEntries,
} from '../../db/schema';
import { computeDayBoundary } from '../../utils/day-boundary';
import { getRemoteIssueRefsForTasks } from '../../utils/remote-issue-refs';
import { mapZodError } from '../../utils/zod-error';
import type { ApiMessage } from '../../types/api-message';

/**
 * Returns the authenticated user's day-review aggregate (REQ-TTR-118/120/122):
 * one row per Task with entries that day, carrying completed entry details,
 * prior export provenance, the summed unrounded duration, the resolvable
 * Client configuration surface, and the remote issue reference when present,
 * plus the untitled-entries total. The day boundary is computed server-side
 * in the user's configured timezone, mirroring the Timer view's rule. Never
 * includes credential material.
 */
export default defineEventHandler(async (event): Promise<RemoteSyncDayDto> => {
  const { user } = await requireAuth(event);
  const query = getQuery(event);

  let parsedQuery: RemoteSyncDayQuery;
  try {
    parsedQuery = remoteSyncDayQuerySchema.parse(query);
  } catch (err: unknown) {
    if (err instanceof ZodError) {
      throw createError({
        statusCode: 422,
        data: mapZodError(err) satisfies ApiMessage,
      });
    }
    throw err;
  }

  const [userRow] = await db
    .select({ timezone: users.timezone })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  const { from, to } = computeDayBoundary(parsedQuery.date, userRow?.timezone ?? null);

  const rows = await db
    .select({
      entryId: timeEntries.id,
      taskId: timeEntries.taskId,
      taskName: tasks.name,
      projectId: tasks.projectId,
      projectName: projects.name,
      clientId: projects.clientId,
      clientName: clients.name,
      startedAt: timeEntries.startedAt,
      stoppedAt: timeEntries.stoppedAt,
    })
    .from(timeEntries)
    .leftJoin(tasks, eq(tasks.id, timeEntries.taskId))
    .leftJoin(projects, eq(projects.id, tasks.projectId))
    .leftJoin(clients, eq(clients.id, projects.clientId))
    .where(
      and(
        eq(timeEntries.userId, user.id),
        gte(timeEntries.startedAt, from),
        lt(timeEntries.startedAt, to),
      ),
    );

  const clientIds = [...new Set(rows.map((r) => r.clientId).filter((id): id is string => !!id))];
  const configsByClientId = new Map<
    string,
    {
      id: string;
      systemType: 'redmine' | 'openproject';
      baseUrl: string;
      roundingRule: 'none' | 'up_15m' | 'up_30m' | 'up_1h';
      requiredFieldDefaults: Record<string, string>;
    }
  >();
  if (clientIds.length > 0) {
    const configRows = await db
      .select()
      .from(remoteSystemConfigs)
      .where(and(eq(remoteSystemConfigs.userId, user.id), isNull(remoteSystemConfigs.deletedAt)));
    for (const config of configRows) {
      if (config.clientId && clientIds.includes(config.clientId)) {
        configsByClientId.set(config.clientId, {
          id: config.id,
          systemType: config.systemType,
          baseUrl: config.baseUrl,
          roundingRule: config.roundingRule,
          requiredFieldDefaults: config.requiredFieldDefaults,
        });
      }
    }
  }

  const taskIds = [...new Set(rows.map((r) => r.taskId).filter((id): id is string => !!id))];
  const refs = await getRemoteIssueRefsForTasks(user.id, taskIds);

  const completedEntryIds = rows.filter((r) => r.taskId && r.stoppedAt).map((r) => r.entryId);

  const previouslyExportedEntryIds = new Set<string>();
  const exportsByTaskId = new Map<string, RemoteSyncExportProvenanceDto[]>();

  if (taskIds.length > 0) {
    const exportRows = await db
      .select({
        exportId: remoteExports.id,
        taskId: remoteExports.taskId,
        remoteLogId: remoteExports.remoteLogId,
        remoteIssueId: remoteExports.remoteIssueId,
        exportDurationSeconds: remoteExports.exportDurationSeconds,
        requiredFieldValues: remoteExports.requiredFieldValues,
        createdAt: remoteExports.createdAt,
        entryId: remoteExportEntries.entryId,
      })
      .from(remoteExports)
      .leftJoin(remoteExportEntries, eq(remoteExportEntries.exportId, remoteExports.id))
      .where(
        and(
          eq(remoteExports.userId, user.id),
          eq(remoteExports.localDate, parsedQuery.date),
          inArray(remoteExports.taskId, taskIds),
        ),
      );

    const exportEntryIds = new Map<string, string[]>();
    for (const row of exportRows) {
      if (row.entryId) {
        previouslyExportedEntryIds.add(row.entryId);
        const list = exportEntryIds.get(row.exportId) ?? [];
        list.push(row.entryId);
        exportEntryIds.set(row.exportId, list);
      }
    }

    const seenExportIds = new Set<string>();
    for (const row of exportRows) {
      if (seenExportIds.has(row.exportId)) continue;
      seenExportIds.add(row.exportId);
      const provenance: RemoteSyncExportProvenanceDto = {
        exportId: row.exportId,
        remoteLogId: row.remoteLogId,
        remoteIssueId: row.remoteIssueId,
        exportDurationSeconds: row.exportDurationSeconds,
        requiredFieldValues: row.requiredFieldValues ?? {},
        entryIds: exportEntryIds.get(row.exportId) ?? [],
        createdAt: row.createdAt.toISOString(),
      };
      const list = exportsByTaskId.get(row.taskId) ?? [];
      list.push(provenance);
      exportsByTaskId.set(row.taskId, list);
    }
  }

  // Mark entries with any prior provenance (not limited to this local day).
  if (completedEntryIds.length > 0) {
    const links = await db
      .select({ entryId: remoteExportEntries.entryId })
      .from(remoteExportEntries)
      .where(
        and(
          eq(remoteExportEntries.userId, user.id),
          inArray(remoteExportEntries.entryId, completedEntryIds),
        ),
      );
    for (const link of links) {
      previouslyExportedEntryIds.add(link.entryId);
    }
  }

  const rowsByTaskId = new Map<
    string,
    {
      taskId: string;
      taskName: string;
      projectName: string | null;
      clientName: string | null;
      clientId: string | null;
      totalSeconds: number;
      entries: RemoteSyncDayEntryDto[];
    }
  >();
  let untitledTotalSeconds = 0;

  for (const row of rows) {
    const duration = entrySeconds(row.startedAt, row.stoppedAt);
    if (!row.taskId) {
      untitledTotalSeconds += duration;
      continue;
    }
    let entry = rowsByTaskId.get(row.taskId);
    if (!entry) {
      entry = {
        taskId: row.taskId,
        taskName: row.taskName ?? '',
        projectName: row.projectName ?? null,
        clientName: row.clientName ?? null,
        clientId: row.clientId ?? null,
        totalSeconds: 0,
        entries: [],
      };
      rowsByTaskId.set(row.taskId, entry);
    }
    entry.totalSeconds += duration;

    // Only completed entries are selectable for export (REQ-TTR-120).
    if (row.stoppedAt) {
      entry.entries.push({
        id: row.entryId,
        startedAt: row.startedAt.toISOString(),
        stoppedAt: row.stoppedAt.toISOString(),
        durationSeconds: duration,
        previouslyExported: previouslyExportedEntryIds.has(row.entryId),
      });
    }
  }

  const dayRows = Array.from(rowsByTaskId.values()).map((entry) => {
    const config = entry.clientId ? (configsByClientId.get(entry.clientId) ?? null) : null;
    const ref = refs.get(entry.taskId);
    const exportsForTask = exportsByTaskId.get(entry.taskId) ?? [];
    exportsForTask.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    entry.entries.sort((a, b) => a.startedAt.localeCompare(b.startedAt));
    return {
      taskId: entry.taskId,
      taskName: entry.taskName,
      projectName: entry.projectName,
      clientName: entry.clientName,
      totalSeconds: entry.totalSeconds,
      config,
      issueRef: ref ? { remoteIssueId: ref.remoteIssueId, cachedTitle: ref.cachedTitle } : null,
      entries: entry.entries,
      exports: exportsForTask,
    };
  });

  dayRows.sort((a, b) => b.totalSeconds - a.totalSeconds);

  return {
    date: parsedQuery.date,
    rows: dayRows,
    untitledTotalSeconds,
  };
});

function entrySeconds(startedAt: Date, stoppedAt: Date | null): number {
  const start = startedAt.getTime();
  const end = stoppedAt ? stoppedAt.getTime() : Date.now();
  return Math.max(0, Math.floor((end - start) / 1000));
}
