import { describe, expect, it, vi } from 'vitest';
import { useSyncExport } from '../../app/composables/useSyncExport';
import type { RemoteSyncDayRowDto } from '../../shared/types/remote-sync-day';
import type { RemoteSystemConfigDto } from '../../shared/types/remote-system-config';
import { buildExportRequestKey } from '../../shared/utils/export-request-key';

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

function row(taskId = 'task-1', taskName = 'Ship it'): RemoteSyncDayRowDto {
  return {
    taskId,
    taskName,
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

function taskInput(
  taskId: string,
  overrides: Partial<{
    activityId: string;
    durationSeconds: number;
    entryIds: string[];
    spentOn: string;
    comment: string;
    taskName: string;
  }> = {},
) {
  return {
    row: row(taskId, overrides.taskName ?? 'Ship it'),
    config,
    remoteIssueId: '42',
    activityId: overrides.activityId ?? 'a1',
    durationSeconds: overrides.durationSeconds ?? 3600,
    entryIds: overrides.entryIds ?? ['e1'],
    spentOn: overrides.spentOn ?? '2026-03-15',
    comment: overrides.comment,
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
    const { runExport, outcomes, isRunning, progress, completedCount, totalCount } = useSyncExport({
      createTimeEntry,
      finalizeExport,
      refresh,
    });

    expect(isRunning.value).toBe(false);
    await runExport([taskInput('task-1')]);

    expect(createTimeEntry).toHaveBeenCalledTimes(1);
    expect(finalizeExport).toHaveBeenCalledTimes(1);
    expect(outcomes.value['task-1']?.status).toBe('success');
    expect(outcomes.value['task-1']?.messageKey).toBe('remoteSync.outcomeSuccess');
    expect(progress.value['task-1']).toBe('done');
    expect(completedCount.value).toBe(1);
    expect(totalCount.value).toBe(1);
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
    const { runExport, outcomes, progress } = useSyncExport({
      createTimeEntry,
      finalizeExport,
      onTaskFinalized,
    });

    await runExport([taskInput('task-a'), taskInput('task-b', { entryIds: ['e2'] })]);

    expect(outcomes.value['task-a']?.status).toBe('remote_failure');
    expect(progress.value['task-a']).toBe('failed');
    expect(outcomes.value['task-b']?.status).toBe('uncertain_finalization');
    expect(progress.value['task-b']).toBe('uncertain');
    expect(onTaskFinalized).toHaveBeenCalledTimes(1);
  });

  it('advances progress through creating and finalizing', async () => {
    const seen: string[] = [];
    const createTimeEntry = vi.fn().mockImplementation(async () => {
      seen.push('create');
      return { remoteLogId: '1' };
    });
    const finalizeExport = vi.fn().mockImplementation(async () => {
      seen.push('finalize');
      return { remoteLogId: '1', exportId: 'e' };
    });
    const { runExport, progress } = useSyncExport({ createTimeEntry, finalizeExport });
    await runExport([taskInput('task-1')]);
    expect(seen).toEqual(['create', 'finalize']);
    expect(progress.value['task-1']).toBe('done');
  });

  it('stops before the next task and marks remaining as not attempted', async () => {
    let resolveFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      resolveFirst = resolve;
    });
    const createTimeEntry = vi
      .fn()
      .mockImplementationOnce(async () => {
        await firstGate;
        return { remoteLogId: '1' };
      })
      .mockResolvedValue({ remoteLogId: '2' });
    const finalizeExport = vi.fn().mockResolvedValue({ remoteLogId: '1', exportId: 'e' });
    const { runExport, requestStop, progress, outcomes } = useSyncExport({
      createTimeEntry,
      finalizeExport,
    });

    const runPromise = runExport([
      taskInput('task-1'),
      taskInput('task-2', { entryIds: ['e2'] }),
      taskInput('task-3', { entryIds: ['e3'] }),
    ]);
    // Let the first task enter creating, then stop.
    await Promise.resolve();
    requestStop();
    resolveFirst();
    await runPromise;

    expect(createTimeEntry).toHaveBeenCalledTimes(1);
    expect(progress.value['task-1']).toBe('done');
    expect(progress.value['task-2']).toBe('not_attempted');
    expect(progress.value['task-3']).toBe('not_attempted');
    expect(outcomes.value['task-2']?.status).toBe('excluded');
    expect(outcomes.value['task-2']?.messageKey).toBe('remoteSync.exportNotAttempted');
  });

  it('retries a single uncertain task without re-creating the remote log', async () => {
    const createTimeEntry = vi.fn().mockResolvedValue({ remoteLogId: 'keep-me' });
    const finalizeExport = vi
      .fn()
      .mockRejectedValueOnce(new Error('db down'))
      .mockResolvedValueOnce({ remoteLogId: 'keep-me', exportId: 'exp-1' });
    const { runExport, retryTask, outcomes, progress } = useSyncExport({
      createTimeEntry,
      finalizeExport,
    });

    await runExport([taskInput('task-u', { entryIds: ['e-u'] })]);
    expect(outcomes.value['task-u']?.status).toBe('uncertain_finalization');
    expect(createTimeEntry).toHaveBeenCalledTimes(1);

    await retryTask('task-u');
    expect(createTimeEntry).toHaveBeenCalledTimes(1);
    expect(finalizeExport).toHaveBeenCalledTimes(2);
    expect(outcomes.value['task-u']?.status).toBe('success');
    expect(progress.value['task-u']).toBe('done');
    expect(finalizeExport.mock.calls[1]?.[0]?.remoteLogId).toBe('keep-me');
    expect(finalizeExport.mock.calls[0]?.[0]?.exportRequestKey).toBe(
      finalizeExport.mock.calls[1]?.[0]?.exportRequestKey,
    );
  });

  it('does not re-send other tasks when one is retried', async () => {
    const createTimeEntry = vi
      .fn()
      .mockResolvedValueOnce({ remoteLogId: 'ok' })
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ remoteLogId: 'retry-ok' });
    const finalizeExport = vi.fn().mockResolvedValue({ remoteLogId: 'ok', exportId: 'e' });
    const { runExport, retryTask } = useSyncExport({ createTimeEntry, finalizeExport });

    await runExport([taskInput('task-ok'), taskInput('task-fail', { entryIds: ['e2'] })]);
    expect(createTimeEntry).toHaveBeenCalledTimes(2);

    await retryTask('task-fail');
    expect(createTimeEntry).toHaveBeenCalledTimes(3);
    expect(createTimeEntry.mock.calls[2]?.[1]?.remoteIssueId).toBe('42');
  });

  it('sends the reviewed comment and falls back to the task name when empty', async () => {
    const createTimeEntry = vi.fn().mockResolvedValue({ remoteLogId: '1' });
    const finalizeExport = vi.fn().mockResolvedValue({ remoteLogId: '1', exportId: 'e' });
    const { runExport } = useSyncExport({ createTimeEntry, finalizeExport });

    await runExport([
      taskInput('task-c', { comment: '  custom note  ', taskName: 'Fallback Name' }),
    ]);
    expect(createTimeEntry.mock.calls[0]?.[1]?.comment).toBe('custom note');
    expect(finalizeExport.mock.calls[0]?.[0]?.comment).toBe('custom note');

    createTimeEntry.mockClear();
    finalizeExport.mockClear();
    await runExport([taskInput('task-empty', { comment: '   ', taskName: 'Fallback Name' })]);
    expect(createTimeEntry.mock.calls[0]?.[1]?.comment).toBe('Fallback Name');
  });

  it('passes a deterministic export request key to finalization', async () => {
    const createTimeEntry = vi.fn().mockResolvedValue({ remoteLogId: '1' });
    const finalizeExport = vi.fn().mockResolvedValue({ remoteLogId: '1', exportId: 'e' });
    const { runExport } = useSyncExport({ createTimeEntry, finalizeExport });
    const input = taskInput('task-key', {
      entryIds: ['b', 'a'],
      durationSeconds: 900,
      spentOn: '2026-05-01',
    });
    await runExport([input]);
    expect(finalizeExport.mock.calls[0]?.[0]?.exportRequestKey).toBe(
      buildExportRequestKey({
        taskId: 'task-key',
        localDate: '2026-05-01',
        entryIds: ['b', 'a'],
        exportDurationSeconds: 900,
      }),
    );
  });
});
