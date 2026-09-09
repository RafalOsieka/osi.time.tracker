import { describe, expect, it, vi } from 'vitest';
import { ExtensionProtocolError } from '@osi/extension-protocol';
import { useSyncExport as createSyncExport } from '../../app/composables/use-sync-export';
import type { RemoteSyncDayRowDto } from '../../shared/types/remote-sync-day';
import type { TrackerDto } from '../../shared/types/tracker';
import { buildExportRequestKey } from '../../shared/utils/export-request-key';
import {
  ExportRecoveryStorageError,
  pendingCreateIdentity,
  type PendingCreateMarker,
  type PendingCreateStore,
} from '../../app/utils/remote/pending-creates';

const config: TrackerDto = {
  id: 'cfg-1',
  name: 'Tracker 1',
  systemType: 'openproject',
  baseUrl: 'https://op.example.com',
  executionMode: 'client',
  roundingRule: 'none',
  createdAt: '',
  updatedAt: '',
};

function row(taskId = 'task-1', taskName = 'Ship it'): RemoteSyncDayRowDto {
  return {
    taskId,
    taskName,
    projectName: 'P',
    trackerName: 'C',
    totalSeconds: 3600,
    entries: [],
    exports: [],
    config: {
      id: config.id,
      systemType: 'openproject',
      baseUrl: config.baseUrl,
      executionMode: 'client',
      roundingRule: 'none',
    },
    issueRef: {
      remoteIssueId: '42',
      cachedTitle: 'Issue',
    },
  };
}

const extensionConfig: TrackerDto = { ...config, executionMode: 'extension' };

function memoryPendingCreates(): PendingCreateStore & {
  markers: Map<string, PendingCreateMarker>;
  add: (marker: PendingCreateMarker) => void;
} {
  const markers = new Map<string, PendingCreateMarker>();
  return {
    markers,
    list: () => [...markers.values()],
    add: (marker) => {
      markers.set(pendingCreateIdentity(marker), marker);
    },
    async transaction(update) {
      const next = structuredClone([...markers.values()]);
      const result = update(next);
      markers.clear();
      for (const marker of next) markers.set(pendingCreateIdentity(marker), marker);
      return result;
    },
  };
}

function useSyncExport(options: Parameters<typeof createSyncExport>[0]) {
  return createSyncExport({ pendingCreates: memoryPendingCreates(), ...options });
}

