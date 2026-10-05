import type { RemoteTimeLogDto } from '@osi/remote-trackers/contracts';
import type { MonthlyReportDto } from '~~/shared/types/report';
import {
  attentionReasons,
  type AttentionReason,
  type AttentionTrackerHours,
} from '~~/shared/utils/monthly-report-attention';
import {
  knownRemoteLogIdsForTracker,
  splitAppAndDirect,
  type TrackerDayHours,
} from '~~/shared/utils/monthly-report-split';

/** Client-side result of fetching one tracker's logs for the report month. */
export interface TrackerRemoteState {
  status: 'loading' | 'ok' | 'error';
  logs: RemoteTimeLogDto[];
  errorKey: string | null;
}

export type RemoteStateByTracker = Record<string, TrackerRemoteState>;

export interface TrackerCell extends TrackerDayHours {
  failed: boolean;
}

export interface TimesheetRow {
  /** Calendar day (`YYYY-MM-DD`), or `'total'` for the totals row. */
  date: string;
  isTotal: boolean;
  localSeconds: number;
  trackerCells: Record<string, TrackerCell>;
  warnUnexported: boolean;
}

export type TimesheetCellKind = 'app' | 'direct' | 'total';

export type RemoteHoursSummary =
  | { kind: 'pending' }
  | { kind: 'ok'; seconds: number }
  | { kind: 'partial'; seconds: number }
  | { kind: 'failed' };

const NO_HOURS: TrackerDayHours = { appSeconds: 0, directSeconds: 0 };

/**
 * Builds the monthly timesheet: one row per day that has local or remote time,
 * sorted by date, followed by a totals row. Returns no rows for an empty month.
 * Day-level `warnUnexported` is only computed once every tracker fetch settled.
 */
export function buildTimesheetRows(
  report: MonthlyReportDto,
  remoteByTracker: RemoteStateByTracker,
  remotesReady: boolean,
): TimesheetRow[] {
  const hoursByTracker = new Map<string, Map<string, TrackerDayHours>>();
  const dates = new Set(report.days.map((day) => day.date));
  for (const tracker of report.trackers) {
    const remote = remoteByTracker[tracker.id];
    if (remote?.status !== 'ok') continue;
    const split = splitAppAndDirect(
      remote.logs,
      knownRemoteLogIdsForTracker(report.exports, tracker.id),
    );
    hoursByTracker.set(tracker.id, split);
    for (const date of split.keys()) dates.add(date);
  }

  const localByDate = new Map(report.days.map((day) => [day.date, day.localSeconds]));
  const sorted = [...dates].sort((left, right) => left.localeCompare(right));
  const dayRows = sorted.map((date): TimesheetRow => {
    const trackerCells: Record<string, TrackerCell> = {};
    const attentionTrackers: AttentionTrackerHours[] = [];
    for (const tracker of report.trackers) {
      const failed = remoteByTracker[tracker.id]?.status === 'error';
      const hours = hoursByTracker.get(tracker.id)?.get(date) ?? NO_HOURS;
      trackerCells[tracker.id] = { ...hours, failed };
      attentionTrackers.push({ ...hours, fetchFailed: failed });
    }
    const localSeconds = localByDate.get(date) ?? 0;
    const reasons = remotesReady
      ? attentionReasons({ localSeconds, trackers: attentionTrackers })
      : [];
    return {
      date,
      isTotal: false,
      localSeconds,
      trackerCells,
      warnUnexported: reasons.includes('unexported'),
    };
  });
  if (dayRows.length === 0) return [];

  const totals: TimesheetRow = {
    date: 'total',
    isTotal: true,
    localSeconds: dayRows.reduce((sum, row) => sum + row.localSeconds, 0),
    trackerCells: {},
    warnUnexported: false,
  };
  for (const tracker of report.trackers) {
    totals.trackerCells[tracker.id] = {
      appSeconds: dayRows.reduce(
        (sum, row) => sum + (row.trackerCells[tracker.id]?.appSeconds ?? 0),
        0,
      ),
      directSeconds: dayRows.reduce(
        (sum, row) => sum + (row.trackerCells[tracker.id]?.directSeconds ?? 0),
        0,
      ),
      failed: remoteByTracker[tracker.id]?.status === 'error',
    };
  }
  return [...dayRows, totals];
}

/**
 * Month-level remote hours for the summary badge: `pending` until fetches
 * settle, `failed` when no tracker loaded, `partial` when only some did.
 */
export function summarizeRemoteHours(
  report: MonthlyReportDto,
  remoteByTracker: RemoteStateByTracker,
  remotesReady: boolean,
): RemoteHoursSummary {
  if (!remotesReady) return { kind: 'pending' };
  let seconds = 0;
  let okCount = 0;
  let failedCount = 0;
  for (const tracker of report.trackers) {
    const remote = remoteByTracker[tracker.id];
    if (remote?.status === 'ok') {
      okCount += 1;
      for (const log of remote.logs) seconds += log.durationSeconds;
    } else if (remote?.status === 'error') {
      failedCount += 1;
    }
  }
  if (okCount === 0 && failedCount > 0) return { kind: 'failed' };
  if (failedCount > 0) return { kind: 'partial', seconds };
  return { kind: 'ok', seconds };
}

/**
 * Cell-level warning for a loaded tracker cell on a day row: Direct time is
 * always flagged; App time is flagged as remote-only when the day has no local
 * time and no Direct time. Totals rows and Total columns are never flagged.
 */
export function cellWarning(
  row: Pick<TimesheetRow, 'isTotal' | 'localSeconds'>,
  cell: TrackerDayHours,
  kind: TimesheetCellKind,
): AttentionReason | null {
  if (row.isTotal) return null;
  if (kind === 'direct' && cell.directSeconds > 0) return 'direct';
  if (kind === 'app' && row.localSeconds === 0 && cell.appSeconds > 0 && cell.directSeconds === 0) {
    return 'remoteOnly';
  }
  return null;
}
