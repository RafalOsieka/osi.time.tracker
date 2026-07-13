import { describe, expect, it } from 'vitest';
import {
  fromPickerDate,
  instantToZoned,
  toPickerDate,
  wallClockToInstant,
} from '../../app/utils/dateTime';
import { computeWindowRange, localDayKey } from '../../app/utils/timerViewGrouping';

describe('timezone date utilities', () => {
  it('buckets an instant using the configured timezone', () => {
    const instant = '2024-03-15T23:30:00.000Z';
    expect(localDayKey(instant, 'America/Los_Angeles')).toBe('2024-03-15');
    expect(localDayKey(instant, 'Asia/Tokyo')).toBe('2024-03-16');
  });

  it('honors Monday and Sunday week starts', () => {
    const reference = new Date('2024-03-17T12:00:00.000Z');
    const monday = computeWindowRange(7, reference, { timeZone: 'UTC', weekStart: 'monday' });
    const sunday = computeWindowRange(7, reference, { timeZone: 'UTC', weekStart: 'sunday' });
    expect(monday.from).toBe('2024-03-11T00:00:00Z');
    expect(sunday.from).toBe('2024-03-17T00:00:00Z');
  });

  it('uses compatible DST disambiguation', () => {
    expect(wallClockToInstant('2024-03-10', '02:30', 'America/New_York')).toBe(
      '2024-03-10T07:30:00Z',
    );
    expect(instantToZoned('2024-11-03T05:30:00Z', 'America/New_York').hour).toBe(1);
  });

  it('round-trips picker dates without changing the calendar day', () => {
    expect(fromPickerDate(toPickerDate('2024-03-15', 'Pacific/Auckland'))).toBe('2024-03-15');
    expect(fromPickerDate(toPickerDate('2024-03-15', 'America/Los_Angeles'))).toBe('2024-03-15');
  });
});
