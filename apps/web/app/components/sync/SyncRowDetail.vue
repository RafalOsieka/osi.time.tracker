<script setup lang="ts">
import { EXTENSION_ERROR_MESSAGE_KEYS } from '@osi/extension-protocol';
import type {
  RemoteSyncDayEntryDto,
  RemoteSyncExportProvenanceDto,
} from '~~/shared/types/remote-sync-day';
import type { RemoteTimeLogDto } from '@osi/remote-trackers/contracts';

const {
  taskId,
  entries,
  exportRecords,
  trackerId,
  showRemoteLogs,
  remoteLogs,
  remoteLogsLoading,
  remoteLogsErrorKey,
  remoteLogsLoaded,
  canReconcile,
  busy,
  formatEntryStart,
  formatEntryStop,
} = defineProps<{
  taskId: string;
  entries: RemoteSyncDayEntryDto[];
  exportRecords: RemoteSyncExportProvenanceDto[];
  trackerId: string | null;
  showRemoteLogs: boolean;
  remoteLogs: RemoteTimeLogDto[];
  remoteLogsLoading: boolean;
  remoteLogsErrorKey: string | null;
  remoteLogsLoaded: boolean;
  canReconcile: boolean;
  busy: boolean;
  formatEntryStart: (iso: string) => string;
  formatEntryStop: (iso: string) => string;
}>();

const emit = defineEmits<{
  retryRemoteLogs: [];
  link: [log: RemoteTimeLogDto];
  delete: [log: RemoteTimeLogDto, exportId: string];
}>();

const { t } = useI18n();
const extensionLogsErrorKey = computed(() =>
  Object.values(EXTENSION_ERROR_MESSAGE_KEYS).find((key) => key === remoteLogsErrorKey),
);

function commentText(log: RemoteTimeLogDto): string {
  const comment = log.comment?.trim();
  return comment && comment.length > 0 ? comment : t('remoteSync.remoteLogNoComment');
}

function linkedExport(log: RemoteTimeLogDto): RemoteSyncExportProvenanceDto | undefined {
  if (!trackerId) return undefined;
  return exportRecords.find(
    (record) => record.trackerId === trackerId && record.remoteLogId === log.remoteLogId,
  );
}

function isLinked(log: RemoteTimeLogDto): boolean {
  return !!linkedExport(log);
}

function emitDelete(log: RemoteTimeLogDto) {
  const record = linkedExport(log);
  if (!record) return;
  emit('delete', log, record.exportId);
}

const hasFinalizedExport = computed(() => exportRecords.length > 0);

function logFromProvenance(record: RemoteSyncExportProvenanceDto): RemoteTimeLogDto {
  return {
    remoteLogId: record.remoteLogId,
    remoteIssueId: record.remoteIssueId,
    spentOn: '',
    durationSeconds: record.exportDurationSeconds,
    activityId: record.requiredFieldValues.activity ?? null,
    activityName: null,
    comment: null,
    remoteUserId: null,
  };
}

/** Local provenance with no matching tracker log still needs Delete (orphan / stale cache). */
const displayedRemoteLogs = computed(() => {
  if (!remoteLogsLoaded || remoteLogsErrorKey) return remoteLogs;
  const known = new Set(remoteLogs.map((log) => log.remoteLogId));
  const missing = exportRecords
    .filter(
      (record) => (!trackerId || record.trackerId === trackerId) && !known.has(record.remoteLogId),
    )
    .map(logFromProvenance);
  return [...remoteLogs, ...missing];
});
</script>

