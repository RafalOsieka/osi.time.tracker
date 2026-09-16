import { Temporal } from 'temporal-polyfill';
import { fromAbsolute, type ZonedDateTime } from '@internationalized/date';

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

/** Local calendar day key (YYYY-MM-DD) for an ISO instant in `timeZone`. */
export function localDayKeyFromInstant(iso: string, timeZone: string): string {
  return instantToZoned(iso, timeZone).toPlainDate().toString();
}

/**
 * Converts an ISO instant to an `@internationalized/date` `ZonedDateTime` in
 * `timeZone`, for the segmented time field (REQ-361 shared-ui-components).
 * Unlike `wallClockToInstant`, editing only the hour/minute of the result via
 * `.set({ hour, minute })` preserves the seconds and milliseconds of `iso`.
 */
export function instantToZonedDateTime(iso: string, timeZone: string): ZonedDateTime {
  return fromAbsolute(Date.parse(iso), timeZone);
}

/** Converts a `ZonedDateTime` (REQ-361) back to an ISO instant string. */
export function zonedDateTimeToInstant(value: ZonedDateTime): string {
  return value.toDate().toISOString();
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
