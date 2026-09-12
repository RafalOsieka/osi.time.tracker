import { describe, expect, it } from 'vitest';
import { Temporal } from 'temporal-polyfill';
import { placeImportedEntries, type PlaceableLog } from '../../server/utils/import-placement';

/** Local day boundary as instants, mirroring `computeDayBoundary`. */
function dayBoundary(date: string, timeZone: string) {
  const start = Temporal.PlainDate.from(date).toZonedDateTime(timeZone);
  const end = start.add({ days: 1 });
  return {
    dayStart: new Date(start.toInstant().toString()),
    dayEnd: new Date(end.toInstant().toString()),
  };
}

function log(remoteLogId: string, hours: number): PlaceableLog {
  return { remoteLogId, durationSeconds: hours * 3600 };
}

/** Formats an instant as `HH:MM` local time for readable assertions. */
function localTime(instant: Date, timeZone: string): string {
  return Temporal.Instant.from(instant.toISOString())
    .toZonedDateTimeISO(timeZone)
    .toPlainTime()
    .toString({ smallestUnit: 'minute' });
}

describe('placeImportedEntries', () => {
  const tz = 'UTC';

  it('starts an empty day at 08:00 and stacks logs back to back', () => {
    const { dayStart, dayEnd } = dayBoundary('2026-03-04', tz);
    const logs = [log('501', 2), log('502', 1.5), log('503', 0.5)];

    const placed = placeImportedEntries(dayStart, dayEnd, null, logs);

    expect(placed.map((p) => [localTime(p.startedAt, tz), localTime(p.stoppedAt, tz)])).toEqual([
      ['08:00', '10:00'],
      ['10:00', '11:30'],
      ['11:30', '12:00'],
    ]);
  });

  it('continues a second tracker after the first without overlap', () => {
    const { dayStart, dayEnd } = dayBoundary('2026-03-04', tz);
    const existingMaxStop = new Date(
      Temporal.PlainDate.from('2026-03-04')
        .toZonedDateTime(tz)
        .add({ hours: 12 })
        .toInstant()
        .toString(),
    );
    const logs = [log('77', 3), log('78', 1)];

    const placed = placeImportedEntries(dayStart, dayEnd, existingMaxStop, logs);

    expect(placed.map((p) => [localTime(p.startedAt, tz), localTime(p.stoppedAt, tz)])).toEqual([
      ['12:00', '15:00'],
      ['15:00', '16:00'],
    ]);
  });

  it('continues after a real local entry', () => {
    const { dayStart, dayEnd } = dayBoundary('2026-03-04', tz);
    const existingMaxStop = new Date(
      Temporal.PlainDate.from('2026-03-04')
        .toZonedDateTime(tz)
        .add({ hours: 10, minutes: 30 })
        .toInstant()
        .toString(),
    );
    const logs = [log('1', 2)];

    const placed = placeImportedEntries(dayStart, dayEnd, existingMaxStop, logs);

    expect([localTime(placed[0]!.startedAt, tz), localTime(placed[0]!.stoppedAt, tz)]).toEqual([
      '10:30',
      '12:30',
    ]);
  });

  it('spills past midnight on an otherwise empty day, keeping the 08:00 anchor', () => {
    const { dayStart, dayEnd } = dayBoundary('2026-03-04', tz);
    const logs = [log('1', 17)];

    const placed = placeImportedEntries(dayStart, dayEnd, null, logs);

    const anchor = new Date(dayStart.getTime() + 8 * 3600 * 1000);
    expect(placed[0]!.startedAt.getTime()).toBe(anchor.getTime());
    expect(placed[0]!.startedAt.getTime()).toBeLessThan(dayEnd.getTime());
    expect(placed[0]!.stoppedAt.getTime()).toBeGreaterThan(dayEnd.getTime());
  });

  it('drops the anchor to midnight only when a later entry would start on the next day', () => {
    const { dayStart, dayEnd } = dayBoundary('2026-03-04', tz);
    // From the 08:00 anchor, the 19h first log alone would end at 03:00 the
    // next day (fine, single entry) but the second log would then START on
    // the next local day — that is what forces the whole day back to 00:00.
    const logs = [log('1', 19), log('2', 1)];

    const placed = placeImportedEntries(dayStart, dayEnd, null, logs);

    expect(placed[0]!.startedAt.getTime()).toBe(dayStart.getTime());
    expect(placed[1]!.startedAt.getTime()).toBeGreaterThanOrEqual(dayStart.getTime());
    expect(placed[1]!.startedAt.getTime()).toBeLessThan(dayEnd.getTime());
  });

  it('keeps the 08:00 anchor for a single entry regardless of its own duration', () => {
    const { dayStart, dayEnd } = dayBoundary('2026-03-04', tz);
    const logs = [log('1', 20)];

    const placed = placeImportedEntries(dayStart, dayEnd, null, logs);

    const anchor = new Date(dayStart.getTime() + 8 * 3600 * 1000);
    expect(placed[0]!.startedAt.getTime()).toBe(anchor.getTime());
  });

  it('respects a 23-hour DST day for dayEnd', () => {
    // Europe/Warsaw springs forward on 2026-03-29 (23-hour local day).
    const { dayStart, dayEnd } = dayBoundary('2026-03-29', 'Europe/Warsaw');
    expect(dayEnd.getTime() - dayStart.getTime()).toBe(23 * 3600 * 1000);
    const logs = [log('1', 6)];

    const placed = placeImportedEntries(dayStart, dayEnd, null, logs);

    expect(placed[0]!.startedAt.getTime()).toBeGreaterThanOrEqual(dayStart.getTime());
    expect(placed[0]!.stoppedAt.getTime()).toBeLessThanOrEqual(dayEnd.getTime());
  });

  it('orders logs by numeric remote log id ascending regardless of input order', () => {
    const { dayStart, dayEnd } = dayBoundary('2026-03-04', tz);
    const logs = [log('20', 1), log('3', 1), log('100', 1)];

    const placed = placeImportedEntries(dayStart, dayEnd, null, logs);

    expect(placed.map((p) => p.log.remoteLogId)).toEqual(['3', '20', '100']);
  });
});
