import { describe, expect, it } from 'vitest';
import type { RemoteTimeLogDto } from '@osi/remote-trackers/contracts';
import {
  buildClientReport,
  toDisplayUnits,
  type BuildClientReportInput,
  type ClientReportTracker,
} from '../../app/utils/client-report/build-client-report';
import { formatReportHours } from '../../app/utils/client-report/format';

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

let logSeq = 0;
function log(overrides: Partial<RemoteTimeLogDto>): RemoteTimeLogDto {
  logSeq += 1;
  return {
    remoteLogId: String(logSeq),
    remoteIssueId: '1',
    spentOn: '2026-09-01',
    durationSeconds: 3600,
    activityId: null,
    activityName: 'Development',
    comment: 'Work',
    remoteUserId: null,
    remoteIssueTitle: 'Issue',
    ...overrides,
  };
}

function build(
  logsByTracker: Record<string, RemoteTimeLogDto[]>,
  overrides: Partial<BuildClientReportInput> = {},
) {
  return buildClientReport({
    preset: { clientName: 'Helios Energy', hoursFormat: 'decimal' },
    trackers: [openProject, redmine],
    logsByTracker,
    month: '2026-09',
    user: { displayName: 'John Doe', email: 'john@example.com' },
    generatedAt: new Date('2026-10-01T12:32:00Z'),
    timeZone: 'Europe/Warsaw',
    ...overrides,
  });
}

describe('buildClientReport', () => {
  it('keeps only days with logs, in ascending order, with counts and range', () => {
    const report = build({
      op: [log({ spentOn: '2026-09-03' }), log({ spentOn: '2026-09-01' })],
      rm: [log({ spentOn: '2026-09-03' })],
    });

    expect(report.days.map((day) => day.date)).toEqual(['2026-09-01', '2026-09-03']);
    expect(report.days.length).toBe(2);
    expect(report.logCount).toBe(3);
    expect(report.range).toEqual({ from: '2026-09-01', to: '2026-09-30' });
  });

  it('orders rows by preset tracker, then issue id, then log id (numeric when numeric)', () => {
    const report = build({
      rm: [log({ remoteIssueId: '112', remoteLogId: '5' })],
      op: [
        log({ remoteIssueId: '10', remoteLogId: '20' }),
        log({ remoteIssueId: '9', remoteLogId: '30' }),
        log({ remoteIssueId: '10', remoteLogId: '3' }),
        log({ remoteIssueId: 'b', remoteLogId: 'x' }),
        log({ remoteIssueId: 'a', remoteLogId: 'y' }),
      ],
    });

    expect(
      report.days[0]!.rows.map(
        (row) => `${row.tracker.id}#${row.remoteIssueId}/${row.remoteLogId}`,
      ),
    ).toEqual(['op#9/30', 'op#10/3', 'op#10/20', 'op#a/y', 'op#b/x', 'rm#112/5']);
  });

  it('sums decimal totals from rounded row values (three 20-minute logs → 0,33 each, 0,99)', () => {
    const report = build({
      op: [
        log({ durationSeconds: 1200 }),
        log({ durationSeconds: 1200 }),
        log({ durationSeconds: 1200 }),
      ],
    });

    const day = report.days[0]!;
    expect(day.rows.map((row) => formatReportHours(row.units, 'decimal', 'pl'))).toEqual([
      '0,33',
      '0,33',
      '0,33',
    ]);
    expect(formatReportHours(day.totalUnits, 'decimal', 'pl')).toBe('0,99');
    expect(formatReportHours(report.totalUnits, 'decimal', 'pl')).toBe('0,99');
  });

  it('floors seconds in hm format (7:50:59 → 7:50)', () => {
    const report = build(
      { op: [log({ durationSeconds: 7 * 3600 + 50 * 60 + 59 })] },
      { preset: { clientName: 'Helios Energy', hoursFormat: 'hm' } },
    );

    expect(formatReportHours(report.days[0]!.rows[0]!.units, 'hm', 'pl')).toBe('7:50');
  });

  it('rounds decimal hundredths half-up', () => {
    // 0.125 h = 450 s → 0.13
    expect(toDisplayUnits(450, 'decimal')).toBe(13);
    expect(toDisplayUnits(449, 'decimal')).toBe(12);
  });

  it('totals each tracker in preset order, including trackers without logs', () => {
    const report = build({
      op: [
        log({ durationSeconds: 3600, spentOn: '2026-09-01' }),
        log({ durationSeconds: 1800, spentOn: '2026-09-02' }),
      ],
    });

    expect(report.trackers.map(({ tracker, totalUnits }) => [tracker.id, totalUnits])).toEqual([
      ['op', 150],
      ['rm', 0],
    ]);
    expect(report.totalUnits).toBe(150);
  });
});
