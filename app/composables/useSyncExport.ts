import { computed, ref } from 'vue';
import type {
  FinalizeRemoteExportResultDto,
  RemoteExportTaskOutcomeDto,
} from '../../shared/types/remote-export';
import type { RemoteSyncDayRowDto } from '../../shared/types/remote-sync-day';
import type { TrackerDto } from '../../shared/types/tracker';
import type { ExportOutcomesByTask, ExportProgressByTask, TaskId } from '~/types/syncUiMaps';
import { buildExportRequestKey } from '../../shared/utils/export-request-key';
import { resolveExportComment } from '../../shared/utils/export-comment';
import { mapRemoteSyncClientError } from './useRemoteSyncClient';

export type SyncExportProgressStatus =
  'queued' | 'creating' | 'finalizing' | 'done' | 'failed' | 'uncertain' | 'not_attempted';

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

export interface FinalizeExportBody {
  taskId: string;
  localDate: string;
  remoteIssueId: string;
  remoteLogId: string;
  exportDurationSeconds: number;
  requiredFieldValues: { activity: string };
  entryIds: string[];
  exportRequestKey: string;
  comment?: string;
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
}) {
  const outcomes = ref<ExportOutcomesByTask<RemoteExportTaskOutcomeDto>>({});
  const progress = ref<ExportProgressByTask<SyncExportProgressStatus>>({});
  const isRunning = ref(false);
  const stopRequested = ref(false);
  const totalCount = ref(0);
  const lastBatch = ref<SyncExportTaskInput[]>([]);
  /** Known remote log ids from prior attempts (for uncertain retry reconciliation). */
  const knownRemoteLogIds = ref<Record<TaskId, string>>({});

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

  async function runSingleTask(task: SyncExportTaskInput): Promise<void> {
    const { row, config, remoteIssueId, activityId, durationSeconds, entryIds, spentOn } = task;
    const comment = resolveExportComment(task.comment, row.taskName);
    const exportRequestKey = buildKey(task);
    const knownRemoteLogId = knownRemoteLogIds.value[row.taskId];

    let remoteLogId = knownRemoteLogId;

    if (!remoteLogId) {
      setProgress(row.taskId, 'creating');
      try {
        const created = await options.createTimeEntry(config, {
          remoteIssueId,
          spentOn,
          durationSeconds,
          activityId,
          comment,
        });
        remoteLogId = created.remoteLogId;
        knownRemoteLogIds.value = {
          ...knownRemoteLogIds.value,
          [row.taskId]: remoteLogId,
        };
      } catch (err: unknown) {
        setProgress(row.taskId, 'failed');
        setOutcome({
          taskId: row.taskId,
          status: 'remote_failure',
          messageKey: mapRemoteSyncClientError(err, 'remoteSync.outcomeRemoteFailure'),
        });
        return;
      }
    }

    setProgress(row.taskId, 'finalizing');
    try {
      const finalized = await options.finalizeExport({
        taskId: row.taskId,
        localDate: spentOn,
        remoteIssueId,
        remoteLogId,
        exportDurationSeconds: durationSeconds,
        requiredFieldValues: { activity: activityId },
        entryIds,
        exportRequestKey,
        comment,
      });
      setProgress(row.taskId, 'done');
      setOutcome({
        taskId: row.taskId,
        status: 'success',
        remoteLogId: finalized.remoteLogId,
        exportId: finalized.exportId,
        messageKey: 'remoteSync.outcomeSuccess',
        messageParams: { remoteLogId: finalized.remoteLogId },
      });
      await options.onTaskFinalized?.(row);
    } catch {
      setProgress(row.taskId, 'uncertain');
      setOutcome({
        taskId: row.taskId,
        status: 'uncertain_finalization',
        remoteLogId,
        messageKey: 'remoteSync.outcomeUncertain',
      });
      await options.onTaskFinalized?.(row);
    }
  }

  async function runExport(tasks: SyncExportTaskInput[]): Promise<void> {
    isRunning.value = true;
    stopRequested.value = false;
    lastBatch.value = tasks;
    totalCount.value = tasks.length;
    // Fresh batch: never reuse remote log ids / outcomes from a prior export on this page.
    // In-batch uncertain retries keep ids via retryTask only.
    knownRemoteLogIds.value = {};
    outcomes.value = {};

    const initialProgress: Record<string, SyncExportProgressStatus> = {};
    for (const task of tasks) {
      initialProgress[task.row.taskId] = 'queued';
    }
    progress.value = initialProgress;

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

    isRunning.value = false;
    stopRequested.value = false;
    await options.refresh?.();
  }

  async function retryTask(taskId: string): Promise<void> {
    const task = lastBatch.value.find((candidate) => candidate.row.taskId === taskId);
    if (!task || isRunning.value) return;

    isRunning.value = true;
    stopRequested.value = false;
    // Do not flip to `queued` here: report-phase groups only list terminal statuses, so
    // a queued marker would hide the row until the attempt finishes. runSingleTask sets
    // creating/finalizing immediately; the dialog keeps those visible as in-progress.
    await runSingleTask(task);
    isRunning.value = false;
    await options.refresh?.();
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
  };
}
