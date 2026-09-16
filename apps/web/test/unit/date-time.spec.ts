import { describe, expect, it } from 'vitest';
import {
  computeRollingDayRange,
  instantToZoned,
  instantToZonedDateTime,
  wallClockToInstant,
  zonedDateTimeToInstant,
} from '../../app/utils/date-time';
import { localDayKey } from '../../app/utils/timer-view-grouping';

describe('timezone date utilities', () => {
  it('buckets an instant using the configured timezone', () => {
    const instant = '2024-03-15T23:30:00.000Z';
    expect(localDayKey(instant, 'America/Los_Angeles')).toBe('2024-03-15');
    expect(localDayKey(instant, 'Asia/Tokyo')).toBe('2024-03-16');
  });

  it('computes a rolling N-day window without week alignment', () => {
    const reference = new Date('2024-03-17T12:00:00.000Z');
    const range = computeRollingDayRange(7, reference, 'UTC');
    expect(range.from).toBe('2024-03-11T00:00:00Z');
    expect(range.to).toBe('2024-03-18T00:00:00Z');
  });

  it('uses compatible DST disambiguation', () => {
    expect(wallClockToInstant('2024-03-10', '02:30', 'America/New_York')).toBe(
      '2024-03-10T07:30:00Z',
    );
    expect(instantToZoned('2024-11-03T05:30:00Z', 'America/New_York').hour).toBe(1);
  });
});

describe('ZonedDateTime conversion (REQ-361 segmented time field)', () => {
  it('round-trips an instant preserving seconds and milliseconds', () => {
    const iso = '2024-03-15T10:42:31.812Z';
    const zoned = instantToZonedDateTime(iso, 'America/New_York');
    expect(zonedDateTimeToInstant(zoned)).toBe(iso);
  });

  it('editing hour/minute via set() keeps the date, seconds, and milliseconds', () => {
    const zoned = instantToZonedDateTime('2024-03-15T10:42:31.812Z', 'UTC');
    const edited = zoned.set({ hour: 10, minute: 45 });

    expect(zonedDateTimeToInstant(edited)).toBe('2024-03-15T10:45:31.812Z');
  });

  it('resolves a DST spring-forward gap deterministically', () => {
    // Europe/Warsaw, 2024-03-31: 02:00 CET -> 03:00 CEST, so 02:30 does not exist.
    const zoned = instantToZonedDateTime('2024-03-31T00:30:00.000Z', 'Europe/Warsaw');
    const gap = zoned.set({ hour: 2, minute: 30 });

    expect(zonedDateTimeToInstant(gap)).toBe('2024-03-31T01:30:00.000Z');
  });
});
