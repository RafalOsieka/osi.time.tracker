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
