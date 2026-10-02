import type { ReportHoursFormat, ReportLocale } from '~~/shared/types/report-preset';

const INTL_LOCALES = { en: 'en-US', pl: 'pl-PL' } as const satisfies Record<ReportLocale, string>;
const DECIMAL_SEPARATORS = { en: '.', pl: ',' } as const satisfies Record<ReportLocale, string>;

/** Locale-bound formatters for every value the client report PDF prints (REQ-387, REQ-390). */
export interface ClientReportFormatters {
  /** Display units from `toDisplayUnits` → `7:50` (`hm`) or `3,50` / `3.50` (`decimal`). */
  hours(units: number): string;
  /** `YYYY-MM-DD` → `01.09.2026` / `09/01/2026` */
  date(date: string): string;
  /** `YYYY-MM-DD` → `wtorek` / `Tuesday` */
  weekday(date: string): string;
  /** `YYYY-MM` → `wrzesień 2026` / `September 2026` */
  month(month: string): string;
  /** An instant in the report's time zone → `01.10.2026, 14:32` */
  dateTime(instant: Date): string;
  /** `['A', 'B']` → `A i B` / `A and B` */
  list(items: string[]): string;
}

/** Formats display units of the given hours format with the locale's decimal separator. */
export function formatReportHours(
  units: number,
  hoursFormat: ReportHoursFormat,
  locale: ReportLocale,
): string {
  if (hoursFormat === 'hm') {
    return `${Math.floor(units / 60)}:${String(units % 60).padStart(2, '0')}`;
  }
  return `${Math.floor(units / 100)}${DECIMAL_SEPARATORS[locale]}${String(units % 100).padStart(2, '0')}`;
}

/** A calendar day as a UTC midnight, so formatting never shifts it to a neighbouring day. */
function calendarDate(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

export function createClientReportFormatters(
  locale: ReportLocale,
  hoursFormat: ReportHoursFormat,
  timeZone: string,
): ClientReportFormatters {
  const intlLocale = INTL_LOCALES[locale];
  const dateFormat = new Intl.DateTimeFormat(intlLocale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const weekdayFormat = new Intl.DateTimeFormat(intlLocale, { weekday: 'long', timeZone: 'UTC' });
  const monthFormat = new Intl.DateTimeFormat(intlLocale, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const dateTimeFormat = new Intl.DateTimeFormat(intlLocale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  });
  const listFormat = new Intl.ListFormat(intlLocale, { type: 'conjunction' });

  return {
    hours: (units) => formatReportHours(units, hoursFormat, locale),
    date: (date) => dateFormat.format(calendarDate(date)),
    weekday: (date) => weekdayFormat.format(calendarDate(date)),
    month: (month) => monthFormat.format(calendarDate(`${month}-01`)),
    dateTime: (instant) => dateTimeFormat.format(instant),
    list: (items) => listFormat.format(items),
  };
}

/** Client name lowercased with runs of non-alphanumeric characters replaced by `-` (REQ-390). */
export function clientSlug(clientName: string): string {
  return clientName
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}

/** `<prefix>-<client slug>-<YYYY-MM>.pdf` */
export function clientReportFileName(prefix: string, clientName: string, month: string): string {
  return `${prefix}-${clientSlug(clientName)}-${month}.pdf`;
}
