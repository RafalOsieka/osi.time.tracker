/**
 * Deterministic "valid but unknown" UUIDv7 used by e2e negative cases that
 * expect HTTP 404 (well-formed id that does not exist). RFC version nibble
 * is `7` and the variant nibble is RFC 4122 (`8`/`9`/`a`/`b`).
 */
export const UNKNOWN_ID = '01900000-0000-7000-8000-000000000001';

/**
 * Deliberately malformed identifier for cases that assert HTTP 422 from
 * boundary validation before any data access. Zod 4's `z.uuid()` accepts the
 * RFC nil/max sentinels, so this uses an all-zero prefix with a non-zero tail
 * (invalid version nibble) instead of the nil UUID.
 */
export const MALFORMED_ID = '00000000-0000-0000-0000-000000000001';

/**
 * A timezone that is far from midnight now, with its UTC offset and today's date there, so that
 * tests seeding days relative to today keep the same today while they run.
 */
export function zoneAwayFromMidnight() {
  const hour = new Date().getUTCHours();
  const zone =
    hour >= 3 && hour < 21
      ? { timezone: 'UTC', offset: 'Z' }
      : { timezone: 'Asia/Tokyo', offset: '+09:00' };
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone.timezone,
    dateStyle: 'short',
  }).format(new Date());
  return { ...zone, today };
}
