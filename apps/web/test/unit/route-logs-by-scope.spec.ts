import { describe, expect, it } from 'vitest';
import type { RemoteProjectDto, RemoteTimeLogDto } from '@osi/remote-trackers/contracts';
import {
  bucketKey,
  groupLogsBySelection,
  routeLogsByScope,
  type RemoteProjectBucket,
  type ScopedProjectLike,
} from '../../app/utils/remote/route-logs-by-scope';

function log(
  remoteProjectId: string | undefined,
  remoteLogId = `l-${remoteProjectId}`,
): RemoteTimeLogDto {
  const entry: RemoteTimeLogDto = {
    remoteLogId,
    remoteIssueId: '1',
    spentOn: '2026-04-01',
    durationSeconds: 3600,
    activityId: null,
    activityName: null,
    comment: null,
    remoteUserId: null,
  };
  if (remoteProjectId) entry.remoteProjectId = remoteProjectId;
  return entry;
}

/**
 * R1 (Clients)
 * +-- R12 (CMPL)
 *      +-- R13 (CMPL / Web)
 *      +-- R14 (CMPL / API)
 * R40 (Mobile)
 * R99 (Sales) — no scope anywhere
 */
const catalog: RemoteProjectDto[] = [
  { remoteProjectId: 'R1', title: 'Clients' },
  { remoteProjectId: 'R12', title: 'CMPL', parentId: 'R1' },
  { remoteProjectId: 'R13', title: 'CMPL / Web', parentId: 'R12' },
  { remoteProjectId: 'R14', title: 'CMPL / API', parentId: 'R12' },
  { remoteProjectId: 'R40', title: 'Mobile' },
  { remoteProjectId: 'R99', title: 'Sales' },
];

describe('routeLogsByScope', () => {
  it('gives a log in a scoped descendant project a default target of that Project', () => {
    const projects: ScopedProjectLike[] = [{ id: 'proj-cmpl', remoteProjectId: 'R12' }];
    const [bucket] = routeLogsByScope([log('R14')], catalog, projects);

    expect(bucket).toEqual({
      remoteProjectId: 'R14',
      remoteProjectTitle: 'CMPL / API',
      logs: [log('R14')],
      defaultProjectId: 'proj-cmpl',
    });
  });

  it('resolves nested scopes to the most specific Project', () => {
    const projects: ScopedProjectLike[] = [
      { id: 'proj-cmpl', remoteProjectId: 'R12' },
      { id: 'proj-web', remoteProjectId: 'R13' },
    ];
    const [bucket] = routeLogsByScope([log('R13')], catalog, projects);

    expect(bucket?.defaultProjectId).toBe('proj-web');
  });

  it('gives an out-of-scope log no default target', () => {
    const projects: ScopedProjectLike[] = [{ id: 'proj-cmpl', remoteProjectId: 'R12' }];
    const [bucket] = routeLogsByScope([log('R99')], catalog, projects);

    expect(bucket).toEqual({
      remoteProjectId: 'R99',
      remoteProjectTitle: 'Sales',
      logs: [log('R99')],
      defaultProjectId: null,
    });
  });

  it('gives a log no default target when its remote project is absent from the catalog', () => {
    const projects: ScopedProjectLike[] = [{ id: 'proj-cmpl', remoteProjectId: 'R12' }];
    const ghost = log('R404');
    const [bucket] = routeLogsByScope([ghost], catalog, projects);

    expect(bucket).toEqual({
      remoteProjectId: 'R404',
      remoteProjectTitle: null,
      logs: [ghost],
      defaultProjectId: null,
    });
  });

  it("uses the log's own cached project title when the id is absent from the catalog", () => {
    const projects: ScopedProjectLike[] = [];
    const ghost: RemoteTimeLogDto = { ...log('R404'), remoteProjectTitle: 'Cached Title' };
    const [bucket] = routeLogsByScope([ghost], catalog, projects);

    expect(bucket?.remoteProjectTitle).toBe('Cached Title');
  });

  it('groups logs with no remote project id under a single null bucket with no default target', () => {
    const projects: ScopedProjectLike[] = [{ id: 'proj-cmpl', remoteProjectId: 'R12' }];
    const noProjectA = log(undefined, 'l-no-project-a');
    const noProjectB = log(undefined, 'l-no-project-b');
    const buckets = routeLogsByScope([noProjectA, noProjectB], catalog, projects);

    expect(buckets).toEqual([
      {
        remoteProjectId: null,
        remoteProjectTitle: null,
        logs: [noProjectA, noProjectB],
        defaultProjectId: null,
      },
    ]);
  });

  it('never gives an unscoped Project a default target', () => {
    const projects: ScopedProjectLike[] = [
      { id: 'proj-internal', remoteProjectId: null },
      { id: 'proj-cmpl', remoteProjectId: 'R12' },
    ];
    const [bucket] = routeLogsByScope([log('R99')], catalog, projects);

    expect(bucket?.defaultProjectId).toBeNull();
  });

  it('groups several logs for the same remote project into one bucket', () => {
    const projects: ScopedProjectLike[] = [{ id: 'proj-cmpl', remoteProjectId: 'R12' }];
    const buckets = routeLogsByScope(
      [log('R13', 'a'), log('R14', 'b'), log('R99', 'c'), log('R99', 'd')],
      catalog,
      projects,
    );

    expect(buckets).toHaveLength(3);
    const sales = buckets.find((b) => b.remoteProjectId === 'R99');
    expect(sales?.logs.map((l) => l.remoteLogId)).toEqual(['c', 'd']);
  });
});

