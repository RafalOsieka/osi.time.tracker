import type { TimeEntryDto } from '../../shared/types/time-entry';

export const UNTITLED_GROUP_KEY = 'untitled';

export interface TimerViewGroup {
  key: string;
  taskId: string | null;
  taskName: string | null;
  projectId: string | null;
  projectName: string | null;
  clientName: string | null;
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
export function localDayKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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
): TimerViewDay[] {
  const dayMap = new Map<string, TimerViewDay>();

  for (const entry of entries) {
    const dayKey = localDayKey(entry.startedAt);
    let day = dayMap.get(dayKey);
    if (!day) {
      const d = new Date(entry.startedAt);
      day = {
        dayKey,
        date: new Date(d.getFullYear(), d.getMonth(), d.getDate()),
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
 * Computes the `[from, to)` instant window covering the most recent `daysBack`
 * browser-local days (including today), relative to `referenceDate`.
 */
export function computeWindowRange(
  daysBack: number,
  referenceDate: Date = new Date(),
): { from: string; to: string } {
  const startOfToday = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
  );
  const to = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
  const from = new Date(startOfToday.getTime() - (daysBack - 1) * 24 * 60 * 60 * 1000);
  return { from: from.toISOString(), to: to.toISOString() };
}
