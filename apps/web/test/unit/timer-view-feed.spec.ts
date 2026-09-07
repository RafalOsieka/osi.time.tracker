import { describe, expect, it } from 'vitest';
import {
  feedNextBefore,
  localDayBounds,
  localDayKey,
  oldestDayKeyAmong,
  rollingWindowBounds,
} from '../../server/utils/timer-view-feed';

describe('timer-view-feed date helpers', () => {
  const tz = 'UTC';

  it('computes a rolling 30-day window ending on the anchor local day', () => {
    const now = new Date('2024-06-15T12:00:00.000Z');
    const window = rollingWindowBounds(30, now, tz);
    expect(window.from).toBe('2024-05-17T00:00:00Z');
    expect(window.to).toBe('2024-06-16T00:00:00Z');
  });

  it('derives local day keys and bounds', () => {
    expect(localDayKey('2024-04-10T15:00:00.000Z', tz)).toBe('2024-04-10');
    expect(localDayBounds('2024-04-10', tz)).toEqual({
      from: '2024-04-10T00:00:00Z',
      to: '2024-04-11T00:00:00Z',
    });
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

  it('builds nextBefore from the oldest loaded day', () => {
    expect(feedNextBefore('2024-06-01', tz)).toBe('2024-06-01T00:00:00Z');
    expect(feedNextBefore(null, tz)).toBeNull();
  });

  it('uses the configured timezone for day boundaries (Tokyo)', () => {
    // 2024-03-15 23:30 UTC is already 2024-03-16 in Tokyo
    expect(localDayKey('2024-03-15T23:30:00.000Z', 'Asia/Tokyo')).toBe('2024-03-16');
    const bounds = localDayBounds('2024-03-16', 'Asia/Tokyo');
    expect(bounds.from).toBe('2024-03-15T15:00:00Z');
    expect(bounds.to).toBe('2024-03-16T15:00:00Z');
  });
});
