import { describe, expect, it } from 'vitest';
import {
  clientReportFileName,
  clientSlug,
  createClientReportFormatters,
  formatReportHours,
} from '../../app/utils/client-report/format';

describe('formatReportHours', () => {
  it('uses the locale decimal separator for decimal hours', () => {
    expect(formatReportHours(350, 'decimal', 'pl')).toBe('3,50');
    expect(formatReportHours(350, 'decimal', 'en')).toBe('3.50');
    expect(formatReportHours(14250, 'decimal', 'pl')).toBe('142,50');
    expect(formatReportHours(5, 'decimal', 'en')).toBe('0.05');
  });

  it('prints unpadded H:MM', () => {
    expect(formatReportHours(470, 'hm', 'pl')).toBe('7:50');
    expect(formatReportHours(5, 'hm', 'en')).toBe('0:05');
    expect(formatReportHours(8550, 'hm', 'en')).toBe('142:30');
  });
});

describe('createClientReportFormatters', () => {
  it('formats Polish dates, weekdays, months, and lists', () => {
    const format = createClientReportFormatters('pl', 'decimal', 'Europe/Warsaw');

    expect(format.date('2026-09-01')).toBe('01.09.2026');
    expect(format.weekday('2026-09-01')).toBe('wtorek');
    expect(format.month('2026-09')).toBe('wrzesień 2026');
    expect(format.dateTime(new Date('2026-10-01T12:32:00Z'))).toBe('01.10.2026, 14:32');
    expect(format.list(['A', 'B'])).toBe('A i B');
    expect(format.hours(350)).toBe('3,50');
  });

  it('formats English dates, weekdays, and months', () => {
    const format = createClientReportFormatters('en', 'hm', 'UTC');

    expect(format.date('2026-09-01')).toBe('09/01/2026');
    expect(format.weekday('2026-09-01')).toBe('Tuesday');
    expect(format.month('2026-09')).toBe('September 2026');
    expect(format.list(['A', 'B'])).toBe('A and B');
    expect(format.hours(470)).toBe('7:50');
  });

  it('keeps calendar dates stable in time zones west of UTC', () => {
    const format = createClientReportFormatters('en', 'hm', 'America/Los_Angeles');
    expect(format.date('2026-09-01')).toBe('09/01/2026');
  });
});

describe('client report file name', () => {
  it('slugs the client name', () => {
    expect(clientSlug('Helios Energy')).toBe('helios-energy');
    expect(clientSlug('  ACME / Sp. z o.o. ')).toBe('acme-sp-z-o-o');
    expect(clientSlug('Łódź Dev')).toBe('łódź-dev');
  });

  it('joins prefix, slug, and month', () => {
    expect(clientReportFileName('zestawienie-godzin', 'Helios Energy', '2026-09')).toBe(
      'zestawienie-godzin-helios-energy-2026-09.pdf',
    );
  });
});
