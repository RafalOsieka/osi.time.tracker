import { Temporal } from 'temporal-polyfill';

export interface DateTimeSettings {
  timeZone: string;
}

export const browserDateTimeSettings = (): DateTimeSettings => ({
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
});

export function instantToZoned(iso: string, timeZone: string): Temporal.ZonedDateTime {
  return Temporal.Instant.from(iso).toZonedDateTimeISO(timeZone);
}

export function wallClockToInstant(date: string, time: string, timeZone: string): string {
  const [hour, minute] = time.split(':').map(Number);
  return Temporal.PlainDate.from(date)
    .toPlainDateTime({ hour, minute })
    .toZonedDateTime(timeZone, { disambiguation: 'compatible' })
    .toInstant()
    .toString();
}

export function localDateToPickerDate(date: string, timeZone: string): Date {
  const zoned = Temporal.PlainDate.from(date).toPlainDateTime().toZonedDateTime(timeZone);
  return new Date(zoned.year, zoned.month - 1, zoned.day, zoned.hour, zoned.minute);
}

export function pickerDateToLocalDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export const toPickerDate = localDateToPickerDate;
export const fromPickerDate = pickerDateToLocalDate;

/** Local calendar day key (YYYY-MM-DD) for an ISO instant in `timeZone`. */
export function localDayKeyFromInstant(iso: string, timeZone: string): string {
  return instantToZoned(iso, timeZone).toPlainDate().toString();
}

/** Inclusive start / exclusive end ISO instants. */
export type InstantRange = { from: string; to: string };

/** Inclusive start / exclusive end instants for a local calendar day in `timeZone`. */
export function localDayBounds(dayKey: string, timeZone: string): InstantRange {
  const start = Temporal.PlainDate.from(dayKey).toZonedDateTime(timeZone);
  return {
    from: start.toInstant().toString(),
    to: start.add({ days: 1 }).toInstant().toString(),
  };
}

/**
 * Rolling window of the most recent `days` local calendar days ending on the
 * local day of `anchor` (inclusive of that day). Returns `[from, to)` instants.
 */
export function computeRollingDayRange(
  days: number,
  anchor: Date = new Date(),
  timeZone = 'UTC',
): InstantRange {
  const anchorDay = Temporal.Instant.from(anchor.toISOString())
    .toZonedDateTimeISO(timeZone)
    .toPlainDate();
  const windowStart = anchorDay.subtract({ days: days - 1 });
  const start = windowStart.toZonedDateTime(timeZone);
  const end = windowStart.add({ days }).toZonedDateTime(timeZone);
  return { from: start.toInstant().toString(), to: end.toInstant().toString() };
}
