import type {
  Content,
  ContentText,
  CustomTableLayout,
  TableCell,
  TableCellProperties,
  TDocumentDefinitions,
} from 'pdfmake/interfaces';
import { deriveIssueUrl } from '@osi/remote-trackers/contracts';
import type { MessageParams } from '~~/shared/types/message-params';
import type { ClientReport, ClientReportDay, ClientReportRow } from './build-client-report';
import type { ClientReportFormatters } from './format';
import appMark from '../../assets/icons/app-mark.svg?raw';

/** Translates a catalog key in the report's locale (REQ-390), independent of the UI locale. */
export type ClientReportTranslate = (key: string, params?: MessageParams) => string;

/** Font families registered by `loadPdfMake` (IBM Plex Sans, design D4). */
export const PDF_FONT = 'PlexSans';
export const PDF_FONT_SEMIBOLD = 'PlexSansSemiBold';

/** A day with more rows than this cannot fit one page, so it is laid out breakable (design D3). */
export const MAX_UNBREAKABLE_DAY_ROWS = 14;

// Palette and sizes follow mockups/*.html (CSS px × 0.75 = pt).
const INK = '#0f172a';
const SLATE_800 = '#1e293b';
const SLATE_700 = '#334155';
const MUTED = '#5b6470';
const ACCENT = '#06b6d4';
const LINK = '#0e7490';
const RULE = '#e2e8f0';
const RULE_STRONG = '#94a3b8';
const RULE_STATS = '#cbd5e1';
const DAY_TOTAL_FILL = '#ecfeff';
const DAY_TOTAL_LABEL = '#155e75';
const MONTH_TOTAL_FILL = '#164e63';
const WHITE = '#ffffff';

const PAGE_SIDE = 42;
const A4_WIDTH = 595.28;
const LINE = 0.75;
const DATE_WIDTH = 90;
const HOURS_WIDTH = 63;
/** Inner padding between cell text and a column edge (mockups: 12px); the outer edges use EDGE_INSET (8px). */
const CELL_GAP = 9;
const EDGE_INSET = 6;
const CONTENT_WIDTH = A4_WIDTH - 2 * PAGE_SIDE;
/**
 * Fixed widths (not `*`): pdfmake sizes a `*` column of a table nested in a
 * `colSpan` cell from its content, which would misalign nested and spread days.
 * Two inner vertical lines sit between the three columns.
 */
const TABLE_WIDTHS = [DATE_WIDTH, CONTENT_WIDTH - DATE_WIDTH - HOURS_WIDTH - 2 * LINE, HOURS_WIDTH];

/** Inner markup of the canonical glyph, with its single `currentColor` swapped for `color`. */
function glyphMarkup(svg: string, color: string): string {
  const body = /<svg[^>]*>([\s\S]*)<\/svg>/.exec(svg)?.[1];
  if (body === undefined) throw new Error('app-mark.svg has no <svg> root');
  return body.replaceAll('currentColor', color);
}

/**
 * Title-page logo: the 75% app tile of `public/icon.svg`, built from the canonical glyph at import
 * time so the PDF never drifts from the app mark (REQ-368, design D3).
 */
const LOGO_SVG = `<svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><rect width="32" height="32" rx="8" fill="${ACCENT}"/><g transform="translate(4 4)" fill="${WHITE}">${glyphMarkup(appMark, WHITE)}</g></svg>`;

/**
 * Cell borders and paddings come from each cell (`border`, `borderColor`,
 * `margin`), so a day renders the same nested (unbreakable) or spread into
 * the outer table (breakable). The line under the repeated header is heavier.
 */
const TABLE_LAYOUT: CustomTableLayout = {
  defaultBorder: false,
  hLineWidth: (index, node) => (node.table.headerRows && index === 1 ? 1.5 : LINE),
  // Outer edges take no width, so a nested day table spans exactly its colSpan cell.
  vLineWidth: (index, node) => (index === 0 || index === node.table.widths?.length ? 0 : LINE),
  paddingLeft: () => 0,
  paddingRight: () => 0,
  paddingTop: () => 0,
  paddingBottom: () => 0,
};

/** Bottom-only border in one colour, as `[left, top, right, bottom]`. */
function bottomBorder(color: string): Pick<TableCellProperties, 'border' | 'borderColor'> {
  return { border: [false, false, false, true], borderColor: [color, color, color, color] };
}

function uppercaseLabel(text: string, color: string, fontSize = 9): ContentText {
  return {
    text: text.toUpperCase(),
    font: PDF_FONT_SEMIBOLD,
    fontSize,
    characterSpacing: fontSize * 0.12,
    color,
  };
}

