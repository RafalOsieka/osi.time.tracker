import { computed, ref } from 'vue';
import { ExtensionProtocolError, isUnknownCreateError } from '@osi/extension-protocol';
import type {
  FinalizeRemoteExportResultDto,
  RemoteExportTaskOutcomeDto,
} from '../../shared/types/remote-export';
import type { RemoteSyncDayRowDto } from '../../shared/types/remote-sync-day';
import type { TrackerDto } from '../../shared/types/tracker';
import type { ExportOutcomesByTask, ExportProgressByTask } from '~/types/sync-ui-maps';
import { buildExportRequestKey } from '~~/shared/utils/export-request-key';
import { resolveExportComment } from '~~/shared/utils/export-comment';
import { extractCaughtMessageKey } from '~/utils/extract-message-key';
import {
  createPendingCreateStore,
  ExportRecoveryStorageError,
  pendingCreateIdentity,
  recoveryTrackerSchema,
  type ExportRecoveryPayload,
  type PendingCreateMarker,
  type PendingCreateStore,
} from '~/utils/remote/pending-creates';

export type SyncExportProgressStatus =
  | 'queued'
  | 'creating'
  | 'finalizing'
  | 'done'
  | 'failed'
  | 'uncertain'
  | 'not_attempted';

export interface SyncExportTaskInput {
  row: RemoteSyncDayRowDto;
  config: TrackerDto;
  remoteIssueId: string;
  activityId: string;
  durationSeconds: number;
  entryIds: string[];
  spentOn: string;
  /** Reviewed free-text comment; empty falls back to the task name. */
  comment?: string;
}

export interface FinalizeExportBody extends ExportRecoveryPayload {
  remoteLogId: string;
}

/**
 * Batch export orchestration with per-task progress and outcomes (REQ-120 / REQ-229–233).
 */
