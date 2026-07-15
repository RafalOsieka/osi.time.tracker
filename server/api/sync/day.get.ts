import { and, eq, isNull, gte, lt } from 'drizzle-orm';
import { ZodError } from 'zod';
import { remoteSyncDayQuerySchema } from '../../../shared/types/remote-sync-day';
import type { RemoteSyncDayDto, RemoteSyncDayQuery } from '../../../shared/types/remote-sync-day';
import { db } from '../../db/index';
import { timeEntries, tasks, projects, clients, remoteSystemConfigs, users } from '../../db/schema';
import { computeDayBoundary } from '../../utils/day-boundary';
import { getRemoteIssueRefsForTasks } from '../../utils/remote-issue-refs';
import { mapZodError } from '../../utils/zod-error';
import type { ApiMessage } from '../../types/api-message';

/**
 * Returns the authenticated user's day-review aggregate (REQ-TTR-118): one
 * row per Task with entries that day, carrying the summed unrounded
 * duration, the resolvable Client configuration surface, and the remote
 * issue reference when present, plus the untitled-entries total. The day
 * boundary is computed server-side in the user's configured timezone,
 * mirroring the Timer view's rule. Never includes credential material.
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
      transportMode: 'direct' | 'proxied';
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
          transportMode: config.transportMode,
          roundingRule: config.roundingRule,
          requiredFieldDefaults: config.requiredFieldDefaults,
        });
      }
    }
  }

  const taskIds = [...new Set(rows.map((r) => r.taskId).filter((id): id is string => !!id))];
  const refs = await getRemoteIssueRefsForTasks(user.id, taskIds);

  const rowsByTaskId = new Map<
    string,
    {
      taskId: string;
      taskName: string;
      projectName: string | null;
      clientName: string | null;
      clientId: string | null;
      totalSeconds: number;
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
      };
      rowsByTaskId.set(row.taskId, entry);
    }
    entry.totalSeconds += duration;
  }

  const dayRows = Array.from(rowsByTaskId.values()).map((entry) => {
    const config = entry.clientId ? (configsByClientId.get(entry.clientId) ?? null) : null;
    const ref = refs.get(entry.taskId);
    return {
      taskId: entry.taskId,
      taskName: entry.taskName,
      projectName: entry.projectName,
      clientName: entry.clientName,
      totalSeconds: entry.totalSeconds,
      config,
      issueRef: ref ? { remoteIssueId: ref.remoteIssueId, cachedTitle: ref.cachedTitle } : null,
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