function contractorName(report: ClientReport): string {
  return report.contractor.displayName?.trim() || report.contractor.email;
}

function hostOf(baseUrl: string): string {
  return URL.canParse(baseUrl) ? new URL(baseUrl).host : baseUrl;
}

function titlePage(report: ClientReport, t: ClientReportTranslate, f: ClientReportFormatters) {
  const showTrackerTotals = report.trackers.length > 1;

  const stat = (value: string, label: string, first: boolean): TableCell => ({
    stack: [
      { text: value, font: PDF_FONT_SEMIBOLD, fontSize: 25.5 },
      { text: label, fontSize: 9.75, color: MUTED, margin: [0, 3, 0, 0] },
    ],
    margin: [first ? 0 : 15, 15, 15, 15],
    border: [!first, true, false, true],
    borderColor: [RULE, INK, RULE, RULE_STATS],
  });

  const dataSources: Content[] = report.trackers.map(({ tracker, totalUnits }) => ({
    table: {
      widths: ['*', 'auto'],
      body: [
        [
          {
            stack: [
              { text: tracker.name, font: PDF_FONT_SEMIBOLD, fontSize: 10.5 },
              { text: hostOf(tracker.baseUrl), link: tracker.baseUrl, fontSize: 9, color: LINK },
            ],
            margin: [0, 4.5, 0, 4.5],
            ...bottomBorder(RULE),
          },
          showTrackerTotals
            ? {
                text: t('clientReport.pdf.hoursWithUnit', { hours: f.hours(totalUnits) }),
                font: PDF_FONT_SEMIBOLD,
                fontSize: 11.25,
                margin: [9, 4.5, 0, 4.5],
                ...bottomBorder(RULE),
              }
            : { text: '', ...bottomBorder(RULE) },
        ],
      ],
    },
    layout: TABLE_LAYOUT,
  }));

  return [
    {
      columns: [
        { svg: LOGO_SVG, width: 22.5 },
        {
          text: t('layout.title'),
          font: PDF_FONT_SEMIBOLD,
          fontSize: 11.25,
          margin: [9, 4, 0, 0],
        },
      ],
    },
    {
      canvas: [{ type: 'rect', x: 0, y: 0, w: CONTENT_WIDTH, h: 1, color: ACCENT }],
      margin: [0, 15, 0, 0],
    },
    {
      stack: [
        uppercaseLabel(t('clientReport.pdf.titleEyebrow'), LINK, 9.75),
        {
          text: report.clientName,
          font: PDF_FONT,
          bold: true,
          fontSize: 40,
          lineHeight: 1.05,
          margin: [0, 10, 0, 0],
        },
        {
          columns: [
            { text: f.month(report.month), fontSize: 22.5, color: SLATE_800, width: 'auto' },
            {
              text: `${f.date(report.range.from)} – ${f.date(report.range.to)}`,
              fontSize: 12,
              color: MUTED,
              margin: [12, 9, 0, 0],
            },
          ],
          margin: [0, 4.5, 0, 0],
        },
      ],
      margin: [0, 150, 0, 0],
    },
    {
      table: {
        widths: ['*', '*', '*'],
        body: [
          [
            stat(f.hours(report.totalUnits), t('clientReport.pdf.totalHours'), true),
            stat(String(report.days.length), t('clientReport.pdf.daysWithLogs'), false),
            stat(String(report.logCount), t('clientReport.pdf.logCount'), false),
          ],
        ],
      },
      layout: TABLE_LAYOUT,
      margin: [0, 42, 0, 0],
    },
    {
      columns: [
        {
          stack: [
            uppercaseLabel(t('clientReport.pdf.contractor'), MUTED),
            {
              text: contractorName(report),
              font: PDF_FONT_SEMIBOLD,
              fontSize: 12.75,
              margin: [0, 4.5, 0, 0],
            },
            { text: report.contractor.email, fontSize: 10.5, color: SLATE_700 },
          ],
        },
        { stack: [uppercaseLabel(t('clientReport.pdf.dataSources'), MUTED), ...dataSources] },
      ],
      columnGap: 30,
      margin: [0, 42, 0, 0],
    },
  ] satisfies Content[];
}

