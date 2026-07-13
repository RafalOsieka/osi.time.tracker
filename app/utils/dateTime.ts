import { Temporal } from 'temporal-polyfill';

export interface DateTimeSettings {
  timeZone: string;
  weekStart: 'monday' | 'sunday';
}

export const browserDateTimeSettings = (): DateTimeSettings => ({
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  weekStart: 'monday',
});

export function instantToZoned(iso: string, timeZone: string): Temporal.ZonedDateTime {
  return Temporal.Instant.from(iso).toZonedDateTimeISO(timeZone);
}

export function wallClockToInstant(date: string, time: string, timeZone: string): string {
  const [hour, minute] = time.split(':').map(Number);
  return Temporal.PlainDate.from(date)
    .toPlainDateTime({ hour, minute })
    .toZonedDateTime(timeZone, { disambiguation: 'compatible' })
    .toInstant()
    .toString();
}

export function localDateToPickerDate(date: string, timeZone: string): Date {
  const zoned = Temporal.PlainDate.from(date).toPlainDateTime().toZonedDateTime(timeZone);
  return new Date(zoned.year, zoned.month - 1, zoned.day, zoned.hour, zoned.minute);
}

export function pickerDateToLocalDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export const toPickerDate = localDateToPickerDate;
export const fromPickerDate = pickerDateToLocalDate;
