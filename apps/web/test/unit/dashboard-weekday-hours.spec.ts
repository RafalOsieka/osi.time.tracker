import { describe, expect, it } from 'vitest';
import { localHourTotals } from '../../server/utils/dashboard-weekday-hours';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** The hours that hold time, as `Weekday hour` to minutes. */
function minutesByHour(totals: number[][]): Record<string, number> {
  return Object.fromEntries(
    totals.flatMap((hours, weekday) =>
      hours.flatMap((milliseconds, hour) =>
        milliseconds === 0 ? [] : [[`${WEEKDAYS[weekday]} ${hour}`, milliseconds / 60_000]],
      ),
    ),
  );
}

function span(startedAt: string, stoppedAt: string) {
  return { startedAt: new Date(startedAt), stoppedAt: new Date(stoppedAt) };
}

/** Wide enough for every span below. */
const ALL = { from: new Date('2026-01-01T00:00:00Z'), to: new Date('2027-01-01T00:00:00Z') };

describe('cutting entries at local hour boundaries', () => {
  it('splits an entry over the hours it touches', () => {
    const totals = localHourTotals(
      [span('2026-11-23T09:15:00+01:00', '2026-11-23T11:45:00+01:00')],
      'Europe/Warsaw',
      ALL,
    );
    expect(minutesByHour(totals)).toEqual({ 'Mon 9': 45, 'Mon 10': 60, 'Mon 11': 45 });
  });

  it('adds up entries in the same hour', () => {
    const totals = localHourTotals(
      [
        span('2026-11-23T09:00:00+01:00', '2026-11-23T09:20:00+01:00'),
        span('2026-11-30T09:40:00+01:00', '2026-11-30T10:00:00+01:00'),
      ],
      'Europe/Warsaw',
      ALL,
    );
    expect(minutesByHour(totals)).toEqual({ 'Mon 9': 40 });
  });

  it('cuts at local hours, not UTC ones', () => {
    const totals = localHourTotals(
      [span('2026-11-23T09:00:00Z', '2026-11-23T10:00:00Z')],
      'Asia/Kolkata',
      ALL,
    );
    expect(minutesByHour(totals)).toEqual({ 'Mon 14': 30, 'Mon 15': 30 });
  });

  it('puts each side of midnight on its own weekday', () => {
    const totals = localHourTotals(
      [span('2026-11-22T23:30:00+01:00', '2026-11-23T00:30:00+01:00')],
      'Europe/Warsaw',
      ALL,
    );
    expect(minutesByHour(totals)).toEqual({ 'Sun 23': 30, 'Mon 0': 30 });
  });

  it('skips the hour the clocks jump over', () => {
    // 01:30 to 03:30 on the clock is one hour: 02:00 becomes 03:00.
    const totals = localHourTotals(
      [span('2026-03-29T01:30:00+01:00', '2026-03-29T03:30:00+02:00')],
      'Europe/Warsaw',
      ALL,
    );
    expect(minutesByHour(totals)).toEqual({ 'Sun 1': 30, 'Sun 3': 30 });
  });

  it('counts both runs of the hour the clocks repeat', () => {
    // 01:30 to 03:30 on the clock is three hours: 03:00 goes back to 02:00.
    const totals = localHourTotals(
      [span('2026-10-25T01:30:00+02:00', '2026-10-25T03:30:00+01:00')],
      'Europe/Warsaw',
      ALL,
    );
    expect(minutesByHour(totals)).toEqual({ 'Sun 1': 30, 'Sun 2': 120, 'Sun 3': 30 });
  });

  it('cuts where the clocks go back two hours, before the hour ends', () => {
    // 02:30 to 03:00 on the clock, back to 01:00, then on to 02:30.
    const totals = localHourTotals(
      [span('2026-10-25T00:30:00Z', '2026-10-25T02:30:00Z')],
      'Antarctica/Troll',
      ALL,
    );
    expect(minutesByHour(totals)).toEqual({ 'Sun 1': 60, 'Sun 2': 60 });
  });

  it('clips entries to the window', () => {
    const window = {
      from: new Date('2026-11-23T00:00:00+01:00'),
      to: new Date('2026-11-24T00:00:00+01:00'),
    };
    const totals = localHourTotals(
      [
        span('2026-11-22T23:00:00+01:00', '2026-11-23T01:00:00+01:00'),
        span('2026-11-23T23:30:00+01:00', '2026-11-24T00:30:00+01:00'),
        span('2026-11-22T10:00:00+01:00', '2026-11-22T11:00:00+01:00'),
        span('2026-11-24T10:00:00+01:00', '2026-11-24T11:00:00+01:00'),
      ],
      'Europe/Warsaw',
      window,
    );
    expect(minutesByHour(totals)).toEqual({ 'Mon 0': 60, 'Mon 23': 30 });
  });

  it('has seven weekdays of 24 hours without entries', () => {
    const totals = localHourTotals([], 'UTC', ALL);
    expect(totals).toHaveLength(7);
    expect(totals.every((hours) => hours.length === 24 && hours.every((ms) => ms === 0))).toBe(
      true,
    );
  });
});
