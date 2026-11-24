const DAYS_PER_WEEK = 7;

/** January 2024 opens on a Monday, so its day `n` falls on ISO weekday `n`. */
const WEEK_YEAR = 2024;

/**
 * Formats what has no timezone: calendar dates (`YYYY-MM-DD`), weekdays and hours of a day. The
 * format runs in UTC, so a date stays on its day. ICU versions disagree on the kind of space they
 * put in, so every space becomes a plain one and the server renders the same text as the browser.
 */
export function calendarFormat(locale: string, options: Intl.DateTimeFormatOptions) {
  const format = new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' });
  const plain = (text: string) => text.replace(/\p{Space_Separator}/gu, ' ');
  const instant = (date: string) => new Date(`${date}T00:00:00Z`);
  return {
    date: (date: string) => plain(format.format(instant(date))),
    range: (first: string, last: string) =>
      plain(format.formatRange(instant(first), instant(last))),
    /** An ISO weekday, 1 for Monday. */
    weekday: (isoWeekday: number) => plain(format.format(Date.UTC(WEEK_YEAR, 0, isoWeekday))),
    /** The start of an hour of the day; 24 is the next midnight. */
    hour: (hour: number) => plain(format.format(Date.UTC(WEEK_YEAR, 0, 1, hour))),
  };
}

/** The ISO weekdays of a week that opens on `firstDayOfWeek`, in order. */
export function weekdaysFrom(firstDayOfWeek: number): number[] {
  return Array.from(
    { length: DAYS_PER_WEEK },
    (_, offset) => ((firstDayOfWeek - 1 + offset) % DAYS_PER_WEEK) + 1,
  );
}
