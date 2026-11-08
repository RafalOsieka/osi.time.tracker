import { describe, expect, it } from 'vitest';
import { formatDayHeading } from '../../app/utils/format-day-heading';

describe('formatDayHeading', () => {
  it('writes the full Polish day with the weekday lower-case, as Polish does', () => {
    expect(formatDayHeading('2026-11-07', 'pl')).toBe('sobota, 7 listopada 2026');
    expect(formatDayHeading('2026-11-07', 'pl', { weekday: false })).toBe('7 listopada 2026');
  });

  it('writes the full English day', () => {
    expect(formatDayHeading('2026-11-07', 'en')).toBe('Saturday, November 7, 2026');
  });

  it('keeps the calendar day whatever the runtime timezone', () => {
    // A day key is a date, not an instant: no zone may move it to a neighbour.
    expect(formatDayHeading('2026-01-01', 'en', { weekday: false })).toBe('January 1, 2026');
  });
});
