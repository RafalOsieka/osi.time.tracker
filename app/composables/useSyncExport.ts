import { ref, type Ref } from 'vue';
import type {
  FinalizeRemoteExportResultDto,
  RemoteExportTaskOutcomeDto,
} from '../../shared/types/remote-export';
import type { RemoteSyncDayRowDto } from '../../shared/types/remote-sync-day';
import type { RemoteSystemConfigDto } from '../../shared/types/remote-system-config';
import { mapRemoteSyncClientError } from './useRemoteSyncClient';

export interface SyncExportTaskInput {
  row: RemoteSyncDayRowDto;
  config: RemoteSystemConfigDto;
  remoteIssueId: string;
  activityId: string;
  durationSeconds: number;
  entryIds: string[];
  spentOn: string;
}

/**
 * Batch export orchestration with per-task outcomes (REQ-120).
 */
export function useSyncExport(options: {
  createTimeEntry: (
    config: RemoteSystemConfigDto,
    input: {
      remoteIssueId: string;
      spentOn: string;
      durationSeconds: number;
      activityId: string;
      comment?: string;
    },
  ) => Promise<{ remoteLogId: string }>;
  finalizeExport: (body: {
    taskId: string;
    localDate: string;
    remoteIssueId: string;
    remoteLogId: string;
    exportDurationSeconds: number;
    requiredFieldValues: { activity: string };
    entryIds: string[];
  }) => Promise<FinalizeRemoteExportResultDto>;
  onTaskFinalized?: (row: RemoteSyncDayRowDto) => Promise<void> | void;
  refresh?: () => Promise<void> | void;
}) {
  const outcomes = ref<Record<string, RemoteExportTaskOutcomeDto>>({}) as Ref<
    Record<string, RemoteExportTaskOutcomeDto>
  >;
  const isRunning = ref(false);

  async function runExport(tasks: SyncExportTaskInput[]): Promise<void> {
    isRunning.value = true;
    const nextOutcomes = { ...outcomes.value };

    for (const task of tasks) {
      const { row, config, remoteIssueId, activityId, durationSeconds, entryIds, spentOn } = task;

      let remoteLogId: string | undefined;
      try {
        const created = await options.createTimeEntry(config, {
          remoteIssueId,
          spentOn,
          durationSeconds,
          activityId,
          // OpenProject stores the free-text note on the time log as `comment`.
          comment: row.taskName,
        });
        remoteLogId = created.remoteLogId;
      } catch (err: unknown) {
        nextOutcomes[row.taskId] = {
          taskId: row.taskId,
          status: 'remote_failure',
          messageKey: mapRemoteSyncClientError(err, 'remoteSync.outcomeRemoteFailure'),
        };
        continue;
      }

      try {
        const finalized = await options.finalizeExport({
          taskId: row.taskId,
          localDate: spentOn,
          remoteIssueId,
          remoteLogId,
          exportDurationSeconds: durationSeconds,
          requiredFieldValues: { activity: activityId },
          entryIds,
        });
        nextOutcomes[row.taskId] = {
          taskId: row.taskId,
          status: 'success',
          remoteLogId: finalized.remoteLogId,
          exportId: finalized.exportId,
          messageKey: 'remoteSync.outcomeSuccess',
          messageParams: { remoteLogId: finalized.remoteLogId },
        };
        await options.onTaskFinalized?.(row);
      } catch {
        nextOutcomes[row.taskId] = {
          taskId: row.taskId,
          status: 'uncertain_finalization',
          remoteLogId,
          messageKey: 'remoteSync.outcomeUncertain',
        };
        await options.onTaskFinalized?.(row);
      }
    }

    outcomes.value = nextOutcomes;
    isRunning.value = false;
    await options.refresh?.();
  }

  return {
    outcomes,
    isRunning,
    runExport,
  };
}