function taskCell(row: ClientReportRow, t: ClientReportTranslate): TableCell {
  const issueUrl = deriveIssueUrl(row.tracker.systemType, row.tracker.baseUrl, row.remoteIssueId);
  return {
    stack: [
      {
        text: [
          `${row.tracker.name} · `,
          {
            text: `#${row.remoteIssueId}`,
            link: issueUrl,
            color: LINK,
            font: PDF_FONT_SEMIBOLD,
          },
        ],
        fontSize: 9,
        color: MUTED,
      },
      row.remoteIssueTitle === null
        ? {
            text: t('clientReport.pdf.issueUnavailable'),
            italics: true,
            color: MUTED,
            fontSize: 10.5,
          }
        : { text: row.remoteIssueTitle, font: PDF_FONT_SEMIBOLD, fontSize: 10.5 },
      {
        text: [
          ...(row.activityName === null ? [] : [{ text: `[${row.activityName}] `, color: MUTED }]),
          row.comment?.trim()
            ? row.comment
            : { text: t('clientReport.pdf.noComment'), italics: true, color: MUTED },
        ],
        fontSize: 9.75,
        color: SLATE_800,
      },
    ],
    margin: [9, 6.75, 9, 6.75],
    ...bottomBorder(RULE),
  };
}

/** Rows of one day for `TABLE_WIDTHS`: log rows with a spanning date cell, then the day total. */
function dayRows(
  day: ClientReportDay,
  t: ClientReportTranslate,
  f: ClientReportFormatters,
): TableCell[][] {
  const logRows = day.rows.map((row, index): TableCell[] => [
    index === 0
      ? {
          rowSpan: day.rows.length,
          stack: [
            { text: f.weekday(day.date), fontSize: 9, color: MUTED },
            { text: f.date(day.date), font: PDF_FONT_SEMIBOLD, fontSize: 10.5 },
          ],
          margin: [EDGE_INSET, 7.5, CELL_GAP, 7.5],
          border: [false, false, true, false],
          borderColor: [RULE, RULE, RULE, RULE],
        }
      : {},
    taskCell(row, t),
    {
      text: f.hours(row.units),
      alignment: 'right',
      fontSize: 10.5,
      margin: [CELL_GAP, 6.75, EDGE_INSET, 6.75],
      ...bottomBorder(RULE),
    },
  ]);

  const totalRow: TableCell[] = [
    {
      colSpan: 2,
      ...uppercaseLabel(t('clientReport.pdf.dayTotal'), DAY_TOTAL_LABEL),
      alignment: 'right',
      fillColor: DAY_TOTAL_FILL,
      margin: [9, 5.25, 9, 5.25],
      ...bottomBorder(RULE_STRONG),
    },
    {},
    {
      text: f.hours(day.totalUnits),
      alignment: 'right',
      bold: true,
      fontSize: 10.5,
      color: MONTH_TOTAL_FILL,
      fillColor: DAY_TOTAL_FILL,
      margin: [CELL_GAP, 5.25, EDGE_INSET, 5.25],
      ...bottomBorder(RULE_STRONG),
    },
  ];

  return [...logRows, totalRow];
}

/**
 * Outer table rows of one day (design D3): a day that fits a page is one
 * row holding a nested table, which `dontBreakRows` keeps on one page; a
 * longer day is spread into plain rows so the table may break inside it.
 */
function dayBlock(
  day: ClientReportDay,
  t: ClientReportTranslate,
  f: ClientReportFormatters,
): TableCell[][] {
  const rows = dayRows(day, t, f);
  if (day.rows.length > MAX_UNBREAKABLE_DAY_ROWS) return rows;
  return [
    [{ colSpan: 3, table: { widths: TABLE_WIDTHS, body: rows }, layout: TABLE_LAYOUT }, {}, {}],
  ];
}

