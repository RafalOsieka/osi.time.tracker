import { describe, expect, it } from 'vitest';
import { formatDate } from '../../app/utils/format-date';

describe('formatDate', () => {
  it('formats an ISO string as a medium date in the given locale and time zone', () => {
    const iso = '2024-03-15T12:00:00.000Z';
    expect(formatDate(iso, 'en-US', 'UTC')).toBe('Mar 15, 2024');
    expect(formatDate(iso, 'pl-PL', 'UTC')).toBe('15 mar 2024');
  });

  it('returns an empty string for empty input', () => {
    expect(formatDate('', 'en-US')).toBe('');
  });

  it('returns an empty string for unparsable input instead of "Invalid Date"', () => {
    expect(formatDate('not-a-date', 'en-US')).toBe('');
  });
});
