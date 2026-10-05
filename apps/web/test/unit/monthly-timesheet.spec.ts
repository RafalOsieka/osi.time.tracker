import { describe, expect, it } from 'vitest';
import type { RemoteTimeLogDto } from '@osi/remote-trackers/contracts';
import type { MonthlyReportDto } from '../../shared/types/report';
import {
  buildTimesheetRows,
  cellWarning,
  summarizeRemoteHours,
  type RemoteStateByTracker,
} from '../../app/utils/monthly-timesheet';

function log(remoteLogId: string, spentOn: string, durationSeconds: number): RemoteTimeLogDto {
  return {
    remoteLogId,
    remoteIssueId: '1',
    spentOn,
    durationSeconds,
    activityId: null,
    activityName: null,
    comment: null,
    remoteUserId: null,
    remoteIssueTitle: null,
  };
}

function report(overrides: Partial<MonthlyReportDto> = {}): MonthlyReportDto {
  return {
    month: '2026-09',
    timezone: 'UTC',
    trackers: [
      { id: 'op', name: 'OpenProject' },
      { id: 'rm', name: 'Redmine' },
    ],
    days: [],
    exports: [],
    ...overrides,
  };
}

const ok = (logs: RemoteTimeLogDto[]) => ({ status: 'ok' as const, logs, errorKey: null });
const failed = { status: 'error' as const, logs: [], errorKey: 'error.remoteTimeLogsFetchFailed' };

describe('buildTimesheetRows', () => {
  it('lists local and remote-only days together, sorted, then a totals row', () => {
    const rows = buildTimesheetRows(
      report({ days: [{ date: '2026-09-03', localSeconds: 3600 }] }),
      { op: ok([log('a', '2026-09-01', 1800)]), rm: ok([]) },
      true,
    );
    expect(rows.map((row) => row.date)).toEqual(['2026-09-01', '2026-09-03', 'total']);
    expect(rows.at(-1)?.isTotal).toBe(true);
  });

  it('splits exported (app) and unrecognized (direct) remote time per tracker', () => {
    const rows = buildTimesheetRows(
      report({
        days: [{ date: '2026-09-01', localSeconds: 3600 }],
        exports: [
          {
            localDate: '2026-09-01',
            trackerId: 'op',
            remoteLogId: 'exported',
            exportDurationSeconds: 3600,
          },
        ],
      }),
      {
        op: ok([log('exported', '2026-09-01', 3600), log('manual', '2026-09-01', 900)]),
        rm: ok([]),
      },
      true,
    );
    expect(rows[0]?.trackerCells.op).toEqual({
      appSeconds: 3600,
      directSeconds: 900,
      failed: false,
    });
  });

  it('marks a failed tracker without hiding the hours of the others', () => {
    const rows = buildTimesheetRows(
      report({ days: [{ date: '2026-09-01', localSeconds: 3600 }] }),
      { op: ok([log('a', '2026-09-01', 3600)]), rm: failed },
      true,
    );
    const day = rows[0];
    expect(day?.trackerCells.rm).toEqual({ appSeconds: 0, directSeconds: 0, failed: true });
    expect(day?.trackerCells.op?.directSeconds).toBe(3600);
    expect(rows.at(-1)?.trackerCells.rm?.failed).toBe(true);
  });

  it('sums local, app and direct time per tracker in the totals row', () => {
    const rows = buildTimesheetRows(
      report({
        days: [
          { date: '2026-09-01', localSeconds: 3600 },
          { date: '2026-09-02', localSeconds: 1800 },
        ],
        exports: [
          {
            localDate: '2026-09-01',
            trackerId: 'op',
            remoteLogId: 'x',
            exportDurationSeconds: 3600,
          },
        ],
      }),
      { op: ok([log('x', '2026-09-01', 3600), log('y', '2026-09-02', 600)]), rm: ok([]) },
      true,
    );
    const totals = rows.at(-1);
    expect(totals?.localSeconds).toBe(5400);
    expect(totals?.trackerCells.op).toEqual({
      appSeconds: 3600,
      directSeconds: 600,
      failed: false,
    });
    expect(totals?.trackerCells.rm).toEqual({ appSeconds: 0, directSeconds: 0, failed: false });
  });

  it('flags unexported local time only once every tracker fetch has settled', () => {
    const input = report({ days: [{ date: '2026-09-01', localSeconds: 3600 }] });
    const remotes: RemoteStateByTracker = { op: ok([]), rm: ok([]) };
    expect(buildTimesheetRows(input, remotes, false)[0]?.warnUnexported).toBe(false);
    expect(buildTimesheetRows(input, remotes, true)[0]?.warnUnexported).toBe(true);
  });

  it('does not flag unexported time when a tracker failed to load', () => {
    const rows = buildTimesheetRows(
      report({ days: [{ date: '2026-09-01', localSeconds: 3600 }] }),
      { op: ok([]), rm: failed },
      true,
    );
    expect(rows[0]?.warnUnexported).toBe(false);
  });

  it('returns no rows, not a lone totals row, for an empty month', () => {
    expect(buildTimesheetRows(report(), { op: ok([]), rm: ok([]) }, true)).toEqual([]);
  });
});

