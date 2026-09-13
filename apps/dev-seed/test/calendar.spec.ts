import { describe, expect, it } from 'vitest';
import {
  buildCalendar,
  HOLIDAY_WEEKS_BACK,
  isoWeekday,
  parseIsoDate,
  quarterHours,
  splitMinutes,
} from '../src/generator/calendar.js';
import { createRng } from '../src/generator/random.js';

const seeded = (weekMonday: string) => createRng(`test:${weekMonday}`).next;

describe('buildCalendar', () => {
  const calendar = buildCalendar('2026-09-16', seeded);
  const inRange = calendar.filter((day) => day.inRange);

  it('covers every weekday from D-91 to D-1 except the holiday week, and no weekend', () => {
    const dates = inRange.map((day) => day.date);
    expect(dates[0]).toBe('2026-06-17');
    expect(dates.at(-1)).toBe('2026-09-15');
    for (const day of calendar) {
      expect(isoWeekday(parseIsoDate(day.date))).toBeLessThanOrEqual(5);
    }
    // 13 weeks x 5 weekdays, minus the 5-day holiday week.
    expect(dates).toHaveLength(60);
  });

  it('skips exactly the week HOLIDAY_WEEKS_BACK weeks before the run week', () => {
    const holidayMonday = '2026-08-03';
    expect(calendar.some((day) => day.weekMonday === holidayMonday)).toBe(false);
    const weeksBack = new Set(calendar.map((day) => day.weeksBack));
    expect(weeksBack.has(HOLIDAY_WEEKS_BACK)).toBe(false);
    expect(weeksBack.has(HOLIDAY_WEEKS_BACK - 1)).toBe(true);
    expect(weeksBack.has(HOLIDAY_WEEKS_BACK + 1)).toBe(true);
  });

  it('splits the week: Mon/Tue Redmine, Wed/Thu OpenProject, Fri one log on each', () => {
    for (const day of calendar) {
      const weekday = isoWeekday(parseIsoDate(day.date));
      const trackers = day.trackers.map((entry) => entry.tracker);
      if (weekday <= 2) expect(trackers).toEqual(['redmine']);
      else if (weekday <= 4) expect(trackers).toEqual(['openproject']);
      else {
        expect(trackers).toEqual(['redmine', 'openproject']);
        expect(day.trackers.every((entry) => entry.logCount === 1)).toBe(true);
      }
    }
  });

  it('keeps daily budgets inside 6-8 h (5-6 h on Fridays) with 3-4 logs', () => {
    for (const day of calendar) {
      const total = day.trackers.reduce((sum, entry) => sum + entry.budgetMinutes, 0);
      if (isoWeekday(parseIsoDate(day.date)) === 5) {
        expect(total).toBeGreaterThanOrEqual(300);
        expect(total).toBeLessThanOrEqual(360);
      } else {
        expect(total).toBeGreaterThanOrEqual(360);
        expect(total).toBeLessThanOrEqual(480);
        expect(day.trackers[0]?.logCount).toBeGreaterThanOrEqual(3);
        expect(day.trackers[0]?.logCount).toBeLessThanOrEqual(4);
      }
    }
  });

  it('plans whole weeks and flags the days outside the range', () => {
    const firstWeek = calendar.filter((day) => day.weekMonday === '2026-06-15');
    expect(firstWeek.map((day) => day.inRange)).toEqual([false, false, true, true, true]);
    const currentWeek = calendar.filter((day) => day.weeksBack === 0);
    expect(currentWeek.map((day) => day.inRange)).toEqual([true, true, false, false, false]);
    expect(currentWeek[0]?.arcPosition).toBe(1);
  });

  it('plans the same week identically regardless of the run date inside that week', () => {
    const monday = buildCalendar('2026-09-14', seeded).filter(
      (day) => day.weekMonday === '2026-08-10',
    );
    const friday = buildCalendar('2026-09-18', seeded).filter(
      (day) => day.weekMonday === '2026-08-10',
    );
    expect(friday).toEqual(monday);
  });
});

describe('quarterHours / splitMinutes', () => {
  it('produces 15-minute steps inside the bounds', () => {
    const random = createRng('q').next;
    for (let index = 0; index < 50; index += 1) {
      const minutes = quarterHours(random, 360, 480);
      expect(minutes % 15).toBe(0);
      expect(minutes).toBeGreaterThanOrEqual(360);
      expect(minutes).toBeLessThanOrEqual(480);
    }
  });

  it('splits a budget into chunks of at least 30 minutes that sum to the budget', () => {
    const chunks = splitMinutes(createRng('s').next, 435, 4);
    expect(chunks).toHaveLength(4);
    expect(chunks.reduce((sum, chunk) => sum + chunk, 0)).toBe(435);
    for (const chunk of chunks) {
      expect(chunk).toBeGreaterThanOrEqual(30);
      expect(chunk % 15).toBe(0);
    }
  });
});