function extensionTask(taskId: string, entryIds = ['e1']) {
  return { ...taskInput(taskId, { entryIds }), config: extensionConfig };
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
  it('uses separate local finalization keys for an explicit retry of UNKNOWN', async () => {
    const pending = memoryPendingCreates();
    const sync = useSyncExport({
      createTimeEntry: vi
        .fn()
        .mockRejectedValue(
          new ExtensionProtocolError('unknown-create', 'error.extensionUnknownCreate'),
        ),
      finalizeExport: vi.fn(),
      pendingCreates: pending,
      confirmUnknownCreateRetry: async () => true,
    });
    await sync.runExport([extensionTask('attempts')]);
    await sync.retryTask('attempts');
    expect(pending.list()).toHaveLength(2);
    expect(new Set(pending.list().map(pendingCreateIdentity)).size).toBe(2);
    expect(new Set(pending.list().map((marker) => marker.exportRequestKey)).size).toBe(2);
  });

  it('does not discard a received ID when finalization replays a different remote log', async () => {
    const pending = memoryPendingCreates();
    const sync = useSyncExport({
      createTimeEntry: vi.fn().mockResolvedValue({ remoteLogId: 'received' }),
      finalizeExport: vi.fn().mockResolvedValue({ remoteLogId: 'different', exportId: 'saved' }),
      pendingCreates: pending,
    });
    await sync.runExport([extensionTask('collision')]);
    expect(sync.outcomes.value.collision).toMatchObject({
      status: 'uncertain_finalization',
      remoteLogId: 'received',
    });
    expect(pending.list()[0]?.recovery).toMatchObject({ status: 'known', remoteLogId: 'received' });
  });
  it('keeps a reconciled ID when the original create later returns a different ID', async () => {
    const pending = memoryPendingCreates();
    const gate = Promise.withResolvers<{ remoteLogId: string }>();
    const createTimeEntry = vi.fn().mockReturnValue(gate.promise);
    const finalizeExport = vi.fn().mockRejectedValue(new Error('offline'));
    const first = useSyncExport({ createTimeEntry, finalizeExport, pendingCreates: pending });
    const second = useSyncExport({
      createTimeEntry,
      finalizeExport,
      pendingCreates: pending,
      validateExistingRemoteLog: vi.fn().mockResolvedValue(undefined),
    });
    const running = first.runExport([extensionTask('race')]);
    await vi.waitFor(() => expect(createTimeEntry).toHaveBeenCalledTimes(1));
    await second.runExport([extensionTask('race')]);
    await second.reconcileTask('race', 'selected');
    gate.resolve({ remoteLogId: 'received' });
    await running;
    expect(pending.list().map((marker) => marker.recovery)).toEqual([
      expect.objectContaining({ status: 'known', remoteLogId: 'selected' }),
      expect.objectContaining({ status: 'known', remoteLogId: 'received' }),
    ]);
    expect(new Set(pending.list().map(pendingCreateIdentity)).size).toBe(2);
  });

  it('does not remove another tab’s reconciled ID on a late definitive failure', async () => {
    const pending = memoryPendingCreates();
    const gate = Promise.withResolvers<{ remoteLogId: string }>();
    const createTimeEntry = vi.fn().mockReturnValue(gate.promise);
    const finalizeExport = vi.fn().mockRejectedValue(new Error('offline'));
    const first = useSyncExport({ createTimeEntry, finalizeExport, pendingCreates: pending });
    const second = useSyncExport({
      createTimeEntry,
      finalizeExport,
      pendingCreates: pending,
      validateExistingRemoteLog: vi.fn().mockResolvedValue(undefined),
    });
    const running = first.runExport([extensionTask('race')]);
    await vi.waitFor(() => expect(createTimeEntry).toHaveBeenCalledTimes(1));
    await second.runExport([extensionTask('race')]);
    await second.reconcileTask('race', 'selected');
    gate.reject(new ExtensionProtocolError('unavailable', 'error.extensionUnavailable'));
    await running;
    expect(pending.list()).toHaveLength(1);
    expect(pending.list()[0]?.recovery).toMatchObject({ status: 'known', remoteLogId: 'selected' });
  });

  it('rechecks UNKNOWN atomically after concurrent reconciliation validation', async () => {
    const pending = memoryPendingCreates();
    const createTimeEntry = vi
      .fn()
      .mockRejectedValue(
        new ExtensionProtocolError('unknown-create', 'error.extensionUnknownCreate'),
      );
    const finalizeExport = vi.fn().mockRejectedValue(new Error('offline'));
    const gate = Promise.withResolvers<undefined>();
    const validateExistingRemoteLog = vi.fn().mockReturnValue(gate.promise);
    const first = useSyncExport({
      createTimeEntry,
      finalizeExport,
      pendingCreates: pending,
      validateExistingRemoteLog,
    });
    const second = useSyncExport({
      createTimeEntry,
      finalizeExport,
      pendingCreates: pending,
      validateExistingRemoteLog: vi.fn().mockResolvedValue(undefined),
    });
    await first.runExport([extensionTask('race')]);
    await second.runExport([extensionTask('race')]);
    const reconciling = first.reconcileTask('race', 'stale');
    await vi.waitFor(() => expect(validateExistingRemoteLog).toHaveBeenCalledTimes(1));
    await second.reconcileTask('race', 'selected');
    gate.resolve(undefined);
    await reconciling;
    expect(finalizeExport).toHaveBeenCalledTimes(1);
    expect(pending.list()[0]?.recovery).toMatchObject({ status: 'known', remoteLogId: 'selected' });
    expect(first.isRunning.value).toBe(false);
  });

  it('retains recovery if removing a finalized record fails, then replays finalization only', async () => {
    const pending = memoryPendingCreates();
    const transaction = pending.transaction;
    const createTimeEntry = vi.fn().mockResolvedValue({ remoteLogId: 'saved' });
    const finalizeExport = vi.fn().mockImplementation(async () => {
      vi.spyOn(pending, 'transaction').mockRejectedValue(new ExportRecoveryStorageError());
      return { remoteLogId: 'saved', exportId: 'export' };
    });
    const sync = useSyncExport({ createTimeEntry, finalizeExport, pendingCreates: pending });
    await sync.runExport([extensionTask('cleanup')]);
    expect(sync.outcomes.value.cleanup?.status).toBe('uncertain_finalization');
    expect(pending.list()[0]?.recovery).toMatchObject({ status: 'known', remoteLogId: 'saved' });
    pending.transaction = transaction;
    finalizeExport.mockResolvedValue({ remoteLogId: 'saved', exportId: 'export' });
    const reloaded = useSyncExport({ createTimeEntry, finalizeExport, pendingCreates: pending });
    await reloaded.runExport([extensionTask('cleanup')]);
    expect(createTimeEntry).toHaveBeenCalledTimes(1);
    expect(finalizeExport).toHaveBeenCalledTimes(2);
    expect(pending.list()).toEqual([]);
  });
  it('fails closed with the default store during SSR', async () => {
    const createTimeEntry = vi.fn();
    const sync = createSyncExport({ createTimeEntry, finalizeExport: vi.fn() });
    await sync.runExport([extensionTask('task-ssr')]);
    expect(createTimeEntry).not.toHaveBeenCalled();
    expect(sync.outcomes.value['task-ssr']?.messageKey).toBe('error.exportRecoveryUnavailable');
    expect(sync.isRunning.value).toBe(false);
  });

  it('resumes known-ID finalization in a new composable using the original payload', async () => {
    const pending = memoryPendingCreates();
    const createTimeEntry = vi.fn().mockResolvedValue({ remoteLogId: 'durable' });
    const finalizeExport = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue({ remoteLogId: 'durable', exportId: 'saved' });
    const original = extensionTask('reload');
    await useSyncExport({ createTimeEntry, finalizeExport, pendingCreates: pending }).runExport([
      original,
    ]);
    expect(pending.list()[0]?.recovery).toMatchObject({ status: 'known', remoteLogId: 'durable' });
    const reloaded = useSyncExport({ createTimeEntry, finalizeExport, pendingCreates: pending });
    await reloaded.runExport([
      {
        ...original,
        durationSeconds: 60,
        entryIds: ['changed'],
        remoteIssueId: 'changed',
        activityId: 'changed',
        comment: 'changed',
      },
    ]);
    expect(createTimeEntry).toHaveBeenCalledTimes(1);
    expect(finalizeExport.mock.calls[1]?.[0]).toEqual(finalizeExport.mock.calls[0]?.[0]);
    expect(pending.list()).toEqual([]);
  });

  it('preserves an older UNKNOWN attempt after a confirmed retry definitively fails', async () => {
    const pending = memoryPendingCreates();
    const createTimeEntry = vi
      .fn()
      .mockRejectedValueOnce(
        new ExtensionProtocolError('unknown-create', 'error.extensionUnknownCreate'),
      )
      .mockRejectedValueOnce(
        new ExtensionProtocolError('unavailable', 'error.extensionUnavailable'),
      );
    const sync = useSyncExport({
      createTimeEntry,
      finalizeExport: vi.fn(),
      pendingCreates: pending,
      confirmUnknownCreateRetry: async () => true,
    });
    await sync.runExport([extensionTask('unknown')]);
    const original = structuredClone(pending.list());
    await sync.retryTask('unknown');
    expect(pending.list()).toEqual(original);
    await sync.runExport([extensionTask('unknown')]);
    expect(createTimeEntry).toHaveBeenCalledTimes(2);
    expect(sync.progress.value.unknown).toBe('uncertain');
  });

  it('does not dispatch if reservation storage fails and always releases isRunning', async () => {
    const pending = memoryPendingCreates();
    vi.spyOn(pending, 'transaction').mockRejectedValue(new ExportRecoveryStorageError());
    const createTimeEntry = vi.fn();
    const sync = useSyncExport({
      createTimeEntry,
      finalizeExport: vi.fn(),
      pendingCreates: pending,
    });
    await sync.runExport([extensionTask('storage')]);
    expect(createTimeEntry).not.toHaveBeenCalled();
    expect(sync.outcomes.value.storage?.messageKey).toBe('error.exportRecoveryUnavailable');
    expect(sync.isRunning.value).toBe(false);
  });

  it('keeps the received ID in memory when persistence fails', async () => {
    const pending = memoryPendingCreates();
    const transaction = pending.transaction;
    const createTimeEntry = vi.fn().mockImplementation(async () => {
      vi.spyOn(pending, 'transaction').mockRejectedValue(new ExportRecoveryStorageError());
      return { remoteLogId: 'never-lose' };
    });
    const finalizeExport = vi
      .fn()
      .mockResolvedValue({ remoteLogId: 'never-lose', exportId: 'saved' });
    const sync = useSyncExport({ createTimeEntry, finalizeExport, pendingCreates: pending });
    await sync.runExport([extensionTask('storage')]);
    expect(sync.outcomes.value.storage?.remoteLogId).toBe('never-lose');
    expect(pending.list()[0]?.recovery?.status).toBe('unknown');
    expect(finalizeExport).not.toHaveBeenCalled();
    pending.transaction = transaction;
    await sync.runExport([{ ...extensionTask('storage'), durationSeconds: 60 }]);
    expect(createTimeEntry).toHaveBeenCalledTimes(1);
    expect(finalizeExport).toHaveBeenCalledWith(
      expect.objectContaining({ remoteLogId: 'never-lose', exportDurationSeconds: 3600 }),
    );
    expect(pending.list()).toEqual([]);
  });

  it.each(['onTaskFinalized', 'refresh'] as const)(
    'releases isRunning when %s rejects without changing success',
    async (callback) => {
      const pending = memoryPendingCreates();
      const sync = useSyncExport({
        createTimeEntry: vi.fn().mockResolvedValue({ remoteLogId: 'saved' }),
        finalizeExport: vi.fn().mockResolvedValue({ remoteLogId: 'saved', exportId: 'saved' }),
        pendingCreates: pending,
        [callback]: async () => {
          throw new Error('callback failed');
        },
      });
      await expect(sync.runExport([extensionTask('callback')])).rejects.toThrow('callback failed');
      expect(sync.isRunning.value).toBe(false);
      expect(sync.outcomes.value.callback?.status).toBe('success');
      expect(pending.list()).toEqual([]);
    },
  );

  it('releases isRunning when retry confirmation rejects and retains UNKNOWN', async () => {
    const pending = memoryPendingCreates();
    const sync = useSyncExport({
      createTimeEntry: vi
        .fn()
        .mockRejectedValue(
          new ExtensionProtocolError('unknown-create', 'error.extensionUnknownCreate'),
        ),
      finalizeExport: vi.fn(),
      pendingCreates: pending,
      confirmUnknownCreateRetry: async () => {
        throw new Error('confirmation failed');
      },
    });
    await sync.runExport([extensionTask('callback')]);
    await expect(sync.retryTask('callback')).rejects.toThrow('confirmation failed');
    expect(sync.isRunning.value).toBe(false);
    expect(pending.list()).toHaveLength(1);
  });

  it('validates reconciliation using the stored destination and payload before finalizing', async () => {
    const pending = memoryPendingCreates();
    const createTimeEntry = vi
      .fn()
      .mockRejectedValue(
        new ExtensionProtocolError('unknown-create', 'error.extensionUnknownCreate'),
      );
    const finalizeExport = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue({ remoteLogId: 'existing', exportId: 'saved' });
    const original = { ...extensionTask('reconcile'), comment: 'original' };
    await useSyncExport({ createTimeEntry, finalizeExport, pendingCreates: pending }).runExport([
      original,
    ]);
    const validateExistingRemoteLog = vi.fn().mockImplementation(async () => {
      expect(pending.list()[0]?.recovery?.status).toBe('unknown');
    });
    const reloaded = useSyncExport({
      createTimeEntry,
      finalizeExport,
      pendingCreates: pending,
      validateExistingRemoteLog,
    });
    await reloaded.runExport([
      {
        ...original,
        config: { ...config, baseUrl: 'https://changed.example' },
        durationSeconds: 60,
        activityId: 'edited',
        remoteIssueId: 'edited',
        comment: 'edited',
        entryIds: ['edited'],
      },
    ]);
    await reloaded.reconcileTask('reconcile', 'existing');
    expect(validateExistingRemoteLog).toHaveBeenCalledWith(
      expect.objectContaining(original),
      'existing',
    );
    expect(pending.list()[0]?.recovery).toMatchObject({ status: 'known', remoteLogId: 'existing' });
    await reloaded.retryTask('reconcile');
    expect(finalizeExport.mock.calls[1]?.[0]).toEqual(finalizeExport.mock.calls[0]?.[0]);
    expect(createTimeEntry).toHaveBeenCalledTimes(1);
    expect(validateExistingRemoteLog).toHaveBeenCalledTimes(1);
    expect(pending.list()).toEqual([]);
  });

  it('leaves UNKNOWN untouched when reconciliation has no validator', async () => {
    const pending = memoryPendingCreates();
    const createTimeEntry = vi
      .fn()
      .mockRejectedValue(
        new ExtensionProtocolError('unknown-create', 'error.extensionUnknownCreate'),
      );
    const finalizeExport = vi.fn();
    const sync = useSyncExport({ createTimeEntry, finalizeExport, pendingCreates: pending });
    await sync.runExport([extensionTask('reconcile')]);
    const original = structuredClone(pending.list());
    await sync.reconcileTask('reconcile', 'existing');
    expect(pending.list()).toEqual(original);
    expect(finalizeExport).not.toHaveBeenCalled();
    expect(createTimeEntry).toHaveBeenCalledTimes(1);
    expect(sync.outcomes.value.reconcile?.messageKey).toBe('error.exportRecoveryUnavailable');
    expect(sync.isRunning.value).toBe(false);
  });

  it('leaves UNKNOWN untouched when reconciliation validation rejects', async () => {
    const pending = memoryPendingCreates();
    const finalizeExport = vi.fn();
    const sync = useSyncExport({
      createTimeEntry: vi
        .fn()
        .mockRejectedValue(
          new ExtensionProtocolError('unknown-create', 'error.extensionUnknownCreate'),
        ),
      finalizeExport,
      pendingCreates: pending,
      validateExistingRemoteLog: async () => {
        throw new Error('mismatch');
      },
    });
    await sync.runExport([extensionTask('reconcile')]);
    const original = structuredClone(pending.list());
    await expect(sync.reconcileTask('reconcile', 'wrong')).rejects.toThrow('mismatch');
    expect(pending.list()).toEqual(original);
    expect(finalizeExport).not.toHaveBeenCalled();
    expect(sync.isRunning.value).toBe(false);
  });

  it('atomically reserves overlapping exports from two composables', async () => {
    const pending = memoryPendingCreates();
    const gate = Promise.withResolvers<{ remoteLogId: string }>();
    const createTimeEntry = vi.fn().mockReturnValue(gate.promise);
    const finalizeExport = vi.fn().mockResolvedValue({ remoteLogId: 'one', exportId: 'saved' });
    const first = useSyncExport({ createTimeEntry, finalizeExport, pendingCreates: pending });
    const second = useSyncExport({ createTimeEntry, finalizeExport, pendingCreates: pending });
    const runs = [
      first.runExport([extensionTask('first')]),
      second.runExport([extensionTask('second')]),
    ];
    await vi.waitFor(() => expect(createTimeEntry).toHaveBeenCalledTimes(1));
    gate.resolve({ remoteLogId: 'one' });
    await Promise.all(runs);
    expect(createTimeEntry).toHaveBeenCalledTimes(1);
    expect(finalizeExport).toHaveBeenCalledTimes(1);
    expect(second.progress.value.second).toBe('uncertain');
  });
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

  it('retains the known ID and original payload across runExport after edits', async () => {
    const createTimeEntry = vi
      .fn()
      .mockResolvedValueOnce({ remoteLogId: 'old-log' })
      .mockResolvedValueOnce({ remoteLogId: 'new-log' });
    const finalizeExport = vi
      .fn()
      .mockRejectedValueOnce(new Error('db down'))
      .mockResolvedValueOnce({ remoteLogId: 'old-log', exportId: 'exp-2' });
    const { runExport, outcomes, progress } = useSyncExport({
      createTimeEntry,
      finalizeExport,
    });

    await runExport([taskInput('task-reuse', { entryIds: ['e1'] })]);
    expect(outcomes.value['task-reuse']?.status).toBe('uncertain_finalization');
    expect(progress.value['task-reuse']).toBe('uncertain');
    expect(createTimeEntry).toHaveBeenCalledTimes(1);

    await runExport([
      taskInput('task-reuse', { entryIds: ['e2'], durationSeconds: 900, comment: 'edited' }),
    ]);
    expect(createTimeEntry).toHaveBeenCalledTimes(1);
    expect(finalizeExport).toHaveBeenCalledTimes(2);
    expect(finalizeExport.mock.calls[1]?.[0]).toEqual(finalizeExport.mock.calls[0]?.[0]);
    expect(outcomes.value['task-reuse']?.status).toBe('success');
    expect(progress.value['task-reuse']).toBe('done');
  });

  it('does not mark a report-phase retry as queued before the attempt starts', async () => {
    let resolveFinalize!: (value: { remoteLogId: string; exportId: string }) => void;
    const finalizeGate = new Promise<{ remoteLogId: string; exportId: string }>((resolve) => {
      resolveFinalize = resolve;
    });
    const createTimeEntry = vi.fn().mockResolvedValue({ remoteLogId: 'retry-log' });
    const finalizeExport = vi
      .fn()
      .mockRejectedValueOnce(new Error('db down'))
      .mockImplementationOnce(() => finalizeGate);
    const { runExport, retryTask, progress } = useSyncExport({
      createTimeEntry,
      finalizeExport,
    });

    await runExport([taskInput('task-retry', { entryIds: ['e-r'] })]);
    expect(progress.value['task-retry']).toBe('uncertain');

    const retryPromise = retryTask('task-retry');
    await Promise.resolve();
    expect(progress.value['task-retry']).not.toBe('queued');
    expect(['creating', 'finalizing']).toContain(progress.value['task-retry']);

    resolveFinalize({ remoteLogId: 'retry-log', exportId: 'exp-r' });
    await retryPromise;
    expect(progress.value['task-retry']).toBe('done');
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

  it('treats unknown-create as uncertain and does not recreate until confirmed', async () => {
    const pending = memoryPendingCreates();
    const createTimeEntry = vi
      .fn()
      .mockRejectedValueOnce(
        new ExtensionProtocolError('unknown-create', 'error.extensionUnknownCreate'),
      )
      .mockResolvedValueOnce({ remoteLogId: 'after-confirm' });
    const finalizeExport = vi.fn().mockResolvedValue({
      remoteLogId: 'after-confirm',
      exportId: 'exp-u',
    });
    const confirmUnknownCreateRetry = vi
      .fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const { runExport, retryTask, outcomes, progress } = useSyncExport({
      createTimeEntry,
      finalizeExport,
      pendingCreates: pending,
      confirmUnknownCreateRetry,
    });

    await runExport([extensionTask('task-ext')]);
    expect(progress.value['task-ext']).toBe('uncertain');
    expect(outcomes.value['task-ext']?.status).toBe('remote_failure');
    expect(outcomes.value['task-ext']?.remoteLogId).toBeUndefined();
    expect(outcomes.value['task-ext']?.messageKey).toBe('error.extensionUnknownCreate');
    expect(pending.list()).toHaveLength(1);
    expect(JSON.stringify(pending.list())).not.toContain('secret');

    await retryTask('task-ext');
    expect(confirmUnknownCreateRetry).toHaveBeenCalledTimes(1);
    expect(createTimeEntry).toHaveBeenCalledTimes(1);

    await retryTask('task-ext');
    expect(createTimeEntry).toHaveBeenCalledTimes(2);
    expect(progress.value['task-ext']).toBe('done');
    expect(pending.list()).toHaveLength(1);
  });

  it('does not dispatch create when a pending marker survives reload, and drops markers on definite pre-dispatch failure', async () => {
    const pending = memoryPendingCreates();
    const key = buildExportRequestKey({
      taskId: 'task-reload',
      localDate: '2026-03-15',
      entryIds: ['e1'],
      exportDurationSeconds: 3600,
    });
    pending.add({
      trackerId: extensionConfig.id,
      taskId: 'task-reload',
      spentOn: '2026-03-15',
      exportRequestKey: key,
    });
    const createTimeEntry = vi.fn();
    const finalizeExport = vi.fn();
    const first = useSyncExport({
      createTimeEntry,
      finalizeExport,
      pendingCreates: pending,
    });
    await first.runExport([extensionTask('task-reload')]);
    expect(createTimeEntry).not.toHaveBeenCalled();
    expect(first.progress.value['task-reload']).toBe('uncertain');

    const failCreate = vi
      .fn()
      .mockRejectedValueOnce(
        new ExtensionProtocolError('unavailable', 'error.extensionUnavailable'),
      );
    const failPending = memoryPendingCreates();
    const { runExport, progress } = useSyncExport({
      createTimeEntry: failCreate,
      finalizeExport,
      pendingCreates: failPending,
    });
    await runExport([extensionTask('task-fail')]);
    expect(progress.value['task-fail']).toBe('failed');
    expect(failPending.list()).toHaveLength(0);
  });

  it.each([
    { name: 'duration edit', task: { ...extensionTask('task-ext'), durationSeconds: 1800 } },
    { name: 'selection edit', task: extensionTask('task-ext', ['e2']) },
    { name: 'client mode', task: taskInput('task-ext') },
    {
      name: 'server mode',
      task: { ...taskInput('task-ext'), config: { ...config, executionMode: 'server' as const } },
    },
    {
      name: 'reassigned overlapping entry',
      task: taskInput('task-moved', { spentOn: '2026-03-16' }),
    },
  ])('blocks $name after an unknown create, including after reload', async ({ task }) => {
    const pending = memoryPendingCreates();
    const createTimeEntry = vi
      .fn()
      .mockRejectedValueOnce(
        new ExtensionProtocolError('unknown-create', 'error.extensionUnknownCreate'),
      )
      .mockResolvedValue({ remoteLogId: 'confirmed' });
    const finalizeExport = vi.fn().mockResolvedValue({ remoteLogId: 'confirmed', exportId: 'exp' });
    const confirmUnknownCreateRetry = vi
      .fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    await useSyncExport({ createTimeEntry, finalizeExport, pendingCreates: pending }).runExport([
      extensionTask('task-ext'),
    ]);
    const reloaded = useSyncExport({
      createTimeEntry,
      finalizeExport,
      pendingCreates: pending,
      confirmUnknownCreateRetry,
    });
    await reloaded.runExport([task]);
    expect(createTimeEntry).toHaveBeenCalledTimes(1);
    expect(finalizeExport).not.toHaveBeenCalled();
    expect(reloaded.progress.value[task.row.taskId]).toBe('uncertain');
    await reloaded.retryTask(task.row.taskId);
    expect(confirmUnknownCreateRetry).toHaveBeenCalledTimes(1);
    expect(createTimeEntry).toHaveBeenCalledTimes(1);
    expect(pending.list()).toHaveLength(1);
    await reloaded.retryTask(task.row.taskId);
    expect(createTimeEntry).toHaveBeenCalledTimes(2);
    expect(finalizeExport).toHaveBeenCalledTimes(1);
    expect(pending.list()).toHaveLength(1);
  });

  it('blocks edited exports with legacy markers but leaves unrelated markers alone', async () => {
    const pending = memoryPendingCreates();
    pending.add({
      trackerId: config.id,
      taskId: 'task-ext',
      spentOn: '2026-03-15',
      exportRequestKey: 'legacy',
    });
    pending.add({
      trackerId: 'other',
      taskId: 'task-ext',
      spentOn: '2026-03-15',
      exportRequestKey: 'unrelated',
    });
    const createTimeEntry = vi.fn().mockResolvedValue({ remoteLogId: 'confirmed' });
    const finalizeExport = vi.fn().mockResolvedValue({ remoteLogId: 'confirmed', exportId: 'exp' });
    const sync = useSyncExport({
      createTimeEntry,
      finalizeExport,
      pendingCreates: pending,
      confirmUnknownCreateRetry: async () => true,
    });
    await sync.runExport([taskInput('task-ext', { durationSeconds: 1800, entryIds: ['changed'] })]);
    expect(createTimeEntry).not.toHaveBeenCalled();
    await sync.retryTask('task-ext');
    expect(createTimeEntry).toHaveBeenCalledTimes(1);
    expect(pending.list().map((marker) => marker.exportRequestKey)).toEqual([
      'legacy',
      'unrelated',
    ]);
  });

  it('retries known-ID finalization without repeating create', async () => {
    const pending = memoryPendingCreates();
    const confirmUnknownCreateRetry = vi.fn();
    const createTimeEntry = vi.fn().mockResolvedValue({ remoteLogId: 'keep-me' });
    const finalizeExport = vi
      .fn()
      .mockRejectedValueOnce(new Error('db down'))
      .mockResolvedValueOnce({ remoteLogId: 'keep-me', exportId: 'exp-1' });
    const { runExport, retryTask } = useSyncExport({
      createTimeEntry,
      finalizeExport,
      pendingCreates: pending,
      confirmUnknownCreateRetry,
    });
    await runExport([{ ...taskInput('task-u', { entryIds: ['e-u'] }), config: extensionConfig }]);
    expect(createTimeEntry).toHaveBeenCalledTimes(1);
    expect(pending.list()).toHaveLength(1);
    await retryTask('task-u');
    expect(createTimeEntry).toHaveBeenCalledTimes(1);
    expect(finalizeExport).toHaveBeenCalledTimes(2);
    expect(finalizeExport.mock.calls[1]?.[0]?.remoteLogId).toBe('keep-me');
    expect(confirmUnknownCreateRetry).not.toHaveBeenCalled();
  });
});
