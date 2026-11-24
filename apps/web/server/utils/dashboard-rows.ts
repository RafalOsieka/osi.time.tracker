import { and, eq, gte, isNotNull, lt } from 'drizzle-orm';
import type { DashboardPeriodDto } from '../../shared/types/dashboard';
import { timeEntries } from '../db/schema';
import { periodInstants } from './dashboard-period';
import type { StoppedEntryInstants } from './monthly-report';

/**
 * Selects the Time entries the Dashboard counts on the given local days: the user's completed
 * ones, each on the day it started.
 */
export function completedEntriesStartedOn(
  userId: string,
  days: Pick<DashboardPeriodDto, 'firstDay' | 'lastDay'>,
  timeZone: string,
) {
  const { from, to } = periodInstants(days, timeZone);
  return and(
    eq(timeEntries.userId, userId),
    isNotNull(timeEntries.stoppedAt),
    gte(timeEntries.startedAt, from),
    lt(timeEntries.startedAt, to),
  );
}

/** A selected Time entry with its instants as ISO strings, which the day math reads. */
export function withIsoInstants<Row extends { startedAt: Date; stoppedAt: Date | null }>({
  startedAt,
  stoppedAt,
  ...row
}: Row): Omit<Row, 'startedAt' | 'stoppedAt'> & StoppedEntryInstants {
  return {
    ...row,
    startedAt: startedAt.toISOString(),
    stoppedAt: stoppedAt?.toISOString() ?? null,
  };
}

/** A Project or Tracker as selected, soft-deleted ones included. */
export interface NamedRow {
  id: string;
  name: string;
  deletedAt: Date | null;
}

/** A Project or Tracker as the Dashboard names it. */
export function namedIdentity({ id, name, deletedAt }: NamedRow) {
  return { id, name, deleted: deletedAt !== null };
}