function timesheet(report: ClientReport, t: ClientReportTranslate, f: ClientReportFormatters) {
  // Header text lines up with the cell text below it.
  const header = (
    text: string,
    [left, right]: [number, number],
    alignment: 'left' | 'right' = 'left',
  ): TableCell => ({
    ...uppercaseLabel(text, SLATE_700),
    alignment,
    margin: [left, 0, right, 6],
    ...bottomBorder(INK),
  });

  // One filled cell, so no seam shows between the label and the value.
  const monthTotal = {
    table: {
      widths: ['*'],
      body: [
        [
          {
            columns: [
              {
                ...uppercaseLabel(
                  t('clientReport.pdf.monthTotal', { month: f.month(report.month) }),
                  WHITE,
                  9.75,
                ),
                margin: [0, 4, 0, 0],
              },
              {
                text: t('clientReport.pdf.hoursWithUnit', { hours: f.hours(report.totalUnits) }),
                width: 'auto',
                bold: true,
                fontSize: 16.5,
                color: WHITE,
              },
            ],
            fillColor: MONTH_TOTAL_FILL,
            margin: [12, 8, 12, 8],
          },
        ],
      ],
    },
    layout: TABLE_LAYOUT,
  } satisfies Content;

  return [
    {
      table: {
        headerRows: 1,
        dontBreakRows: true,
        widths: TABLE_WIDTHS,
        body: [
          [
            header(t('clientReport.pdf.columnDate'), [EDGE_INSET, CELL_GAP]),
            header(t('clientReport.pdf.columnTask'), [CELL_GAP, CELL_GAP]),
            header(t('clientReport.pdf.columnHours'), [CELL_GAP, EDGE_INSET], 'right'),
          ],
          ...report.days.flatMap((day) => dayBlock(day, t, f)),
        ],
      },
      layout: TABLE_LAYOUT,
      pageBreak: 'before',
    },
    {
      stack: [
        monthTotal,
        {
          text: t('clientReport.pdf.closingNote', {
            contractor: contractorName(report),
            trackers: f.list(report.trackers.map(({ tracker }) => tracker.name)),
          }),
          fontSize: 9,
          color: MUTED,
          margin: [0, 7.5, 0, 0],
        },
      ],
      unbreakable: true,
      margin: [0, 13.5, 0, 0],
    },
  ] satisfies Content[];
}

/**
 * Lays out the client report as a pdfmake document (design D2): a title page
 * (REQ-388), then the timesheet table with running header and footer on every
 * table page (REQ-389, REQ-474). All strings come from `t` in the report locale.
 */
export function buildClientReportPdf(
  report: ClientReport,
  t: ClientReportTranslate,
  f: ClientReportFormatters,
): TDocumentDefinitions {
  const generatedAt = f.dateTime(report.generatedAt);
  const appName = t('layout.title');
  const footerRow = (left: string, right: string): Content => ({
    table: {
      widths: ['*', 'auto'],
      body: [
        [
          {
            text: left,
            margin: [0, 10, 0, 0],
            border: [false, true, false, false],
            borderColor: [RULE, RULE, RULE, RULE],
          },
          {
            text: right,
            margin: [9, 10, 0, 0],
            border: [false, true, false, false],
            borderColor: [RULE, RULE, RULE, RULE],
          },
        ],
      ],
    },
    layout: TABLE_LAYOUT,
    fontSize: 9,
    color: MUTED,
    margin: [PAGE_SIDE, 12, PAGE_SIDE, 0],
  });

  return {
    pageSize: 'A4',
    pageOrientation: 'portrait',
    pageMargins: [PAGE_SIDE, 72, PAGE_SIDE, 60],
    info: {
      title: t('clientReport.pdf.documentTitle', {
        client: report.clientName,
        month: f.month(report.month),
      }),
      author: contractorName(report),
      creator: appName,
    },
    defaultStyle: { font: PDF_FONT, fontSize: 10.5, color: INK, fontFeatures: ['tnum'] },
    header: (currentPage) =>
      currentPage === 1
        ? null
        : {
            table: {
              widths: ['*', 'auto'],
              body: [
                [
                  {
                    text: [
                      {
                        text: t('clientReport.pdf.runningTitle'),
                        font: PDF_FONT_SEMIBOLD,
                        color: INK,
                      },
                      ` · ${f.month(report.month)}`,
                    ],
                    margin: [0, 0, 0, 7.5],
                    ...bottomBorder(RULE),
                  },
                  {
                    text: report.clientName,
                    alignment: 'right',
                    margin: [9, 0, 0, 7.5],
                    ...bottomBorder(RULE),
                  },
                ],
              ],
            },
            layout: TABLE_LAYOUT,
            fontSize: 9,
            color: MUTED,
            margin: [PAGE_SIDE, 36, PAGE_SIDE, 0],
          },
    footer: (currentPage, pageCount) =>
      currentPage === 1
        ? footerRow(
            t('clientReport.pdf.generatedAt', { dateTime: generatedAt, timeZone: report.timeZone }),
            appName,
          )
        : footerRow(
            t('clientReport.pdf.footer', {
              contractor: contractorName(report),
              dateTime: generatedAt,
              timeZone: report.timeZone,
            }),
            t('clientReport.pdf.pageOf', { page: currentPage, pages: pageCount }),
          ),
    content: [...titlePage(report, t, f), ...timesheet(report, t, f)],
  };
}
