import type { TimeEntryDto } from '../../shared/types/time-entry';
import type { RemoteIssueRefDto } from '../../shared/types/remote-issue-ref';
import { instantToZoned, wallClockToInstant } from './dateTime';
import type { DateTimeSettings } from './dateTime';
import { Temporal } from 'temporal-polyfill';

export const UNTITLED_GROUP_KEY = 'untitled';

export interface TimerViewGroup {
  key: string;
  taskId: string | null;
  taskName: string | null;
  projectId: string | null;
  projectName: string | null;
  clientName: string | null;
  remoteIssueRef?: RemoteIssueRefDto;
  entries: TimeEntryDto[];
  totalSeconds: number;
}

export interface TimerViewDay {
  dayKey: string;
  date: Date;
  totalSeconds: number;
  groups: TimerViewGroup[];
}

/** Browser-local day key (YYYY-MM-DD) derived from an ISO instant. */
export function localDayKey(
  iso: string,
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
): string {
  return instantToZoned(iso, timeZone).toPlainDate().toString();
}

export function entryDurationSeconds(entry: TimeEntryDto, now: number = Date.now()): number {
  const start = new Date(entry.startedAt).getTime();
  const end = entry.stoppedAt ? new Date(entry.stoppedAt).getTime() : now;
  return Math.max(0, Math.floor((end - start) / 1000));
}

/** Groups a flat list of time entries by browser-local day, then by task within the day. */
export function groupTimeEntriesByDay(
  entries: TimeEntryDto[],
  now: number = Date.now(),
  settings: DateTimeSettings = {
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    weekStart: 'monday' as const,
  },
): TimerViewDay[] {
  const dayMap = new Map<string, TimerViewDay>();

  for (const entry of entries) {
    const dayKey = localDayKey(entry.startedAt, settings.timeZone);
    let day = dayMap.get(dayKey);
    if (!day) {
      day = {
        dayKey,
        date: new Date(`${dayKey}T00:00:00`),
        totalSeconds: 0,
        groups: [],
      };
      dayMap.set(dayKey, day);
    }

    const groupKey = entry.taskId ?? UNTITLED_GROUP_KEY;
    let group = day.groups.find((g) => g.key === groupKey);
    if (!group) {
      group = {
        key: groupKey,
        taskId: entry.taskId,
        taskName: entry.taskName,
        projectId: entry.projectId,
        projectName: entry.projectName,
        clientName: entry.clientName,
        remoteIssueRef: entry.remoteIssueRef,
        entries: [],
        totalSeconds: 0,
      };
      day.groups.push(group);
    }

    const duration = entryDurationSeconds(entry, now);
    group.entries.push(entry);
    group.totalSeconds += duration;
    day.totalSeconds += duration;
  }

  const days = Array.from(dayMap.values());
  days.sort((a, b) => b.dayKey.localeCompare(a.dayKey));

  for (const day of days) {
    day.groups.sort((a, b) => {
      if (a.key === UNTITLED_GROUP_KEY) return 1;
      if (b.key === UNTITLED_GROUP_KEY) return -1;
      return b.totalSeconds - a.totalSeconds;
    });
    for (const group of day.groups) {
      group.entries.sort(
        (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
      );
    }
  }

  return days;
}

/**
 * Combines a browser-local date (`Date`, time-of-day ignored) with an
 * `HH:mm` wall-clock time into a UTC ISO instant string.
 */
export function combineLocalDateAndTime(
  date: Date,
  time: string,
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
): string {
  const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return wallClockToInstant(dateKey, time, timeZone);
}

/** Extracts the browser-local `HH:mm` wall-clock time from an ISO instant. */
export function isoToLocalTime(
  iso: string,
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
): string {
  const zoned = instantToZoned(iso, timeZone);
  return `${String(zoned.hour).padStart(2, '0')}:${String(zoned.minute).padStart(2, '0')}`;
}

/**
 * Computes the `[from, to)` instant window covering the most recent `daysBack`
 * browser-local days (including today), relative to `referenceDate`.
 */
export function computeWindowRange(
  daysBack: number,
  referenceDate: Date = new Date(),
  settings: DateTimeSettings = {
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    weekStart: 'monday' as const,
  },
): { from: string; to: string } {
  const today = Temporal.Instant.from(referenceDate.toISOString())
    .toZonedDateTimeISO(settings.timeZone)
    .toPlainDate();
  const dayOfWeek = today.dayOfWeek;
  const weekOffset = settings.weekStart === 'sunday' ? dayOfWeek % 7 : dayOfWeek - 1;
  const windowStart =
    daysBack % 7 === 0
      ? today.subtract({ days: weekOffset + daysBack - 7 })
      : today.subtract({ days: daysBack - 1 });
  const start = windowStart.toZonedDateTime(settings.timeZone);
  const to = windowStart.add({ days: daysBack }).toZonedDateTime(settings.timeZone);
  return { from: start.toInstant().toString(), to: to.toInstant().toString() };
}
