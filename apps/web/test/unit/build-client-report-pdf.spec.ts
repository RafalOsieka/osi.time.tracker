import { describe, expect, it } from 'vitest';
import type { Content, ContentTable, TDocumentDefinitions } from 'pdfmake/interfaces';
import type { RemoteTimeLogDto } from '@osi/remote-trackers/contracts';
import en from '../../i18n/locales/en.json';
import pl from '../../i18n/locales/pl.json';
import {
  buildClientReport,
  type BuildClientReportInput,
  type ClientReportTracker,
} from '../../app/utils/client-report/build-client-report';
import {
  buildClientReportPdf,
  MAX_UNBREAKABLE_DAY_ROWS,
  type ClientReportTranslate,
} from '../../app/utils/client-report/build-client-report-pdf';
import { createClientReportFormatters } from '../../app/utils/client-report/format';
import appMark from '../../app/assets/icons/app-mark.svg?raw';
import type { ReportLocale } from '../../shared/types/report-preset';

const openProject: ClientReportTracker = {
  id: 'op',
  name: 'Helios OpenProject',
  systemType: 'openproject',
  baseUrl: 'https://op.example',
};
const redmine: ClientReportTracker = {
  id: 'rm',
  name: 'Helios Redmine',
  systemType: 'redmine',
  baseUrl: 'https://rm.example',
};

type CatalogNode = string | { readonly [key: string]: CatalogNode };

function flatten(node: { readonly [key: string]: CatalogNode }, prefix = ''): [string, string][] {
  return Object.entries(node).flatMap(([key, value]): [string, string][] =>
    value instanceof Object ? flatten(value, `${prefix}${key}.`) : [[`${prefix}${key}`, value]],
  );
}

const catalogs = { en: new Map(flatten(en)), pl: new Map(flatten(pl)) };

/**
 * Catalog lookup with vue-i18n named interpolation, bound to one locale like
 * the page's translator (design D5); every PDF string uses only `{name}` params.
 */
function translator(locale: ReportLocale): ClientReportTranslate {
  return (key, params = {}) => {
    const message = catalogs[locale].get(key);
    if (message === undefined) throw new Error(`missing ${locale} message ${key}`);
    return message.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name]));
  };
}

let logSeq = 0;
function log(overrides: Partial<RemoteTimeLogDto> = {}): RemoteTimeLogDto {
  logSeq += 1;
  return {
    remoteLogId: String(logSeq),
    remoteIssueId: '4821',
    spentOn: '2026-09-01',
    durationSeconds: 12_600,
    activityId: '1',
    activityName: 'Development',
    comment: 'Poprawki błędów',
    remoteUserId: null,
    remoteIssueTitle: 'Portal klienta: lista faktur',
    ...overrides,
  };
}

function pdf(
  logsByTracker: Record<string, RemoteTimeLogDto[]>,
  overrides: Partial<BuildClientReportInput> = {},
  locale: ReportLocale = 'pl',
): TDocumentDefinitions {
  const report = buildClientReport({
    preset: { clientName: 'Helios Energy', hoursFormat: 'decimal' },
    trackers: [openProject, redmine],
    logsByTracker,
    month: '2026-09',
    user: { displayName: 'John Doe', email: 'john.doe@example.com' },
    generatedAt: new Date('2026-10-01T12:32:00Z'),
    timeZone: 'Europe/Warsaw',
    ...overrides,
  });
  return buildClientReportPdf(
    report,
    translator(locale),
    createClientReportFormatters(locale, 'decimal', 'Europe/Warsaw'),
  );
}

/** Every string the content prints, flattened (header/footer callbacks are not serialised). */
function contentText(doc: TDocumentDefinitions): string {
  return JSON.stringify(doc.content);
}

function links(doc: TDocumentDefinitions): string[] {
  return [...contentText(doc).matchAll(/"link":"([^"]+)"/g)].map((match) => match[1]!);
}

function isTable(node: Content): node is ContentTable {
  return node instanceof Object && 'table' in node;
}

/** Body rows (without the repeated header) of the timesheet table. */
function timesheetRows(doc: TDocumentDefinitions) {
  const contents: Content[] = Array.isArray(doc.content) ? doc.content : [doc.content];
  const timesheet = contents.find(
    (node): node is ContentTable => isTable(node) && node.table.headerRows === 1,
  );
  if (!timesheet) throw new Error('timesheet table not found');
  expect(timesheet.table.dontBreakRows).toBe(true);
  return timesheet.table.body.slice(1);
}

function headerOrFooter(
  part: TDocumentDefinitions['header'],
  currentPage: number,
  pageCount: number,
): string {
  if (!(part instanceof Function)) throw new Error('expected a callback');
  return JSON.stringify(
    part(currentPage, pageCount, { width: 595, height: 842, orientation: 'portrait' }) ?? null,
  );
}

