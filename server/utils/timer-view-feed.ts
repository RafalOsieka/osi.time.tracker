import { Temporal } from 'temporal-polyfill';

export function feedTimeZone(stored: string | null | undefined): string {
  return stored && stored.length > 0 ? stored : 'UTC';
}

export function localDayKey(iso: string, timeZone: string): string {
  return Temporal.Instant.from(iso).toZonedDateTimeISO(timeZone).toPlainDate().toString();
}

export function localDayStartInstant(dayKey: string, timeZone: string): string {
  return Temporal.PlainDate.from(dayKey).toZonedDateTime(timeZone).toInstant().toString();
}

/** Inclusive start / exclusive end ISO instants. */
export type InstantRange = { from: string; to: string };

/** Inclusive start / exclusive end of a local calendar day in `timeZone`. */
export function localDayBounds(dayKey: string, timeZone: string): InstantRange {
  const start = Temporal.PlainDate.from(dayKey).toZonedDateTime(timeZone);
  return {
    from: start.toInstant().toString(),
    to: start.add({ days: 1 }).toInstant().toString(),
  };
}

/**
 * Rolling window of the most recent `days` local calendar days ending on the
 * local day of `now` (inclusive of that day). Returns `[from, to)` instants.
 */
export function rollingWindowBounds(days: number, now: Date, timeZone: string): InstantRange {
  const today = Temporal.Instant.from(now.toISOString()).toZonedDateTimeISO(timeZone).toPlainDate();
  const fromDay = today.subtract({ days: days - 1 });
  return {
    from: fromDay.toZonedDateTime(timeZone).toInstant().toString(),
    to: today.add({ days: 1 }).toZonedDateTime(timeZone).toInstant().toString(),
  };
}

/** Oldest local day key among ISO instants, or null when empty. */
export function oldestDayKeyAmong(startedAts: string[], timeZone: string): string | null {
  if (startedAts.length === 0) return null;
  let oldest: string | null = null;
  for (const iso of startedAts) {
    const day = localDayKey(iso, timeZone);
    if (oldest == null || day < oldest) oldest = day;
  }
  return oldest;
}

export function feedNextBefore(oldestDayKey: string | null, timeZone: string): string | null {
  if (!oldestDayKey) return null;
  return localDayStartInstant(oldestDayKey, timeZone);
}
