import { Temporal } from 'temporal-polyfill';

/**
 * A timezone with its UTC offset at one instant, e.g. "Europe/Warsaw (UTC+01:00)", or plain "UTC".
 * The offset is the one in force at `instant` (DST applies), so a form can say what its wall-clock
 * values mean on the chosen date.
 */
export function timeZoneLabel(timeZone: string, instant: string): string {
  if (timeZone === 'UTC') return timeZone;
  const { offset } = Temporal.Instant.from(instant).toZonedDateTimeISO(timeZone);
  return `${timeZone} (UTC${offset})`;
}
