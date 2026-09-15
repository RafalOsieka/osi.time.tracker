import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RemoteTimeLogDto } from '@osi/remote-trackers/contracts';
import type { TrackerDto } from '../../shared/types/tracker';
import type { ProjectDto } from '../../shared/types/project';
import type { ImportRemoteLogsResultDto } from '../../shared/types/remote-log-import';

const listProjects = vi.fn();
const fetchTimeLogsInRange = vi.fn();
const getSecret = vi.fn(() => 'secret');

// oxlint-disable-next-line anti-slop/no-module-mocking -- remote client factory is not injectable here
vi.mock('../../app/utils/remote/create-remote-adapter', () => ({
  createRemoteAdapter: () => ({
    listProjects,
    fetchTimeLogsInRange,
  }),
}));

// oxlint-disable-next-line anti-slop/no-module-mocking -- cookie secret composable has no test seam
vi.mock('../../app/composables/use-tracker-secret', () => ({
  useTrackerSecret: () => ({ get: getSecret, set: vi.fn(), clear: vi.fn() }),
}));

const { useRemoteLogImport } = await import('../../app/composables/use-remote-log-import');

const config: TrackerDto = {
  id: 'cfg-1',
  name: 'Tracker 1',
  systemType: 'openproject',
  baseUrl: 'https://op.example.com',
  directBrowserAccess: true,
  roundingRule: 'none',
  createdAt: '',
  updatedAt: '',
};

const project: ProjectDto = {
  id: 'proj-1',
  name: 'Project 1',
  trackerId: config.id,
  trackerName: config.name,
  remoteProjectId: 'R1',
  remoteProjectTitle: 'Remote Project',
  createdAt: '',
};

function log(remoteLogId: string, overrides: Partial<RemoteTimeLogDto> = {}): RemoteTimeLogDto {
  return {
    remoteLogId,
    remoteIssueId: '42',
    spentOn: '2026-04-15',
    durationSeconds: 3600,
    activityId: '1',
    activityName: 'Dev',
    comment: 'Task',
    remoteUserId: '7',
    remoteProjectId: 'R1',
    ...overrides,
  };
}

/** A stand-in for the server: computes wouldImport/imported and skippedExisting from a known-id set. */
function makeImportLogs(alreadyImportedIds: Set<string> = new Set()) {
  return vi.fn(
    async (body: {
      dryRun: boolean;
      groups: { projectId: string; logs: { remoteLogId: string }[] }[];
    }): Promise<ImportRemoteLogsResultDto> => {
      const projects = body.groups.map((group) => {
        const skippedExisting = group.logs.filter((l) =>
          alreadyImportedIds.has(l.remoteLogId),
        ).length;
        const wouldImport = group.logs.length - skippedExisting;
        if (!body.dryRun) {
          for (const l of group.logs) alreadyImportedIds.add(l.remoteLogId);
        }
        return {
          projectId: group.projectId,
          imported: body.dryRun ? 0 : wouldImport,
          wouldImport,
          skippedExisting,
        };
      });
      return {
        dryRun: body.dryRun,
        projects,
        totalImported: projects.reduce((s, p) => s + p.imported, 0),
        totalWouldImport: projects.reduce((s, p) => s + p.wouldImport, 0),
        totalSkippedExisting: projects.reduce((s, p) => s + p.skippedExisting, 0),
      };
    },
  );
}

