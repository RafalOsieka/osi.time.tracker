import { describe, expect, it } from 'vitest';
import {
  combineLocalDateAndTime,
  computeWindowRange,
  entryDurationSeconds,
  groupTimeEntriesByDay,
  isoToLocalTime,
  localDayKey,
  UNTITLED_GROUP_KEY,
} from '../../app/utils/timerViewGrouping';
import type { TimeEntryDto } from '../../shared/types/time-entry';

function entry(overrides: Partial<TimeEntryDto>): TimeEntryDto {
  return {
    id: 'id',
    taskId: null,
    taskName: null,
    projectId: null,
    projectName: null,
    clientName: null,
    startedAt: '2024-03-15T09:00:00.000Z',
    stoppedAt: '2024-03-15T10:00:00.000Z',
    ...overrides,
  };
}

describe('localDayKey', () => {
  it('derives a browser-local YYYY-MM-DD key from an ISO instant', () => {
    const iso = new Date(2024, 2, 15, 23, 30).toISOString();
    expect(localDayKey(iso)).toBe('2024-03-15');
  });
});

describe('entryDurationSeconds', () => {
  it('computes duration between start and stop', () => {
    const e = entry({
      startedAt: '2024-03-15T09:00:00.000Z',
      stoppedAt: '2024-03-15T09:05:00.000Z',
    });
    expect(entryDurationSeconds(e)).toBe(300);
  });

  it('computes duration up to "now" for a running entry', () => {
    const start = Date.now() - 10_000;
    const e = entry({ startedAt: new Date(start).toISOString(), stoppedAt: null });
    expect(entryDurationSeconds(e, start + 10_000)).toBe(10);
  });
});

describe('groupTimeEntriesByDay', () => {
  it('groups entries by local day, newest day first', () => {
    const e1 = entry({
      id: '1',
      startedAt: '2024-03-14T09:00:00.000Z',
      stoppedAt: '2024-03-14T10:00:00.000Z',
    });
    const e2 = entry({
      id: '2',
      startedAt: '2024-03-15T09:00:00.000Z',
      stoppedAt: '2024-03-15T10:00:00.000Z',
    });
    const days = groupTimeEntriesByDay([e1, e2]);
    expect(days.map((d) => d.dayKey)).toEqual(['2024-03-15', '2024-03-14']);
  });

  it('groups by task within a day, with an untitled bucket', () => {
    const titled = entry({
      id: '1',
      taskId: 'task-1',
      taskName: 'Task One',
      projectId: 'proj-1',
      projectName: 'Project One',
      clientName: 'Client One',
    });
    const untitled = entry({
      id: '2',
      taskId: null,
      startedAt: '2024-03-15T11:00:00.000Z',
      stoppedAt: '2024-03-15T11:30:00.000Z',
    });
    const days = groupTimeEntriesByDay([titled, untitled]);
    expect(days).toHaveLength(1);
    const day = days[0]!;
    expect(day.groups.map((g) => g.key)).toEqual(['task-1', UNTITLED_GROUP_KEY]);
    expect(day.groups[0]!.totalSeconds).toBe(3600);
    expect(day.groups[1]!.totalSeconds).toBe(1800);
    expect(day.totalSeconds).toBe(3600 + 1800);
  });

  it('sorts the untitled bucket last regardless of duration', () => {
    const untitled = entry({
      id: '1',
      taskId: null,
      startedAt: '2024-03-15T09:00:00.000Z',
      stoppedAt: '2024-03-15T12:00:00.000Z',
    });
    const titled = entry({
      id: '2',
      taskId: 'task-1',
      taskName: 'Task',
      startedAt: '2024-03-15T13:00:00.000Z',
      stoppedAt: '2024-03-15T13:05:00.000Z',
    });
    const day = groupTimeEntriesByDay([untitled, titled])[0]!;
    expect(day.groups.map((g) => g.key)).toEqual(['task-1', UNTITLED_GROUP_KEY]);
  });
});

