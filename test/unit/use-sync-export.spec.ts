import { describe, expect, it, vi } from 'vitest';
import { useSyncExport } from '../../app/composables/useSyncExport';
import type { RemoteSyncDayRowDto } from '../../shared/types/remote-sync-day';
import type { RemoteSystemConfigDto } from '../../shared/types/remote-system-config';

const config: RemoteSystemConfigDto = {
  id: 'cfg-1',
  clientId: 'client-1',
  systemType: 'openproject',
  baseUrl: 'https://op.example.com',
  executionMode: 'client',
  roundingRule: 'none',
  requiredFieldDefaults: {},
  createdAt: '',
  updatedAt: '',
};

function row(taskId = 'task-1'): RemoteSyncDayRowDto {
  return {
    taskId,
    taskName: 'Ship it',
    projectName: 'P',
    clientName: 'C',
    totalSeconds: 3600,
    entries: [],
    exports: [],
    config: {
      id: config.id,
      systemType: 'openproject',
      baseUrl: config.baseUrl,
      executionMode: 'client',
      roundingRule: 'none',
      requiredFieldDefaults: {},
    },
    issueRef: {
      remoteIssueId: '42',
      cachedTitle: 'Issue',
    },
  };
}

describe('useSyncExport', () => {
  it('reports success outcomes per task and runs at most one create per task', async () => {
    const createTimeEntry = vi.fn().mockResolvedValue({ remoteLogId: '9001' });
    const finalizeExport = vi.fn().mockResolvedValue({
      remoteLogId: '9001',
      exportId: 'exp-1',
    });
    const refresh = vi.fn();
    const { runExport, outcomes, isRunning } = useSyncExport({
      createTimeEntry,
      finalizeExport,
      refresh,
    });

    expect(isRunning.value).toBe(false);
    await runExport([
      {
        row: row('task-1'),
        config,
        remoteIssueId: '42',
        activityId: 'a1',
        durationSeconds: 3600,
        entryIds: ['e1'],
        spentOn: '2026-03-15',
      },
    ]);

    expect(createTimeEntry).toHaveBeenCalledTimes(1);
    expect(finalizeExport).toHaveBeenCalledTimes(1);
    expect(outcomes.value['task-1']?.status).toBe('success');
    expect(outcomes.value['task-1']?.messageKey).toBe('remoteSync.outcomeSuccess');
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(isRunning.value).toBe(false);
  });

  it('maps remote create failures and uncertain finalization separately', async () => {
    const createTimeEntry = vi
      .fn()
      .mockRejectedValueOnce(new Error('remote down'))
      .mockResolvedValueOnce({ remoteLogId: '9002' });
    const finalizeExport = vi.fn().mockRejectedValueOnce(new Error('db down'));
    const onTaskFinalized = vi.fn();
    const { runExport, outcomes } = useSyncExport({
      createTimeEntry,
      finalizeExport,
      onTaskFinalized,
    });

    await runExport([
      {
        row: row('task-a'),
        config,
        remoteIssueId: '1',
        activityId: 'a1',
        durationSeconds: 600,
        entryIds: ['e1'],
        spentOn: '2026-03-15',
      },
      {
        row: row('task-b'),
        config,
        remoteIssueId: '2',
        activityId: 'a1',
        durationSeconds: 600,
        entryIds: ['e2'],
        spentOn: '2026-03-15',
      },
    ]);

    expect(outcomes.value['task-a']?.status).toBe('remote_failure');
    expect(outcomes.value['task-b']?.status).toBe('uncertain_finalization');
    expect(onTaskFinalized).toHaveBeenCalledTimes(1);
  });
});