describe('buildClientReportPdf title page', () => {
  it('lists per-tracker totals only when the preset has two or more trackers', () => {
    const two = contentText(
      pdf({
        op: [log({ durationSeconds: 98.25 * 3600 })],
        rm: [log({ durationSeconds: 44.25 * 3600, remoteIssueId: '112' })],
      }),
    );
    expect(two).toContain('ZESTAWIENIE GODZIN DLA');
    expect(two).toContain('wrzesień 2026');
    expect(two).toContain('01.09.2026 – 30.09.2026');
    expect(two).toContain('"98,25 h"');
    expect(two).toContain('"44,25 h"');
    expect(two).toContain('"142,50"');
    expect(two).toContain('op.example');
    expect(two).toContain('rm.example');

    const one = contentText(
      pdf({ op: [log({ durationSeconds: 98.25 * 3600 })] }, { trackers: [openProject] }),
    );
    expect(one).toContain('Helios OpenProject');
    // Values with the unit: each data source total (2+ trackers only) and the month total.
    expect(one.match(/ h"/g)).toHaveLength(1);
    expect(two.match(/ h"/g)).toHaveLength(3);
  });

  // REQ-368: the PDF mark is derived from the canonical glyph, never a pasted copy that drifts.
  it('draws the title-page logo from the canonical app mark', () => {
    const logo = contentText(pdf({ op: [log()] })).match(/"svg":"((?:[^"\\]|\\.)*)"/)?.[1];
    expect(logo).toBeDefined();
    const glyphPaths = [...appMark.matchAll(/\sd="([^"]+)"/g)].map((match) => match[1]!);
    expect(glyphPaths.length).toBeGreaterThan(0);
    for (const d of glyphPaths) expect(logo).toContain(d);
    expect(logo).not.toContain('currentColor');
  });

  it('falls back to the email when the display name is missing', () => {
    const doc = pdf(
      { op: [log()] },
      { user: { displayName: null, email: 'john.doe@example.com' } },
    );
    expect(contentText(doc)).not.toContain('John Doe');
    expect(doc.info?.author).toBe('john.doe@example.com');
    expect(headerOrFooter(doc.footer, 2, 3)).toContain('john.doe@example.com · wygenerowano');
  });

  it('prints the generation time with the time zone in the first-page footer only', () => {
    const doc = pdf({ op: [log()] });
    expect(headerOrFooter(doc.footer, 1, 3)).toContain(
      'Wygenerowano 01.10.2026, 14:32 (Europe/Warsaw)',
    );
    expect(headerOrFooter(doc.footer, 1, 3)).not.toContain('Strona');
  });
});

describe('buildClientReportPdf table pages', () => {
  it('links data sources to the trackers and issue ids to the tracker issue URL', () => {
    const doc = pdf({
      op: [log({ remoteIssueId: '4821' })],
      rm: [log({ remoteIssueId: '112' })],
    });
    expect(links(doc)).toEqual([
      'https://op.example',
      'https://rm.example',
      'https://op.example/work_packages/4821',
      'https://rm.example/issues/112',
    ]);
  });

  it('prints fallbacks for a hidden issue, a missing activity, and a missing comment', () => {
    const doc = pdf({
      op: [
        log({ remoteIssueId: '1', remoteIssueTitle: null, comment: 'Hidden work' }),
        log({ remoteIssueId: '2', activityName: null, comment: 'No activity' }),
        log({ remoteIssueId: '3', comment: '' }),
      ],
    });
    const text = contentText(doc);

    expect(text).toContain('Zadanie niedostępne');
    expect(links(doc)).toContain('https://op.example/work_packages/1');
    expect(text).not.toContain('[null]');
    expect(text).toContain('"[Development] "');
    expect(text).toContain('(brak komentarza)');
  });

  it('keeps a page-sized day in one unbreakable row and spreads a longer day', () => {
    const shortDay = Array.from({ length: MAX_UNBREAKABLE_DAY_ROWS }, () =>
      log({ spentOn: '2026-09-01' }),
    );
    const longDay = Array.from({ length: MAX_UNBREAKABLE_DAY_ROWS + 1 }, () =>
      log({ spentOn: '2026-09-02' }),
    );
    const rows = timesheetRows(pdf({ op: [...shortDay, ...longDay] }));

    // One wrapper row for the short day, then every log row plus its total for the long day.
    expect(rows).toHaveLength(1 + MAX_UNBREAKABLE_DAY_ROWS + 2);
    const [wrapper] = rows;
    // toMatchObject matches arrays by length: every log row plus the day total.
    expect(wrapper![0]).toMatchObject({
      colSpan: 3,
      table: {
        body: Array.from({ length: MAX_UNBREAKABLE_DAY_ROWS + 1 }, () => expect.anything()),
      },
    });
    expect(rows[1]![0]).toMatchObject({ rowSpan: MAX_UNBREAKABLE_DAY_ROWS + 1 });
  });

  it('ends days with a day total and the table with the month total', () => {
    const text = contentText(
      pdf({
        op: [
          log({ durationSeconds: 1200 }),
          log({ durationSeconds: 1200 }),
          log({ durationSeconds: 1200 }),
        ],
      }),
    );
    expect(text).toContain('"text":"SUMA"');
    expect(text).toContain('"0,99"');
    expect(text).toContain('SUMA · WRZESIEŃ 2026');
    expect(text).toContain('"0,99 h"');
  });

  it('skips the running header and page numbers on the title page', () => {
    const doc = pdf({ op: [log()] });

    expect(headerOrFooter(doc.header, 1, 3)).toBe('null');
    expect(headerOrFooter(doc.header, 2, 3)).toContain('Zestawienie godzin');
    expect(headerOrFooter(doc.header, 2, 3)).toContain('Helios Energy');
    expect(headerOrFooter(doc.footer, 2, 3)).toContain('Strona 2 z 3');
  });
});

describe('buildClientReportPdf language', () => {
  it('renders every string in the preset locale', () => {
    const text = contentText(pdf({ op: [log()] }, {}, 'pl'));

    expect(text).toContain('WYKONAWCA');
    expect(text).toContain('wtorek');
    expect(text).not.toContain('CONTRACTOR');
    expect(text).not.toContain('Tuesday');
  });

  it('renders an English PDF', () => {
    const doc = pdf({ op: [log()] }, {}, 'en');
    expect(contentText(doc)).toContain('TIMESHEET FOR');
    expect(contentText(doc)).toContain('Tuesday');
    expect(headerOrFooter(doc.footer, 2, 3)).toContain('Page 2 of 3');
  });
});
