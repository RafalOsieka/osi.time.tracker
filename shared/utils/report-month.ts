import { Temporal } from 'temporal-polyfill';

export function currentCalendarMonth(now: Date, timeZone: string): string {
  const plain = Temporal.Instant.from(now.toISOString()).toZonedDateTimeISO(timeZone).toPlainDate();
  return `${String(plain.year).padStart(4, '0')}-${String(plain.month).padStart(2, '0')}`;
}

export function addCalendarMonths(month: string, delta: number): string {
  const shifted = Temporal.PlainYearMonth.from(month).add({ months: delta });
  return `${String(shifted.year).padStart(4, '0')}-${String(shifted.month).padStart(2, '0')}`;
}

export interface MonthBounds {
  from: string;
  to: string;
}

/** Inclusive local calendar days of a `YYYY-MM` month. */
export function monthDateRange(month: string): MonthBounds {
  const yearMonth = Temporal.PlainYearMonth.from(month);
  const start = yearMonth.toPlainDate({ day: 1 }).toString();
  const end = yearMonth.add({ months: 1 }).toPlainDate({ day: 1 }).subtract({ days: 1 }).toString();
  return { from: start, to: end };
}

/** Inclusive start / exclusive end instants of a `YYYY-MM` month in `timeZone`. */
export function monthInstantRange(month: string, timeZone: string): MonthBounds {
  const yearMonth = Temporal.PlainYearMonth.from(month);
  const start = yearMonth.toPlainDate({ day: 1 }).toZonedDateTime(timeZone);
  return {
    from: start.toInstant().toString(),
    to: start.add({ months: 1 }).toInstant().toString(),
  };
}