describe('useRemoteLogImport', () => {
  beforeEach(() => {
    listProjects.mockReset();
    fetchTimeLogsInRange.mockReset();
    listProjects.mockResolvedValue([{ remoteProjectId: 'R1', title: 'Remote Project' }]);
  });

  it('scans two months, lands on mapping with the scope default, and imports end to end after advancing', async () => {
    fetchTimeLogsInRange.mockImplementation(async ({ from }: { from: string }) => {
      if (from === '2026-04-15') return [log('a'), log('b')];
      return [log('c')];
    });
    const importLogs = makeImportLogs();
    const composable = useRemoteLogImport({ config, projects: [project], importLogs });

    await composable.startScan({ from: '2026-04-15', to: '2026-05-10' });

    expect(composable.phase.value).toBe('mapping');
    expect(composable.totalMonths.value).toBe(2);
    expect(composable.scannedMonths.value).toBe(2);
    expect(importLogs).not.toHaveBeenCalled();
    expect(composable.mappingRows.value).toEqual([
      {
        remoteProjectId: 'R1',
        remoteProjectTitle: 'Remote Project',
        logCount: 3,
        defaultProjectId: 'proj-1',
      },
    ]);
    expect(composable.getMapping('R1')).toBe('proj-1');

    await composable.advanceToPreview();

    expect(composable.phase.value).toBe('preview');
    expect(composable.preview.value).toEqual({
      matched: [
        {
          projectId: 'proj-1',
          wouldImport: 3,
          skippedExisting: 0,
          remoteProjectTitles: ['Remote Project'],
        },
      ],
      unassignedCount: 0,
    });
    expect(composable.hasNothingToImport.value).toBe(false);

    await composable.startImport();

    expect(composable.phase.value).toBe('done');
    expect(composable.result.value).toEqual({
      totalImported: 3,
      totalSkippedExisting: 0,
      totalUnmatched: 0,
    });
    expect(composable.importedMonths.value).toBe(2);
  });

  it('stops at a failing month during scan and lets retry continue to mapping', async () => {
    fetchTimeLogsInRange
      .mockResolvedValueOnce([log('a')])
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce([log('a')]); // retry re-fetches month 2 successfully

    const importLogs = makeImportLogs();
    const composable = useRemoteLogImport({ config, projects: [project], importLogs });

    await composable.startScan({ from: '2026-04-01', to: '2026-05-31' });

    expect(composable.phase.value).toBe('error');
    expect(composable.errorState.value?.stage).toBe('scan');
    expect(composable.errorState.value?.monthsCompleted).toBe(1);
    expect(composable.errorState.value?.totalMonths).toBe(2);

    await composable.retry();

    expect(composable.phase.value).toBe('mapping');
    expect(composable.scannedMonths.value).toBe(2);
  });

  it('reports nothing to import once advanced to preview when every log is already linked', async () => {
    fetchTimeLogsInRange.mockResolvedValue([log('a'), log('b')]);
    const importLogs = makeImportLogs(new Set(['a', 'b']));
    const composable = useRemoteLogImport({ config, projects: [project], importLogs });

    await composable.startScan({ from: '2026-04-01', to: '2026-04-30' });
    await composable.advanceToPreview();

    expect(composable.preview.value.matched).toEqual([
      {
        projectId: 'proj-1',
        wouldImport: 0,
        skippedExisting: 2,
        remoteProjectTitles: ['Remote Project'],
      },
    ]);
    expect(composable.hasNothingToImport.value).toBe(true);
  });

  it('flags logs with no remote project id and defaults their row to unassigned', async () => {
    fetchTimeLogsInRange.mockResolvedValue([log('a', { remoteProjectId: undefined })]);
    const importLogs = makeImportLogs();
    const composable = useRemoteLogImport({ config, projects: [project], importLogs });

    await composable.startScan({ from: '2026-04-01', to: '2026-04-30' });

    expect(composable.missingProjectIdHint.value).toBe(true);
    expect(composable.mappingRows.value).toEqual([
      { remoteProjectId: null, remoteProjectTitle: null, logCount: 1, defaultProjectId: null },
    ]);
    expect(composable.getMapping(null)).toBeNull();

    await composable.advanceToPreview();
    expect(composable.preview.value).toEqual({ matched: [], unassignedCount: 1 });
  });

  it('picks up a previously unmatched remote project once scoped, purely from the new default (REQ-338)', async () => {
    fetchTimeLogsInRange.mockResolvedValue([log('a')]);
    const importLogs = makeImportLogs();

    // No Project is scoped to R1 yet, so the row defaults to unassigned.
    const unscoped = useRemoteLogImport({ config, projects: [], importLogs });
    await unscoped.startScan({ from: '2026-04-01', to: '2026-04-30' });
    expect(unscoped.getMapping('R1')).toBeNull();
    await unscoped.advanceToPreview();
    expect(unscoped.preview.value).toEqual({ matched: [], unassignedCount: 1 });

    // A Project is now scoped to R1; re-scanning the same range defaults the
    // row to that Project without anything server-side changing.
    const scoped = useRemoteLogImport({ config, projects: [project], importLogs });
    await scoped.startScan({ from: '2026-04-01', to: '2026-04-30' });
    expect(scoped.getMapping('R1')).toBe('proj-1');
    await scoped.advanceToPreview();
    expect(scoped.preview.value).toEqual({
      matched: [
        {
          projectId: 'proj-1',
          wouldImport: 1,
          skippedExisting: 0,
          remoteProjectTitles: ['Remote Project'],
        },
      ],
      unassignedCount: 0,
    });
  });

  it('cancels a running scan and returns to the range phase', async () => {
    fetchTimeLogsInRange.mockImplementation(async () => {
      composable.cancelScan();
      return [log('a')];
    });
    const importLogs = makeImportLogs();
    const composable = useRemoteLogImport({ config, projects: [project], importLogs });

    await composable.startScan({ from: '2026-04-01', to: '2026-05-31' });

    expect(composable.phase.value).toBe('range');
  });

  it('setMapping only mutates selection, never calling the server', async () => {
    fetchTimeLogsInRange.mockResolvedValue([log('a')]);
    const importLogs = makeImportLogs();
    const composable = useRemoteLogImport({ config, projects: [project], importLogs });

    await composable.startScan({ from: '2026-04-01', to: '2026-04-30' });
    composable.setMapping('R1', 'proj-other');

    expect(composable.getMapping('R1')).toBe('proj-other');
    expect(importLogs).not.toHaveBeenCalled();
  });

  it('merges two remote projects assigned to the same target into one preview row', async () => {
    fetchTimeLogsInRange.mockResolvedValue([
      log('a', { remoteProjectId: 'R1' }),
      log('b', { remoteProjectId: 'R2', remoteProjectTitle: 'Two' }),
    ]);
    const importLogs = makeImportLogs();
    const composable = useRemoteLogImport({ config, projects: [project], importLogs });

    await composable.startScan({ from: '2026-04-01', to: '2026-04-30' });
    composable.setMapping('R2', 'proj-1');
    await composable.advanceToPreview();

    expect(composable.preview.value.matched).toEqual([
      {
        projectId: 'proj-1',
        wouldImport: 2,
        skippedExisting: 0,
        remoteProjectTitles: ['Remote Project', 'Two'],
      },
    ]);
  });

  it('excludes a row left unassigned from the preview and re-grouping reflects a later selection change', async () => {
    fetchTimeLogsInRange.mockResolvedValue([
      log('a', { remoteProjectId: 'R1' }),
      log('b', { remoteProjectId: 'R2', remoteProjectTitle: 'Two' }),
    ]);
    const importLogs = makeImportLogs();
    const composable = useRemoteLogImport({ config, projects: [project], importLogs });

    await composable.startScan({ from: '2026-04-01', to: '2026-04-30' });
    // R2 has no default target: left unassigned.
    await composable.advanceToPreview();
    expect(composable.preview.value).toEqual({
      matched: [
        {
          projectId: 'proj-1',
          wouldImport: 1,
          skippedExisting: 0,
          remoteProjectTitles: ['Remote Project'],
        },
      ],
      unassignedCount: 1,
    });

    composable.backToMapping();
    expect(composable.phase.value).toBe('mapping');
    composable.setMapping('R2', 'proj-1');
    await composable.advanceToPreview();

    expect(composable.preview.value).toEqual({
      matched: [
        {
          projectId: 'proj-1',
          wouldImport: 2,
          skippedExisting: 0,
          remoteProjectTitles: ['Remote Project', 'Two'],
        },
      ],
      unassignedCount: 0,
    });
  });

  it('backToMapping then advanceToPreview re-dry-runs without re-fetching remote logs', async () => {
    fetchTimeLogsInRange.mockResolvedValue([log('a')]);
    const importLogs = makeImportLogs();
    const composable = useRemoteLogImport({ config, projects: [project], importLogs });

    await composable.startScan({ from: '2026-04-01', to: '2026-04-30' });
    await composable.advanceToPreview();
    const fetchCallsAfterFirstPreview = fetchTimeLogsInRange.mock.calls.length;

    composable.backToMapping();
    await composable.advanceToPreview();

    expect(fetchTimeLogsInRange.mock.calls.length).toBe(fetchCallsAfterFirstPreview);
  });

  it('reset() after reaching mapping clears the selection and returns to range', async () => {
    fetchTimeLogsInRange.mockResolvedValue([log('a')]);
    const importLogs = makeImportLogs();
    const composable = useRemoteLogImport({ config, projects: [project], importLogs });

    await composable.startScan({ from: '2026-04-01', to: '2026-04-30' });
    expect(composable.mappingRows.value.length).toBeGreaterThan(0);

    composable.reset();

    expect(composable.phase.value).toBe('range');
    expect(composable.mappingRows.value).toEqual([]);
    expect(composable.getMapping('R1')).toBeNull();
  });
});
