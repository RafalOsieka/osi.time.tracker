import { describe, expect, it } from 'vitest';
import {
  localDayKey,
  localDayStartInstant,
  oldestDayKeyAmong,
} from '../../server/utils/timer-view-feed';

describe('timer-view-feed date helpers', () => {
  const tz = 'UTC';

  it('derives local day keys and day starts', () => {
    expect(localDayKey('2024-04-10T15:00:00.000Z', tz)).toBe('2024-04-10');
    expect(localDayStartInstant('2024-04-10', tz)).toBe('2024-04-10T00:00:00Z');
  });

  it('finds the oldest day among instants', () => {
    expect(
      oldestDayKeyAmong(
        ['2024-06-14T10:00:00.000Z', '2024-06-01T10:00:00.000Z', '2024-06-10T10:00:00.000Z'],
        tz,
      ),
    ).toBe('2024-06-01');
    expect(oldestDayKeyAmong([], tz)).toBeNull();
  });

  it('uses the configured timezone for day boundaries (Tokyo)', () => {
    // 2024-03-15 23:30 UTC is already 2024-03-16 in Tokyo
    expect(localDayKey('2024-03-15T23:30:00.000Z', 'Asia/Tokyo')).toBe('2024-03-16');
    expect(localDayStartInstant('2024-03-16', 'Asia/Tokyo')).toBe('2024-03-15T15:00:00Z');
  });

  it('reads day keys from offset instants such as a range-refresh `from`', () => {
    expect(localDayKey('2024-06-01T00:00:00+02:00', 'Europe/Warsaw')).toBe('2024-06-01');
  });
});
