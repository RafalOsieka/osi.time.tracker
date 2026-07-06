import { describe, expect, it } from 'vitest';
import { formatDate } from '../../app/utils/formatDate';

describe('formatDate', () => {
  it('formats an ISO string according to the given locale', () => {
    const iso = '2024-03-15T00:00:00.000Z';
    expect(formatDate(iso, 'en-US')).toBe(new Date(iso).toLocaleDateString('en-US'));
    expect(formatDate(iso, 'pl-PL')).toBe(new Date(iso).toLocaleDateString('pl-PL'));
  });

  it('returns an empty string for empty input', () => {
    expect(formatDate('', 'en-US')).toBe('');
  });

  it('returns an empty string for unparsable input instead of "Invalid Date"', () => {
    expect(formatDate('not-a-date', 'en-US')).toBe('');
  });
});
