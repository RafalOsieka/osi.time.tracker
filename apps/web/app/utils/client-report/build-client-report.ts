import type { RemoteTimeLogDto } from '@osi/remote-trackers/contracts';
import type { TrackerDto } from '~~/shared/types/tracker';
import type { ReportHoursFormat, ReportPresetInput } from '~~/shared/types/report-preset';
import { monthDateRange, type MonthBounds } from '~~/shared/utils/report-month';

export type ClientReportTracker = Pick<TrackerDto, 'id' | 'name' | 'systemType' | 'baseUrl'>;

export interface ClientReportRow {
  tracker: ClientReportTracker;
  remoteLogId: string;
  remoteIssueId: string;
  remoteIssueTitle: string | null;
  activityName: string | null;
  comment: string | null;
  /** Duration in display units (see `toDisplayUnits`). */
  units: number;
}

export interface ClientReportDay {
  /** `YYYY-MM-DD` */
  date: string;
  rows: ClientReportRow[];
  totalUnits: number;
}

/** Everything the PDF prints, with every total already summed from row values (REQ-387). */
export interface ClientReport {
  clientName: string;
  hoursFormat: ReportHoursFormat;
  /** `YYYY-MM` */
  month: string;
  range: MonthBounds;
  contractor: { displayName: string | null; email: string };
  /** Preset trackers in preset order with their month totals. */
  trackers: { tracker: ClientReportTracker; totalUnits: number }[];
  days: ClientReportDay[];
  totalUnits: number;
  logCount: number;
  generatedAt: Date;
  timeZone: string;
}

export interface BuildClientReportInput {
  preset: Pick<ReportPresetInput, 'clientName' | 'hoursFormat'>;
  /** Preset trackers in preset order. */
  trackers: ClientReportTracker[];
  logsByTracker: Record<string, RemoteTimeLogDto[]>;
  month: string;
  user: { displayName: string | null; email: string };
  generatedAt: Date;
  timeZone: string;
}

/**
 * Integer display units of a duration: whole minutes (seconds floored) for
 * `hm`, hundredths of an hour (rounded half-up) for `decimal`. Totals sum
 * these units, so printed totals always add up from printed rows.
 */
export function toDisplayUnits(durationSeconds: number, hoursFormat: ReportHoursFormat): number {
  return hoursFormat === 'hm'
    ? Math.floor(durationSeconds / 60)
    : Math.floor((durationSeconds * 2 + 36) / 72);
}

const NUMERIC_ID = /^\d+$/;

/** Numeric order when both ids are numeric, otherwise lexical. */
function compareIds(a: string, b: string): number {
  if (NUMERIC_ID.test(a) && NUMERIC_ID.test(b)) {
    const diff = BigInt(a) - BigInt(b);
    return diff === 0n ? 0 : diff < 0n ? -1 : 1;
  }
  return a === b ? 0 : a < b ? -1 : 1;
}

function sumUnits(items: { units: number }[]): number {
  return items.reduce((sum, item) => sum + item.units, 0);
}

/**
 * Builds the client report model from fetched remote logs (design D2):
 * days with logs in ascending order, rows ordered by tracker (preset order),
 * remote issue id, then remote log id (REQ-387).
 */
export function buildClientReport(input: BuildClientReportInput): ClientReport {
  const { hoursFormat } = input.preset;
  const rows = input.trackers.flatMap((tracker, trackerIndex) =>
    (input.logsByTracker[tracker.id] ?? []).map((log) => ({
      tracker,
      remoteLogId: log.remoteLogId,
      remoteIssueId: log.remoteIssueId,
      remoteIssueTitle: log.remoteIssueTitle,
      activityName: log.activityName,
      comment: log.comment,
      units: toDisplayUnits(log.durationSeconds, hoursFormat),
      spentOn: log.spentOn,
      trackerIndex,
    })),
  );

  const byDay = new Map<string, (ClientReportRow & { trackerIndex: number })[]>();
  for (const { spentOn, ...row } of rows) {
    const dayRows = byDay.get(spentOn) ?? [];
    dayRows.push(row);
    byDay.set(spentOn, dayRows);
  }

  const days = [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([date, dayRows]) => {
      const sorted = dayRows
        .sort(
          (a, b) =>
            a.trackerIndex - b.trackerIndex ||
            compareIds(a.remoteIssueId, b.remoteIssueId) ||
            compareIds(a.remoteLogId, b.remoteLogId),
        )
        .map(({ trackerIndex: _trackerIndex, ...row }): ClientReportRow => row);
      return { date, rows: sorted, totalUnits: sumUnits(sorted) };
    });

  const allRows = days.flatMap((day) => day.rows);

  return {
    clientName: input.preset.clientName,
    hoursFormat,
    month: input.month,
    range: monthDateRange(input.month),
    contractor: input.user,
    trackers: input.trackers.map((tracker) => ({
      tracker,
      totalUnits: sumUnits(allRows.filter((row) => row.tracker.id === tracker.id)),
    })),
    days,
    totalUnits: sumUnits(allRows),
    logCount: allRows.length,
    generatedAt: input.generatedAt,
    timeZone: input.timeZone,
  };
}