describe('combineLocalDateAndTime', () => {
  it('combines a local date with an HH:mm time into a UTC ISO instant', () => {
    const date = new Date(2024, 2, 15);
    const iso = combineLocalDateAndTime(date, '09:30');
    expect(new Date(iso).getTime()).toBe(new Date(2024, 2, 15, 9, 30).getTime());
  });
});

describe('isoToLocalTime', () => {
  it('extracts the browser-local HH:mm time from an ISO instant', () => {
    const iso = new Date(2024, 2, 15, 9, 30).toISOString();
    expect(isoToLocalTime(iso)).toBe('09:30');
  });
});

describe('computeWindowRange', () => {
  it('covers the most recent N local days including today', () => {
    const reference = new Date(2024, 2, 15, 10, 30);
    const { from, to } = computeWindowRange(7, reference);
    expect(new Date(to).getTime()).toBe(new Date(2024, 2, 18, 0, 0).getTime());
    expect(new Date(from).getTime()).toBe(new Date(2024, 2, 11, 0, 0).getTime());
  });

  it('aligns a past-week anchor to that week start (monday)', () => {
    // Wednesday 2024-02-28 → monday-aligned week starts 2024-02-26
    const anchor = new Date('2024-02-28T15:00:00.000Z');
    const settings = { timeZone: 'UTC', weekStart: 'monday' as const };
    const { from, to } = computeWindowRange(7, anchor, settings);
    expect(from).toBe('2024-02-26T00:00:00Z');
    expect(to).toBe('2024-03-04T00:00:00Z');
  });

  it('aligns a past-week anchor to that week start (sunday)', () => {
    // Wednesday 2024-02-28 → sunday-aligned week starts 2024-02-25
    const anchor = new Date('2024-02-28T15:00:00.000Z');
    const settings = { timeZone: 'UTC', weekStart: 'sunday' as const };
    const { from, to } = computeWindowRange(7, anchor, settings);
    expect(from).toBe('2024-02-25T00:00:00Z');
    expect(to).toBe('2024-03-03T00:00:00Z');
  });

  it('yields the current window when the anchor falls in the current week', () => {
    const now = new Date('2024-03-13T12:00:00.000Z'); // Wednesday
    const anchorInCurrentWeek = new Date('2024-03-11T09:00:00.000Z'); // Monday
    const settings = { timeZone: 'UTC', weekStart: 'monday' as const };
    const current = computeWindowRange(7, now, settings);
    const anchored = computeWindowRange(7, anchorInCurrentWeek, settings);
    expect(anchored).toEqual(current);
    expect(anchored.from).toBe('2024-03-11T00:00:00Z');
    expect(anchored.to).toBe('2024-03-18T00:00:00Z');
  });

  it('extends further back from the anchored start on load more', () => {
    const anchor = new Date('2024-02-28T15:00:00.000Z');
    const settings = { timeZone: 'UTC', weekStart: 'monday' as const };
    const first = computeWindowRange(7, anchor, settings);
    const more = computeWindowRange(14, anchor, settings);
    expect(first.from).toBe('2024-02-26T00:00:00Z');
    expect(more.from).toBe('2024-02-19T00:00:00Z');
    expect(more.to).toBe('2024-03-04T00:00:00Z');
  });

  it('covers a DST spring-forward boundary week in America/Los_Angeles', () => {
    // US DST spring forward 2024-03-10; anchor Tuesday 2024-03-12 local.
    const anchor = new Date('2024-03-12T18:00:00.000Z');
    const settings = { timeZone: 'America/Los_Angeles', weekStart: 'monday' as const };
    const { from, to } = computeWindowRange(7, anchor, settings);
    // Monday 2024-03-11 00:00 PDT (UTC-7) through Monday 2024-03-18 00:00 PDT
    expect(from).toBe('2024-03-11T07:00:00Z');
    expect(to).toBe('2024-03-18T07:00:00Z');
  });
});
