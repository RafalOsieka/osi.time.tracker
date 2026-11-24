/**
 * Formats a calendar date (`YYYY-MM-DD`). Pass a format in UTC, so the date stays on its day.
 * ICU versions disagree on the kind of space they put in dates, so every space becomes a plain
 * one and the server renders the same text as the browser.
 */
export function formatCalendarDate(format: Intl.DateTimeFormat, date: string): string {
  return format.format(new Date(`${date}T00:00:00Z`)).replace(/\p{Space_Separator}/gu, ' ');
}
