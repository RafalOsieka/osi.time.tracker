import { describe, expect, it } from 'vitest';
import type { RemoteTimeLogDto } from '@osi/remote-trackers/contracts';
import {
  IMPORT_REQUEST_MAX_LOGS,
  splitGroupsIntoRequestBatches,
  splitIntoMonthChunks,
} from '../../app/utils/month-range';
import type { RouteLogsByScopeGroup } from '../../app/utils/remote/route-logs-by-scope';

function log(remoteLogId: string): RemoteTimeLogDto {
  return {
    remoteLogId,
    remoteIssueId: '1',
    spentOn: '2026-04-01',
    durationSeconds: 3600,
    activityId: null,
    activityName: null,
    comment: null,
    remoteUserId: null,
  };
}

describe('splitIntoMonthChunks', () => {
  it('returns one chunk for a range within a single month', () => {
    expect(splitIntoMonthChunks('2026-04-05', '2026-04-20')).toEqual([
      { from: '2026-04-05', to: '2026-04-20' },
    ]);
  });

  it('splits a multi-month range with partial first and last months', () => {
    expect(splitIntoMonthChunks('2021-03-15', '2021-05-10')).toEqual([
      { from: '2021-03-15', to: '2021-03-31' },
      { from: '2021-04-01', to: '2021-04-30' },
      { from: '2021-05-01', to: '2021-05-10' },
    ]);
  });

  it('handles a range spanning years', () => {
    const chunks = splitIntoMonthChunks('2020-11-15', '2021-02-10');
    expect(chunks.map((c) => c.from)).toEqual([
      '2020-11-15',
      '2020-12-01',
      '2021-01-01',
      '2021-02-01',
    ]);
    expect(chunks.map((c) => c.to)).toEqual([
      '2020-11-30',
      '2020-12-31',
      '2021-01-31',
      '2021-02-10',
    ]);
  });

  it('returns a single-day chunk when from equals to', () => {
    expect(splitIntoMonthChunks('2026-04-05', '2026-04-05')).toEqual([
      { from: '2026-04-05', to: '2026-04-05' },
    ]);
  });

  it('returns no chunks for an inverted range', () => {
    expect(splitIntoMonthChunks('2026-05-01', '2026-04-01')).toEqual([]);
  });
});

describe('splitGroupsIntoRequestBatches', () => {
  it('keeps small groups together in one batch', () => {
    const groups: RouteLogsByScopeGroup[] = [
      { projectId: 'p1', logs: [log('a'), log('b')] },
      { projectId: 'p2', logs: [log('c')] },
    ];
    expect(splitGroupsIntoRequestBatches(groups, 500)).toEqual([groups]);
  });

  it('splits across batches once the cap is reached', () => {
    const groups: RouteLogsByScopeGroup[] = [
      { projectId: 'p1', logs: [log('a'), log('b'), log('c')] },
      { projectId: 'p2', logs: [log('d'), log('e')] },
    ];
    const batches = splitGroupsIntoRequestBatches(groups, 3);
    expect(batches).toEqual([
      [{ projectId: 'p1', logs: [log('a'), log('b'), log('c')] }],
      [{ projectId: 'p2', logs: [log('d'), log('e')] }],
    ]);
  });

  it('splits a single oversized group across consecutive batches under the same projectId', () => {
    const groups: RouteLogsByScopeGroup[] = [
      { projectId: 'p1', logs: [log('a'), log('b'), log('c'), log('d'), log('e')] },
    ];
    const batches = splitGroupsIntoRequestBatches(groups, 2);
    expect(batches).toEqual([
      [{ projectId: 'p1', logs: [log('a'), log('b')] }],
      [{ projectId: 'p1', logs: [log('c'), log('d')] }],
      [{ projectId: 'p1', logs: [log('e')] }],
    ]);
  });

  it('returns no batches for no groups', () => {
    expect(splitGroupsIntoRequestBatches([], 500)).toEqual([]);
  });

  it('defaults the cap to IMPORT_REQUEST_MAX_LOGS', () => {
    const logs = Array.from({ length: IMPORT_REQUEST_MAX_LOGS + 1 }, (_, i) => log(`l${i}`));
    const batches = splitGroupsIntoRequestBatches([{ projectId: 'p1', logs }]);
    expect(batches).toHaveLength(2);
    expect(batches[0]![0]!.logs).toHaveLength(IMPORT_REQUEST_MAX_LOGS);
    expect(batches[1]![0]!.logs).toHaveLength(1);
  });
});
