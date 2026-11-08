/**
 * The one long form of a calendar day, shared by the Timer view's day headings, the Remote sync
 * stepper and the issue picker: "sobota, 7 listopada 2026" / "Saturday, November 7, 2026", or
 * without the weekday "7 listopada 2026". The locale decides the case: Polish writes weekdays
 * lower-case, even at the start of a heading. `dayKey` is a `YYYY-MM-DD` calendar date, so it is
 * formatted in UTC: the user's timezone already decided which day it is.
 */
export function formatDayHeading(
  dayKey: string,
  locale: string,
  { weekday = true }: { weekday?: boolean } = {},
): string {
  return new Date(`${dayKey}T12:00:00Z`).toLocaleDateString(locale, {
    weekday: weekday ? 'long' : undefined,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}
