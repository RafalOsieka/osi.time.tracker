import { afterEach, describe, expect, it, vi } from 'vitest';
import { calendarFormat, weekdaysFrom } from '../../app/utils/calendar-format';

describe('calendarFormat', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('keeps a date on its day whatever the runtime timezone', () => {
    // West of UTC, the date's midnight in UTC is still the day before.
    vi.stubEnv('TZ', 'America/Los_Angeles');
    expect(calendarFormat('en-US', { dateStyle: 'medium' }).date('2026-03-01')).toBe('Mar 1, 2026');
  });

  it('writes plain spaces, which ICU versions would otherwise render differently', () => {
    const hour = calendarFormat('en-US', { hour: 'numeric' }).hour(21);
    expect(hour).toBe('9 PM');
    const week = calendarFormat('en-US', { dateStyle: 'medium' }).range('2026-11-16', '2026-11-22');
    expect(week).toBe('Nov 16 – 22, 2026');
  });

  it('names an ISO weekday and the hour after the last as midnight', () => {
    const weekday = calendarFormat('pl', { weekday: 'long' });
    expect([1, 7].map(weekday.weekday)).toEqual(['poniedziałek', 'niedziela']);
    expect(calendarFormat('pl', { hour: 'numeric', minute: '2-digit' }).hour(24)).toBe('0:00');
  });
});

describe('weekdaysFrom', () => {
  it('wraps a week that opens on Sunday back to Saturday', () => {
    expect(weekdaysFrom(7)).toEqual([7, 1, 2, 3, 4, 5, 6]);
  });
});
