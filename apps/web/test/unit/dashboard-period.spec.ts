import { describe, expect, it } from 'vitest';
import {
  exportBacklogWindow,
  firstDayOfWeekOf,
  periodInstants,
  resolveDashboardPeriod,
} from '../../server/utils/dashboard-period';

const MONDAY = 1;
const SATURDAY = 6;
const SUNDAY = 7;

describe('first day of the week from a timezone', () => {
  it.each([
    ['Europe/Warsaw', MONDAY],
    ['America/New_York', SUNDAY],
    ['Africa/Cairo', SATURDAY],
    ['UTC', MONDAY],
  ])('%s starts its week on day %i', (timeZone, expected) => {
    expect(firstDayOfWeekOf(timeZone)).toBe(expected);
  });
});

describe('resolved Dashboard period', () => {
  const now = new Date('2026-11-24T12:00:00.000Z');

  it('defaults to the month containing today', () => {
    expect(resolveDashboardPeriod({}, now, 'UTC')).toEqual({
      today: '2026-11-24',
      period: { kind: 'month', firstDay: '2026-11-01', lastDay: '2026-11-30' },
    });
  });

  it.each([
    // Still November 30 in New York, already December 1 in Warsaw.
    ['America/New_York', '2026-11-30', '2026-11-01', '2026-11-30'],
    ['Europe/Warsaw', '2026-12-01', '2026-12-01', '2026-12-31'],
  ])('cuts today in %s', (timeZone, today, firstDay, lastDay) => {
    const nearMidnight = new Date('2026-11-30T23:30:00.000Z');
    expect(resolveDashboardPeriod({}, nearMidnight, timeZone)).toEqual({
      today,
      period: { kind: 'month', firstDay, lastDay },
    });
  });

  it.each([
    ['the last instant before', '2026-03-28T22:59:59.999Z', '2026-03-28'],
    ['the first instant of', '2026-03-28T23:00:00.000Z', '2026-03-29'],
    ['the last instant of', '2026-03-29T21:59:59.999Z', '2026-03-29'],
    ['the first instant after', '2026-03-29T22:00:00.000Z', '2026-03-30'],
  ])('cuts today at %s the day the clocks change', (_label, instant, today) => {
    expect(resolveDashboardPeriod({}, new Date(instant), 'Europe/Warsaw').today).toBe(today);
  });

  it.each([
    ['Europe/Warsaw', '2026-11-23', '2026-11-29'],
    ['America/New_York', '2026-11-22', '2026-11-28'],
  ])('cuts the week around today in %s', (timeZone, firstDay, lastDay) => {
    expect(resolveDashboardPeriod({ period: 'week' }, now, timeZone).period).toEqual({
      kind: 'week',
      firstDay,
      lastDay,
    });
  });

  it.each([
    ['2026-12-28', '2026-12-28'],
    ['2027-01-03', '2026-12-28'],
    ['2027-01-04', '2027-01-04'],
  ])('puts %s in the week starting %s', (date, firstDay) => {
    const { period } = resolveDashboardPeriod({ period: 'week', date }, now, 'UTC');
    expect(period.firstDay).toBe(firstDay);
  });

  it.each([
    ['month', '2028-02-29', '2028-02-01', '2028-02-29'],
    ['year', '2025-07-15', '2025-01-01', '2025-12-31'],
  ] as const)('cuts the %s containing %s', (kind, date, firstDay, lastDay) => {
    expect(resolveDashboardPeriod({ period: kind, date }, now, 'UTC').period).toEqual({
      kind,
      firstDay,
      lastDay,
    });
  });
});

describe('Export backlog window', () => {
  it('covers the 30 days before today, across a clock change', () => {
    const window = exportBacklogWindow('2026-11-01');
    expect(window).toEqual({ firstDay: '2026-10-02', lastDay: '2026-10-31' });
    // Summer time in Warsaw ends on October 25.
    expect(periodInstants(window, 'Europe/Warsaw')).toEqual({
      from: new Date('2026-10-01T22:00:00.000Z'),
      to: new Date('2026-10-31T23:00:00.000Z'),
    });
  });
});