<template>
  <div class="grid gap-4 py-2" :data-testid="`remote-sync-detail-${taskId}`">
    <div class="grid gap-4 lg:grid-cols-2" :class="{ 'lg:grid-cols-1': !showRemoteLogs }">
      <div
        v-if="entries.length > 0"
        class="grid gap-1"
        :data-testid="`remote-sync-entries-${taskId}`"
      >
        <p class="m-0 text-sm font-semibold">{{ t('remoteSync.entriesHeading') }}</p>
        <div
          v-for="entry in entries"
          :key="entry.id"
          class="flex items-center justify-between gap-3 text-sm text-muted"
          :data-testid="`remote-sync-entry-${entry.id}`"
        >
          <span>
            {{
              t('remoteSync.entrySummary', {
                start: formatEntryStart(entry.startedAt),
                stop: formatEntryStop(entry.stoppedAt),
                duration: formatDuration(entry.durationSeconds),
              })
            }}
          </span>
        </div>
      </div>

      <div
        v-if="showRemoteLogs"
        class="grid gap-1"
        :data-testid="`remote-sync-remote-logs-${taskId}`"
      >
        <p class="m-0 text-sm font-semibold">{{ t('remoteSync.remoteLogsHeading') }}</p>
        <span
          v-if="remoteLogsLoading"
          role="status"
          aria-live="polite"
          :data-testid="`remote-sync-remote-logs-loading-${taskId}`"
        >
          {{ t('remoteSync.remoteLogsLoading') }}
        </span>
        <template v-else-if="remoteLogsErrorKey">
          <span role="alert" :data-testid="`remote-sync-remote-logs-error-${taskId}`">
            {{ t(extensionLogsErrorKey ?? 'remoteSync.remoteLogsError') }}
          </span>
          <p v-if="extensionLogsErrorKey" class="text-sm text-muted">
            {{ t('trackers.extensionSetupGuidance') }}
          </p>
          <UButton
            variant="ghost"
            size="xs"
            :label="
              t(
                extensionLogsErrorKey
                  ? 'trackers.extensionRecheckButton'
                  : 'remoteSync.remoteLogsRetry',
              )
            "
            :data-testid="`remote-sync-remote-logs-retry-${taskId}`"
            @click="emit('retryRemoteLogs')"
          />
        </template>
        <p
          v-else-if="remoteLogsLoaded && displayedRemoteLogs.length === 0"
          class="m-0 text-sm text-muted"
          :data-testid="`remote-sync-remote-logs-empty-${taskId}`"
        >
          {{ t('remoteSync.remoteLogsEmpty') }}
        </p>
        <ul v-else-if="displayedRemoteLogs.length > 0" class="m-0 grid gap-2 pl-0">
          <li
            v-for="log in displayedRemoteLogs"
            :key="log.remoteLogId"
            class="grid list-none gap-1"
            :data-testid="`remote-sync-remote-log-${log.remoteLogId}`"
          >
            <div class="flex flex-wrap items-center gap-2">
              <span class="text-sm">
                {{
                  t('remoteSync.remoteLogItem', {
                    duration: formatDuration(log.durationSeconds),
                    activity: log.activityName ?? t('remoteSync.emptyCell'),
                    id: log.remoteLogId,
                  })
                }}
              </span>
              <UBadge
                :color="isLinked(log) ? 'success' : 'neutral'"
                variant="subtle"
                size="sm"
                :label="
                  isLinked(log)
                    ? t('remoteSync.remoteLogLinked')
                    : t('remoteSync.remoteLogUnlinked')
                "
                :data-testid="`remote-sync-remote-log-state-${log.remoteLogId}`"
              />
              <UButton
                v-if="canReconcile && !isLinked(log) && !hasFinalizedExport"
                variant="ghost"
                size="xs"
                :disabled="busy"
                :label="t('remoteSync.linkRemoteEntry')"
                :data-testid="`remote-sync-link-entry-${log.remoteLogId}`"
                @click="emit('link', log)"
              />
              <UButton
                v-if="canReconcile && isLinked(log) && linkedExport(log)"
                color="error"
                variant="ghost"
                size="xs"
                :disabled="busy"
                :label="t('remoteSync.deleteRemoteEntry')"
                :data-testid="`remote-sync-delete-entry-${log.remoteLogId}`"
                @click="emitDelete(log)"
              />
            </div>
            <OverflowTooltip :text="commentText(log)">
              <span
                class="block max-w-prose truncate text-sm text-muted"
                :aria-label="commentText(log)"
                :data-testid="`remote-sync-remote-log-comment-${log.remoteLogId}`"
              >
                {{ commentText(log) }}
              </span>
            </OverflowTooltip>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
