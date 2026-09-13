import { describe, expect, it } from 'vitest';
import { CLIENT_FIXTURES } from '../src/fixture/index.js';
import { isoWeekday, mondayOf, formatIsoDate, parseIsoDate } from '../src/generator/calendar.js';
import { generateLogs, isIssueActive, type GeneratedLog } from '../src/generator/logs.js';

const RUN_DATE = '2026-09-16';
const logs = generateLogs(RUN_DATE);

const logKey = (log: GeneratedLog) =>
  `${log.tracker}|${log.spentOn}|${log.projectIdentifier}|${log.issueSubject}|${log.comment ?? ''}`;

const issueKey = (log: GeneratedLog) => `${log.projectIdentifier}|${log.issueSubject}`;

function byWeek(tracker: GeneratedLog['tracker']) {
  const weeks = new Map<string, GeneratedLog[]>();
  for (const log of logs) {
    if (log.tracker !== tracker) continue;
    const monday = formatIsoDate(mondayOf(parseIsoDate(log.spentOn)));
    weeks.set(monday, [...(weeks.get(monday) ?? []), log]);
  }
  return weeks;
}

function arcOf(log: GeneratedLog) {
  return CLIENT_FIXTURES.find((candidate) => candidate.tracker === log.tracker)
    ?.projects.find((project) => project.identifier === log.projectIdentifier)
    ?.issues.find((issue) => issue.subject === log.issueSubject)?.arc;
}

describe('generateLogs', () => {
  it('only logs weekdays inside the range and never the holiday week', () => {
    const dates = [...new Set(logs.map((log) => log.spentOn))].sort();
    expect(dates[0]).toBe('2026-06-17');
    expect(dates.at(-1)).toBe('2026-09-15');
    expect(dates.some((date) => date >= '2026-08-03' && date <= '2026-08-07')).toBe(false);
    expect(dates.every((date) => isoWeekday(parseIsoDate(date)) <= 5)).toBe(true);
  });

  it('keeps the weekly tracker split and daily totals', () => {
    const totals = new Map<string, number>();
    for (const log of logs) {
      const weekday = isoWeekday(parseIsoDate(log.spentOn));
      if (weekday <= 2) expect(log.tracker).toBe('redmine');
      if (weekday === 3 || weekday === 4) expect(log.tracker).toBe('openproject');
      totals.set(log.spentOn, (totals.get(log.spentOn) ?? 0) + log.durationSeconds);
    }
    for (const [date, seconds] of totals) {
      const hours = seconds / 3600;
      if (isoWeekday(parseIsoDate(date)) === 5) {
        expect(hours).toBeGreaterThanOrEqual(5);
        expect(hours).toBeLessThanOrEqual(6);
      } else {
        expect(hours).toBeGreaterThanOrEqual(6);
        expect(hours).toBeLessThanOrEqual(8);
      }
    }
  });

  it.each(['redmine', 'openproject'] as const)(
    'guarantees the four routing patterns every full week on %s',
    (tracker) => {
      const fixture = CLIENT_FIXTURES.find((candidate) => candidate.tracker === tracker);
      const internalId = fixture?.projects.find((project) => project.internal)?.identifier;
      let fullWeeks = 0;
      for (const [, weekLogs] of byWeek(tracker)) {
        const days = new Set(weekLogs.map((log) => log.spentOn));
        if (days.size < 3) continue;
        fullWeeks += 1;
        const repeated = weekLogs.some(
          (log) =>
            log.comment !== null &&
            weekLogs.some(
              (other) =>
                other.spentOn !== log.spentOn &&
                issueKey(other) === issueKey(log) &&
                other.comment === log.comment,
            ),
        );
        const siblings = weekLogs.some((log) =>
          weekLogs.some(
            (other) =>
              issueKey(other) === issueKey(log) &&
              other.comment !== null &&
              log.comment !== null &&
              other.comment !== log.comment,
          ),
        );
        expect(repeated).toBe(true);
        expect(siblings).toBe(true);
        expect(weekLogs.filter((log) => log.comment === null)).toHaveLength(1);
        expect(weekLogs.some((log) => log.projectIdentifier === internalId)).toBe(true);
      }
      expect(fullWeeks).toBeGreaterThanOrEqual(11);
    },
  );

  it('is deterministic and never repeats an idempotency key', () => {
    expect(generateLogs(RUN_DATE)).toEqual(logs);
    const keys = logs.map(logKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('only references logged fixture issues, with a valid activity index and 15-minute durations', () => {
    for (const log of logs) {
      const fixture = CLIENT_FIXTURES.find((candidate) => candidate.tracker === log.tracker);
      expect(arcOf(log)).not.toBe('open-unlogged');
      expect(log.activityIndex).toBeLessThan(fixture?.activities.length ?? 0);
      expect(log.durationSeconds % 900).toBe(0);
    }
  });

  it('follows the arc: closed-early issues are logged early, in-progress ones late', () => {
    const early = logs.filter((log) => log.spentOn < '2026-07-01');
    const late = logs.filter((log) => log.spentOn > '2026-09-01');
    expect(early.length).toBeGreaterThan(0);
    expect(late.length).toBeGreaterThan(0);
    expect(early.every((log) => arcOf(log) === 'closed-early')).toBe(true);
    expect(late.every((log) => arcOf(log) === 'in-progress')).toBe(true);
    expect(isIssueActive({ subject: 'x', arc: 'open-unlogged', comments: [] }, 0.5)).toBe(false);
  });

  it('shifts the window by a day within the same week without changing shared days', () => {
    const tomorrow = generateLogs('2026-09-17');
    const tomorrowKeys = new Set(tomorrow.map(logKey));
    const dropped = logs.filter((log) => !tomorrowKeys.has(logKey(log)));
    expect(dropped.length).toBeGreaterThan(0);
    expect(dropped.every((log) => log.spentOn === '2026-06-17')).toBe(true);
    const todayKeys = new Set(logs.map(logKey));
    const added = tomorrow.filter((log) => !todayKeys.has(logKey(log)));
    expect(added.length).toBeGreaterThan(0);
    expect(added.every((log) => log.spentOn === '2026-09-16')).toBe(true);
  });
});
