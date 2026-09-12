import { Temporal } from 'temporal-polyfill';
import type { RouteLogsByScopeGroup } from './remote/route-logs-by-scope';

/** Hard cap on remote logs accepted in one import request (mirrors REQ-339's server-side cap). */
export const IMPORT_REQUEST_MAX_LOGS = 500;

export interface DateRange {
  /** Inclusive `YYYY-MM-DD`. */
  from: string;
  /** Inclusive `YYYY-MM-DD`. */
  to: string;
}

/**
 * Splits an inclusive `[from, to]` local-date range into calendar-month
 * chunks, so the import dialog can scan and import one month at a time
 * (design.md Decision 5). The first and last chunk may be partial months.
 */
export function splitIntoMonthChunks(from: string, to: string): DateRange[] {
  const start = Temporal.PlainDate.from(from);
  const end = Temporal.PlainDate.from(to);
  if (Temporal.PlainDate.compare(start, end) > 0) return [];

  const chunks: DateRange[] = [];
  let cursor = start;
  while (Temporal.PlainDate.compare(cursor, end) <= 0) {
    const monthEnd = cursor.with({ day: cursor.daysInMonth });
    const chunkEnd = Temporal.PlainDate.compare(monthEnd, end) < 0 ? monthEnd : end;
    chunks.push({ from: cursor.toString(), to: chunkEnd.toString() });
    cursor = chunkEnd.add({ days: 1 });
  }
  return chunks;
}

/**
 * Splits routed groups into request-sized batches of at most `maxLogs` total
 * logs (REQ-339), keeping each group's own logs together unless a single
 * group itself exceeds the cap, in which case that group's logs are split
 * across consecutive batches under the same `projectId`.
 */
export function splitGroupsIntoRequestBatches(
  groups: RouteLogsByScopeGroup[],
  maxLogs: number = IMPORT_REQUEST_MAX_LOGS,
): RouteLogsByScopeGroup[][] {
  const batches: RouteLogsByScopeGroup[][] = [];
  let current: RouteLogsByScopeGroup[] = [];
  let currentCount = 0;

  function flush(): void {
    if (current.length > 0) batches.push(current);
    current = [];
    currentCount = 0;
  }

  for (const group of groups) {
    let remaining = group.logs;
    while (remaining.length > 0) {
      const spaceLeft = maxLogs - currentCount;
      if (spaceLeft <= 0) {
        flush();
        continue;
      }
      const take = remaining.slice(0, spaceLeft);
      current.push({ projectId: group.projectId, logs: take });
      currentCount += take.length;
      remaining = remaining.slice(take.length);
    }
  }
  flush();
  return batches;
}
