import { describe, expect, it } from 'vitest';
import { aggregateLocalDaySeconds, resolveReportMonth } from '../../server/utils/monthly-report';
import {
  currentCalendarMonth,
  monthDateRange,
  monthInstantRange,
} from '../../shared/utils/report-month';

describe('monthly report aggregation', () => {
  it('attributes a midnight-spanning entry to the startedAt local day', () => {
    const days = aggregateLocalDaySeconds(
      [
        {
          startedAt: '2026-08-03T22:00:00.000Z',
          stoppedAt: '2026-08-04T02:00:00.000Z',
        },
      ],
      'UTC',
    );
    expect(days).toEqual([{ date: '2026-08-03', localSeconds: 4 * 3600 }]);
  });

  it('excludes a running timer', () => {
    const days = aggregateLocalDaySeconds(
      [
        {
          startedAt: '2026-08-03T10:00:00.000Z',
          stoppedAt: null,
        },
        {
          startedAt: '2026-08-03T08:00:00.000Z',
          stoppedAt: '2026-08-03T09:00:00.000Z',
        },
      ],
      'UTC',
    );
    expect(days).toEqual([{ date: '2026-08-03', localSeconds: 3600 }]);
  });

  it('returns no days for an empty month', () => {
    expect(aggregateLocalDaySeconds([], 'UTC')).toEqual([]);
  });

  it('buckets startedAt using the report timezone', () => {
    // 2026-08-04 02:30 in Warsaw is still 2026-08-03 23:30 UTC.
    const days = aggregateLocalDaySeconds(
      [
        {
          startedAt: '2026-08-03T23:30:00.000Z',
          stoppedAt: '2026-08-04T00:30:00.000Z',
        },
      ],
      'Europe/Warsaw',
    );
    expect(days).toEqual([{ date: '2026-08-04', localSeconds: 3600 }]);
  });

  it('resolves an omitted month to the current month in the feed timezone', () => {
    const resolved = resolveReportMonth(undefined, new Date('2026-08-15T12:00:00.000Z'), 'UTC');
    expect(resolved).toEqual({ month: '2026-08', timeZone: 'UTC' });
  });

  it('uses UTC when no timezone is stored', () => {
    expect(resolveReportMonth('2026-03', new Date(), null).timeZone).toBe('UTC');
  });

  it('computes inclusive calendar days and exclusive instant end', () => {
    expect(monthDateRange('2026-02')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    const range = monthInstantRange('2026-08', 'UTC');
    expect(range.from).toBe('2026-08-01T00:00:00Z');
    expect(range.to).toBe('2026-09-01T00:00:00Z');
    expect(currentCalendarMonth(new Date('2026-01-01T00:00:00.000Z'), 'UTC')).toBe('2026-01');
  });
});