export function useSyncExport(options: {
  createTimeEntry: (
    config: TrackerDto,
    input: {
      remoteIssueId: string;
      spentOn: string;
      durationSeconds: number;
      activityId: string;
      comment?: string;
    },
  ) => Promise<{ remoteLogId: string }>;
  finalizeExport: (body: FinalizeExportBody) => Promise<FinalizeRemoteExportResultDto>;
  onTaskFinalized?: (row: RemoteSyncDayRowDto) => Promise<void> | void;
  refresh?: () => Promise<void> | void;
  pendingCreates?: PendingCreateStore;
  confirmUnknownCreateRetry?: () => Promise<boolean>;
  validateExistingRemoteLog?: (task: SyncExportTaskInput, remoteLogId: string) => Promise<void>;
}) {
  const pendingCreates = options.pendingCreates ?? createPendingCreateStore();
  const outcomes = ref<ExportOutcomesByTask<RemoteExportTaskOutcomeDto>>({});
  const progress = ref<ExportProgressByTask<SyncExportProgressStatus>>({});
  const isRunning = ref(false);
  const stopRequested = ref(false);
  const totalCount = ref(0);
  const lastBatch = ref<SyncExportTaskInput[]>([]);
  // Retain a received ID even when persisting it fails. Never clear this at batch boundaries.
  const receivedCreates = new Map<string, PendingCreateMarker>();

  const completedCount = computed(() => {
    let count = 0;
    for (const status of Object.values(progress.value)) {
      if (
        status === 'done' ||
        status === 'failed' ||
        status === 'uncertain' ||
        status === 'not_attempted'
      ) {
        count += 1;
      }
    }
    return count;
  });

  function setProgress(taskId: string, status: SyncExportProgressStatus) {
    progress.value = { ...progress.value, [taskId]: status };
  }

  function setOutcome(outcome: RemoteExportTaskOutcomeDto) {
    outcomes.value = { ...outcomes.value, [outcome.taskId]: outcome };
  }

  function requestStop() {
    if (isRunning.value) {
      stopRequested.value = true;
    }
  }

  function buildKey(task: SyncExportTaskInput): string {
    return buildExportRequestKey({
      taskId: task.row.taskId,
      localDate: task.spentOn,
      entryIds: task.entryIds,
      exportDurationSeconds: task.durationSeconds,
    });
  }

  function matchesTask(marker: PendingCreateMarker, task: SyncExportTaskInput) {
    return (
      marker.trackerId === task.config.id &&
      ((marker.taskId === task.row.taskId &&
        (marker.spentOn === task.spentOn || marker.recovery?.status === 'known')) ||
        marker.entryIds?.some((id) => task.entryIds.includes(id)))
    );
  }

  function reportRecoveryFailure(taskId: string, messageKey: string, remoteLogId?: string) {
    setProgress(taskId, 'uncertain');
    setOutcome({
      taskId,
      status: remoteLogId ? 'uncertain_finalization' : 'remote_failure',
      remoteLogId,
      messageKey,
    });
  }

  async function saveMarker(marker: PendingCreateMarker) {
    return await pendingCreates.transaction((markers) => {
      const index = markers.findIndex(
        (item) => pendingCreateIdentity(item) === pendingCreateIdentity(marker),
      );
      const existing = markers[index]?.recovery;
      const incoming = marker.recovery;
      // A late create reply can disagree with a log selected in another tab. Keep both IDs.
      if (
        existing?.status === 'known' &&
        incoming?.status === 'known' &&
        existing.remoteLogId !== incoming.remoteLogId
      ) {
        const separate: PendingCreateMarker = {
          ...marker,
          recovery: { ...incoming, attemptId: crypto.randomUUID() },
        };
        markers.push(separate);
        return separate;
      }
      if (index < 0) markers.push(marker);
      else markers[index] = marker;
      return marker;
    });
  }

  async function removeMarker(marker: PendingCreateMarker) {
    await pendingCreates.transaction((markers) => {
      const index = markers.findIndex(
        (item) => pendingCreateIdentity(item) === pendingCreateIdentity(marker),
      );
      const existing = markers[index]?.recovery;
      const expected = marker.recovery;
      if (
        index >= 0 &&
        (existing?.status !== 'known' ||
          (expected?.status === 'known' && existing.remoteLogId === expected.remoteLogId))
      ) {
        markers.splice(index, 1);
      }
    });
    receivedCreates.delete(pendingCreateIdentity(marker));
  }

  async function finalizeMarker(task: SyncExportTaskInput, marker: PendingCreateMarker) {
    const recovery = marker.recovery;
    if (recovery?.status !== 'known') return;
    const { remoteLogId, payload } = recovery;
    const taskId = task.row.taskId;
    setProgress(taskId, 'finalizing');
    let finalized: FinalizeRemoteExportResultDto;
    try {
      const saved = await saveMarker(marker);
      receivedCreates.delete(pendingCreateIdentity(marker));
      receivedCreates.set(pendingCreateIdentity(saved), saved);
      marker = saved;
      finalized = await options.finalizeExport({ ...payload, remoteLogId });
      if (finalized.remoteLogId !== remoteLogId) {
        throw new Error('Finalization returned a different remote log');
      }
      await removeMarker(marker);
    } catch (err) {
      reportRecoveryFailure(
        taskId,
        err instanceof ExportRecoveryStorageError ? err.messageKey : 'remoteSync.outcomeUncertain',
        remoteLogId,
      );
      await options.onTaskFinalized?.(task.row);
      return;
    }
    setProgress(taskId, 'done');
    setOutcome({
      taskId,
      status: 'success',
      remoteLogId: finalized.remoteLogId,
      exportId: finalized.exportId,
      messageKey: 'remoteSync.outcomeSuccess',
      messageParams: { remoteLogId: finalized.remoteLogId },
    });
    // Notification failures must not turn a successfully finalized export into a retry.
    await options.onTaskFinalized?.(task.row);
  }

  async function runSingleTask(
    task: SyncExportTaskInput,
    allowedAttempts: string[] = [],
  ): Promise<void> {
    const { row, config, remoteIssueId, activityId, durationSeconds, entryIds, spentOn } = task;
    const comment = resolveExportComment(task.comment, row.taskName);
    const logicalKey = buildKey(task);
    const received = [...receivedCreates.values()].find((marker) => matchesTask(marker, task));
    if (received) {
      await finalizeMarker(task, received);
      return;
    }
    let reservation: { marker: PendingCreateMarker; create: boolean };
    try {
      reservation = await pendingCreates.transaction((markers) => {
        const matching = markers.filter((marker) => matchesTask(marker, task));
        const known = matching.find((marker) => marker.recovery?.status === 'known');
        const blocking =
          known ??
          matching.find((marker) => !allowedAttempts.includes(pendingCreateIdentity(marker)));
        if (blocking) return { marker: blocking, create: false };
        const attemptId = crypto.randomUUID();
        // A confirmed new create is not an idempotent replay of the older UNKNOWN attempt.
        const exportRequestKey = allowedAttempts.length > 0 ? `er2|${attemptId}` : logicalKey;
        const marker: PendingCreateMarker = {
          trackerId: config.id,
          taskId: row.taskId,
          spentOn,
          exportRequestKey,
          entryIds: [...entryIds],
          recovery: {
            attemptId,
            status: 'unknown',
            config: recoveryTrackerSchema.parse(config),
            payload: {
              taskId: row.taskId,
              localDate: spentOn,
              remoteIssueId,
              exportDurationSeconds: durationSeconds,
              requiredFieldValues: { activity: activityId },
              entryIds: [...entryIds],
              exportRequestKey,
              comment,
            },
          },
        };
        markers.push(marker);
        return { marker, create: true };
      });
    } catch {
      reportRecoveryFailure(row.taskId, 'error.exportRecoveryUnavailable');
      return;
    }
    const { marker } = reservation;
    if (!reservation.create) {
      if (marker.recovery?.status === 'known') await finalizeMarker(task, marker);
      else reportRecoveryFailure(row.taskId, 'error.extensionUnknownCreate');
      return;
    }
    setProgress(row.taskId, 'creating');
    const recovery = marker.recovery;
    if (!recovery) return;
    const { payload } = recovery;
    let remoteLogId: string;
    try {
      const created = await options.createTimeEntry(recovery.config, {
        remoteIssueId: payload.remoteIssueId,
        spentOn: payload.localDate,
        durationSeconds: payload.exportDurationSeconds,
        activityId: payload.requiredFieldValues.activity,
        comment: payload.comment,
      });
      remoteLogId = created.remoteLogId;
    } catch (err) {
      if (err instanceof ExtensionProtocolError && isUnknownCreateError(err)) {
        reportRecoveryFailure(row.taskId, err.messageKey);
        return;
      }
      try {
        await removeMarker(marker);
      } catch {
        reportRecoveryFailure(row.taskId, 'error.exportRecoveryUnavailable');
        return;
      }
      setProgress(row.taskId, 'failed');
      setOutcome({
        taskId: row.taskId,
        status: 'remote_failure',
        messageKey: extractCaughtMessageKey(err, 'remoteSync.outcomeRemoteFailure'),
      });
      return;
    }
    const known: PendingCreateMarker = {
      ...marker,
      recovery: { ...recovery, status: 'known', remoteLogId },
    };
    receivedCreates.set(pendingCreateIdentity(known), known);
    await finalizeMarker(task, known);
  }

  async function runExport(tasks: SyncExportTaskInput[]): Promise<void> {
    if (isRunning.value) return;
    isRunning.value = true;
    stopRequested.value = false;
    lastBatch.value = tasks;
    totalCount.value = tasks.length;
    outcomes.value = {};

    const initialProgress: Record<string, SyncExportProgressStatus> = {};
    for (const task of tasks) {
      initialProgress[task.row.taskId] = 'queued';
    }
    progress.value = initialProgress;

    try {
      for (const task of tasks) {
        if (stopRequested.value) {
          setProgress(task.row.taskId, 'not_attempted');
          setOutcome({
            taskId: task.row.taskId,
            status: 'excluded',
            messageKey: 'remoteSync.exportNotAttempted',
          });
          continue;
        }
        await runSingleTask(task);
      }

      await options.refresh?.();
    } finally {
      isRunning.value = false;
      stopRequested.value = false;
    }
  }

  async function retryTask(taskId: string): Promise<void> {
    const task = lastBatch.value.find((candidate) => candidate.row.taskId === taskId);
    if (!task || isRunning.value) return;

    isRunning.value = true;
    stopRequested.value = false;
    try {
      let unresolvedCreates: PendingCreateMarker[];
      try {
        unresolvedCreates = pendingCreates.list().filter((marker) => matchesTask(marker, task));
      } catch {
        reportRecoveryFailure(taskId, 'error.exportRecoveryUnavailable');
        return;
      }
      const received = [...receivedCreates.values()].some((marker) => matchesTask(marker, task));
      const known = unresolvedCreates.some((marker) => marker.recovery?.status === 'known');
      let allowedAttempts: string[] = [];
      if (!received && !known && unresolvedCreates.length > 0) {
        if (!(await options.confirmUnknownCreateRetry?.())) return;
        // Confirmation authorizes a new attempt, not deletion of an earlier uncertain create.
        allowedAttempts = unresolvedCreates.map(pendingCreateIdentity);
      }
      await runSingleTask(task, allowedAttempts);
      await options.refresh?.();
    } finally {
      isRunning.value = false;
      stopRequested.value = false;
    }
  }

  /** Validate an existing remote log against the original attempt before recording its ID. */
  async function reconcileTask(taskId: string, remoteLogId: string): Promise<void> {
    const task = lastBatch.value.find((candidate) => candidate.row.taskId === taskId);
    if (!task || isRunning.value) return;
    isRunning.value = true;
    try {
      if (!options.validateExistingRemoteLog) {
        reportRecoveryFailure(taskId, 'error.exportRecoveryUnavailable');
        return;
      }
      const marker = pendingCreates.list().find((candidate) => matchesTask(candidate, task));
      const recovery = marker?.recovery;
      if (!marker || !recovery || recovery.status !== 'unknown' || !remoteLogId.trim()) {
        reportRecoveryFailure(taskId, 'error.extensionUnknownCreate');
        return;
      }
      const { payload } = recovery;
      await options.validateExistingRemoteLog(
        {
          ...task,
          config: recovery.config,
          row: { ...task.row, taskId: payload.taskId },
          remoteIssueId: payload.remoteIssueId,
          activityId: payload.requiredFieldValues.activity,
          durationSeconds: payload.exportDurationSeconds,
          entryIds: [...payload.entryIds],
          spentOn: payload.localDate,
          comment: payload.comment,
        },
        remoteLogId.trim(),
      );
      const known: PendingCreateMarker = {
        ...marker,
        recovery: { ...recovery, status: 'known', remoteLogId: remoteLogId.trim() },
      };
      // Recheck after validation: a different tab may have reconciled this attempt meanwhile.
      const accepted = await pendingCreates.transaction((markers) => {
        const index = markers.findIndex(
          (item) => pendingCreateIdentity(item) === recovery.attemptId,
        );
        if (index < 0 || markers[index]?.recovery?.status !== 'unknown') return false;
        markers[index] = known;
        receivedCreates.set(recovery.attemptId, known);
        return true;
      });
      if (!accepted) {
        reportRecoveryFailure(taskId, 'error.extensionUnknownCreate');
        return;
      }
      await finalizeMarker(task, known);
      await options.refresh?.();
    } catch (err) {
      if (!(err instanceof ExportRecoveryStorageError)) throw err;
      reportRecoveryFailure(taskId, err.messageKey);
    } finally {
      isRunning.value = false;
      stopRequested.value = false;
    }
  }

  return {
    outcomes,
    progress,
    isRunning,
    completedCount,
    totalCount,
    runExport,
    requestStop,
    retryTask,
    reconcileTask,
  };
}
