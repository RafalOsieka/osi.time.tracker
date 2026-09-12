import { describe, expect, it } from 'vitest';
import type { RemoteProjectDto, RemoteTimeLogDto } from '@osi/remote-trackers/contracts';
import {
  routeLogsByScope,
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
  it('routes a log in a scoped descendant project to that Project', () => {
    const projects: ScopedProjectLike[] = [{ id: 'proj-cmpl', remoteProjectId: 'R12' }];
    const result = routeLogsByScope([log('R14')], catalog, projects);

    expect(result.matched).toEqual([{ projectId: 'proj-cmpl', logs: [log('R14')] }]);
    expect(result.unmatched).toEqual([]);
  });

  it('resolves nested scopes to the most specific Project', () => {
    const projects: ScopedProjectLike[] = [
      { id: 'proj-cmpl', remoteProjectId: 'R12' },
      { id: 'proj-web', remoteProjectId: 'R13' },
    ];
    const result = routeLogsByScope([log('R13')], catalog, projects);

    expect(result.matched).toEqual([{ projectId: 'proj-web', logs: [log('R13')] }]);
  });

  it('reports a log outside every scope as unmatched under its remote project', () => {
    const projects: ScopedProjectLike[] = [{ id: 'proj-cmpl', remoteProjectId: 'R12' }];
    const result = routeLogsByScope([log('R99')], catalog, projects);

    expect(result.matched).toEqual([]);
    expect(result.unmatched).toEqual([
      { remoteProjectId: 'R99', remoteProjectTitle: 'Sales', logs: [log('R99')] },
    ]);
  });

  it('reports a log as unmatched when its remote project is absent from the catalog', () => {
    const projects: ScopedProjectLike[] = [{ id: 'proj-cmpl', remoteProjectId: 'R12' }];
    const ghost = log('R404');
    const result = routeLogsByScope([ghost], catalog, projects);

    expect(result.matched).toEqual([]);
    expect(result.unmatched).toEqual([
      { remoteProjectId: 'R404', remoteProjectTitle: null, logs: [ghost] },
    ]);
  });

  it("uses the log's own cached project title when the id is absent from the catalog", () => {
    const projects: ScopedProjectLike[] = [];
    const ghost: RemoteTimeLogDto = { ...log('R404'), remoteProjectTitle: 'Cached Title' };
    const result = routeLogsByScope([ghost], catalog, projects);

    expect(result.unmatched).toEqual([
      { remoteProjectId: 'R404', remoteProjectTitle: 'Cached Title', logs: [ghost] },
    ]);
  });

  it('reports a log with no remote project id as unmatched under a null bucket', () => {
    const projects: ScopedProjectLike[] = [{ id: 'proj-cmpl', remoteProjectId: 'R12' }];
    const noProject = log(undefined, 'l-no-project');
    const result = routeLogsByScope([noProject], catalog, projects);

    expect(result.matched).toEqual([]);
    expect(result.unmatched).toEqual([
      { remoteProjectId: null, remoteProjectTitle: null, logs: [noProject] },
    ]);
  });

  it('never routes to an unscoped Project', () => {
    const projects: ScopedProjectLike[] = [
      { id: 'proj-internal', remoteProjectId: null },
      { id: 'proj-cmpl', remoteProjectId: 'R12' },
    ];
    const result = routeLogsByScope([log('R99')], catalog, projects);

    expect(result.matched.some((group) => group.projectId === 'proj-internal')).toBe(false);
    expect(result.unmatched).toHaveLength(1);
  });

  it('groups several logs into the same matched or unmatched bucket', () => {
    const projects: ScopedProjectLike[] = [{ id: 'proj-cmpl', remoteProjectId: 'R12' }];
    const result = routeLogsByScope(
      [log('R13', 'a'), log('R14', 'b'), log('R99', 'c'), log('R99', 'd')],
      catalog,
      projects,
    );

    expect(result.matched).toEqual([
      { projectId: 'proj-cmpl', logs: [log('R13', 'a'), log('R14', 'b')] },
    ]);
    expect(result.unmatched).toHaveLength(1);
    expect(result.unmatched[0]!.logs.map((l) => l.remoteLogId)).toEqual(['c', 'd']);
  });
});
