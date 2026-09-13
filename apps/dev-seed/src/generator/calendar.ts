import type { TrackerKey } from '../fixture/types.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Calendar days covered: `[runDate − RANGE_DAYS, runDate − 1]`. */
export const RANGE_DAYS = 91;
/** The week this many weeks before the run date's week has no logs at all. */
export const HOLIDAY_WEEKS_BACK = 6;
/** Weeks counted back from the run date's week; frames the story arc. */
export const FRAME_WEEKS = 13;

export interface TrackerDay {
  tracker: TrackerKey;
  logCount: number;
  budgetMinutes: number;
}

export interface CalendarDay {
  /** `YYYY-MM-DD` */
  date: string;
  /** Monday of this day's week, `YYYY-MM-DD`; the per-week randomness seed. */
  weekMonday: string;
  /** Weeks between the run date's week and this week: 0 = same week. */
  weeksBack: number;
  /** 0..1 position in the story arc; 0 = oldest framed week, 1 = current week. */
  arcPosition: number;
  /** Inside `[runDate − RANGE_DAYS, runDate − 1]`; days outside are planned but not seeded. */
  inRange: boolean;
  trackers: TrackerDay[];
}

/** Parses `YYYY-MM-DD` into a UTC-midnight epoch millisecond value. */
export function parseIsoDate(date: string): number {
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) throw new Error(`invalid date ${date}`);
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function formatIsoDate(epochMs: number): string {
  return new Date(epochMs).toISOString().slice(0, 10);
}

/** ISO weekday 1 (Monday) .. 7 (Sunday). */
export function isoWeekday(epochMs: number): number {
  const day = new Date(epochMs).getUTCDay();
  return day === 0 ? 7 : day;
}

export function mondayOf(epochMs: number): number {
  return epochMs - (isoWeekday(epochMs) - 1) * DAY_MS;
}

/** Picks a 15-minute-step value in `[minMinutes, maxMinutes]`. */
export function quarterHours(random: () => number, minMinutes: number, maxMinutes: number): number {
  const steps = (maxMinutes - minMinutes) / 15;
  return minMinutes + Math.floor(random() * (steps + 1)) * 15;
}

/**
 * Weekday calendar for one run: which tracker is worked on which day, how
 * many logs and how many minutes. Monday/Tuesday go to Redmine
 * (Nordwind), Wednesday/Thursday to OpenProject (Helios), Friday one log on
 * each. Every week that touches the range is planned in full (Monday to
 * Friday) so a day's plan never depends on where the range starts or ends;
 * `randomForWeek` seeds the week, which keeps the plan stable across runs.
 */
export function buildCalendar(
  runDate: string,
  randomForWeek: (weekMonday: string) => () => number,
): CalendarDay[] {
  const run = parseIsoDate(runDate);
  const runMonday = mondayOf(run);
  const rangeStart = run - RANGE_DAYS * DAY_MS;
  const rangeEnd = run - DAY_MS;
  const days: CalendarDay[] = [];

  for (let monday = mondayOf(rangeStart); monday <= rangeEnd; monday += 7 * DAY_MS) {
    const weeksBack = Math.round((runMonday - monday) / (7 * DAY_MS));
    if (weeksBack === HOLIDAY_WEEKS_BACK) continue;
    const weekMonday = formatIsoDate(monday);
    const random = randomForWeek(weekMonday);
    for (let weekday = 1; weekday <= 5; weekday += 1) {
      const epoch = monday + (weekday - 1) * DAY_MS;
      days.push({
        date: formatIsoDate(epoch),
        weekMonday,
        weeksBack,
        arcPosition: Math.min(1, Math.max(0, 1 - weeksBack / FRAME_WEEKS)),
        inRange: epoch >= rangeStart && epoch <= rangeEnd,
        trackers: trackerDaysFor(weekday, random),
      });
    }
  }
  return days;
}

function trackerDaysFor(weekday: number, random: () => number): TrackerDay[] {
  if (weekday === 5) {
    return [
      { tracker: 'redmine', logCount: 1, budgetMinutes: quarterHours(random, 150, 180) },
      { tracker: 'openproject', logCount: 1, budgetMinutes: quarterHours(random, 150, 180) },
    ];
  }
  const tracker: TrackerKey = weekday <= 2 ? 'redmine' : 'openproject';
  return [
    {
      tracker,
      logCount: 3 + Math.floor(random() * 2),
      budgetMinutes: quarterHours(random, 360, 480),
    },
  ];
}

/** Splits `totalMinutes` into `parts` 15-minute-step chunks of at least 30 minutes. */
export function splitMinutes(random: () => number, totalMinutes: number, parts: number): number[] {
  const minimum = 30;
  const chunks = Array.from({ length: parts }, () => minimum);
  let remaining = totalMinutes - minimum * parts;
  while (remaining > 0) {
    const index = Math.floor(random() * parts);
    const chunk = chunks[index];
    if (chunk === undefined) break;
    chunks[index] = chunk + 15;
    remaining -= 15;
  }
  return chunks;
}