describe('groupLogsBySelection', () => {
  function bucket(overrides: Partial<RemoteProjectBucket>): RemoteProjectBucket {
    return {
      remoteProjectId: 'R1',
      remoteProjectTitle: 'One',
      logs: [log('R1', 'a')],
      defaultProjectId: null,
      ...overrides,
    };
  }

  it('groups a bucket under its selected target regardless of the default', () => {
    const buckets = [bucket({ remoteProjectId: 'R1', defaultProjectId: 'proj-a' })];
    const selection = new Map([[bucketKey('R1'), 'proj-b']]);

    expect(groupLogsBySelection(buckets, selection)).toEqual([
      { projectId: 'proj-b', logs: buckets[0]!.logs },
    ]);
  });

  it('merges two remote project buckets assigned the same target', () => {
    const logsR1 = [log('R1', 'a')];
    const logsR2 = [log('R2', 'b')];
    const buckets = [
      bucket({ remoteProjectId: 'R1', logs: logsR1 }),
      bucket({ remoteProjectId: 'R2', logs: logsR2, remoteProjectTitle: 'Two' }),
    ];
    const selection = new Map([
      [bucketKey('R1'), 'proj-shared'],
      [bucketKey('R2'), 'proj-shared'],
    ]);

    const groups = groupLogsBySelection(buckets, selection);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.projectId).toBe('proj-shared');
    expect(groups[0]!.logs.map((l) => l.remoteLogId)).toEqual(['a', 'b']);
  });

  it('drops a bucket left unselected (missing from or null in the selection map)', () => {
    const buckets = [
      bucket({ remoteProjectId: 'R1' }),
      bucket({ remoteProjectId: 'R2', remoteProjectTitle: 'Two' }),
    ];
    const selection = new Map<string, string | null>([
      [bucketKey('R1'), 'proj-a'],
      [bucketKey('R2'), null],
    ]);

    expect(groupLogsBySelection(buckets, selection)).toEqual([
      { projectId: 'proj-a', logs: buckets[0]!.logs },
    ]);
  });

  it('groups the no-remote-project-id bucket under the empty-string key', () => {
    const noProject = log(undefined, 'x');
    const buckets = [
      bucket({ remoteProjectId: null, remoteProjectTitle: null, logs: [noProject] }),
    ];
    const selection = new Map([[bucketKey(null), 'proj-catch-all']]);

    expect(groupLogsBySelection(buckets, selection)).toEqual([
      { projectId: 'proj-catch-all', logs: [noProject] },
    ]);
  });
});