describe('summarizeRemoteHours', () => {
  it('is pending until the tracker fetches settle', () => {
    expect(summarizeRemoteHours(report(), {}, false)).toEqual({ kind: 'pending' });
  });

  it('reports zero hours when the month has no trackers', () => {
    expect(summarizeRemoteHours(report({ trackers: [] }), {}, true)).toEqual({
      kind: 'ok',
      seconds: 0,
    });
  });

  it('sums every log when all trackers loaded', () => {
    expect(
      summarizeRemoteHours(
        report(),
        { op: ok([log('a', '2026-09-01', 3600)]), rm: ok([log('b', '2026-09-02', 600)]) },
        true,
      ),
    ).toEqual({ kind: 'ok', seconds: 4200 });
  });

  it('is partial with the loaded hours when some trackers failed', () => {
    expect(
      summarizeRemoteHours(report(), { op: ok([log('a', '2026-09-01', 3600)]), rm: failed }, true),
    ).toEqual({ kind: 'partial', seconds: 3600 });
  });

  it('is failed when no tracker loaded', () => {
    expect(summarizeRemoteHours(report(), { op: failed, rm: failed }, true)).toEqual({
      kind: 'failed',
    });
  });
});

describe('cellWarning', () => {
  const day = { isTotal: false, localSeconds: 3600 };

  it('flags direct time in the direct column', () => {
    expect(cellWarning(day, { appSeconds: 0, directSeconds: 600 }, 'direct')).toBe('direct');
    expect(cellWarning(day, { appSeconds: 0, directSeconds: 0 }, 'direct')).toBeNull();
  });

  it('flags app time as remote-only on a day without local or direct time', () => {
    const noLocal = { isTotal: false, localSeconds: 0 };
    expect(cellWarning(noLocal, { appSeconds: 600, directSeconds: 0 }, 'app')).toBe('remoteOnly');
    expect(cellWarning(noLocal, { appSeconds: 600, directSeconds: 300 }, 'app')).toBeNull();
    expect(cellWarning(day, { appSeconds: 600, directSeconds: 0 }, 'app')).toBeNull();
  });

  it('never flags the totals row or the total column', () => {
    const totals = { isTotal: true, localSeconds: 0 };
    expect(cellWarning(totals, { appSeconds: 600, directSeconds: 600 }, 'direct')).toBeNull();
    expect(cellWarning(totals, { appSeconds: 600, directSeconds: 0 }, 'app')).toBeNull();
    expect(cellWarning(day, { appSeconds: 600, directSeconds: 600 }, 'total')).toBeNull();
  });
});
