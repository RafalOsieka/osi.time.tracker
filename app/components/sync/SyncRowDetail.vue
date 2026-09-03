<script setup lang="ts">
import type { RemoteSyncDayEntryDto } from '~~/shared/types/remote-sync-day';
import type { RemoteTimeLogDto } from '~~/shared/types/remote-export';

const {
  taskId,
  entries,
  showRemoteLogs,
  remoteLogs,
  remoteLogsLoading,
  remoteLogsErrorKey,
  remoteLogsLoaded,
  duplicateLog,
  duplicateDismissed,
  formatEntryStart,
  formatEntryStop,
} = defineProps<{
  taskId: string;
  entries: RemoteSyncDayEntryDto[];
  showRemoteLogs: boolean;
  remoteLogs: RemoteTimeLogDto[];
  remoteLogsLoading: boolean;
  remoteLogsErrorKey: string | null;
  remoteLogsLoaded: boolean;
  duplicateLog: RemoteTimeLogDto | null;
  duplicateDismissed: boolean;
  formatEntryStart: (iso: string) => string;
  formatEntryStop: (iso: string) => string;
}>();

const emit = defineEmits<{
  retryRemoteLogs: [];
  dismissDuplicate: [];
}>();

const { t } = useI18n();

function commentText(log: RemoteTimeLogDto): string {
  const comment = log.comment?.trim();
  return comment && comment.length > 0 ? comment : t('remoteSync.remoteLogNoComment');
}

function hasRealComment(log: RemoteTimeLogDto): boolean {
  return !!(log.comment && log.comment.trim().length > 0);
}
</script>

<template>
  <div class="grid gap-4 py-2" :data-testid="`remote-sync-detail-${taskId}`">
    <UAlert
      v-if="duplicateLog && !duplicateDismissed"
      color="warning"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      close
      :title="
        t('remoteSync.duplicateWarning', {
          id: duplicateLog.remoteLogId,
          commentPart: hasRealComment(duplicateLog)
            ? t('remoteSync.duplicateWarningComment', { comment: duplicateLog.comment })
            : '',
        })
      "
      :data-testid="`remote-sync-duplicate-warning-${taskId}`"
      @update:open="
        (open: boolean) => {
          if (!open) emit('dismissDuplicate');
        }
      "
    >
      <template #close>
        <UButton
          icon="i-lucide-x"
          color="neutral"
          variant="link"
          size="md"
          square
          :aria-label="t('remoteSync.duplicateWarningDismiss')"
          :data-testid="`remote-sync-duplicate-dismiss-${taskId}`"
          @click="emit('dismissDuplicate')"
        />
      </template>
    </UAlert>

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
            {{ t('remoteSync.remoteLogsError') }}
          </span>
          <UButton
            variant="ghost"
            size="xs"
            :label="t('remoteSync.remoteLogsRetry')"
            :data-testid="`remote-sync-remote-logs-retry-${taskId}`"
            @click="emit('retryRemoteLogs')"
          />
        </template>
        <p
          v-else-if="remoteLogsLoaded && remoteLogs.length === 0"
          class="m-0 text-sm text-muted"
          :data-testid="`remote-sync-remote-logs-empty-${taskId}`"
        >
          {{ t('remoteSync.remoteLogsEmpty') }}
        </p>
        <ul v-else-if="remoteLogs.length > 0" class="m-0 grid gap-2 pl-0">
          <li
            v-for="log in remoteLogs"
            :key="log.remoteLogId"
            class="grid list-none gap-0.5"
            :data-testid="`remote-sync-remote-log-${log.remoteLogId}`"
          >
            <span class="text-sm">
              {{
                t('remoteSync.remoteLogItem', {
                  duration: formatDuration(log.durationSeconds),
                  activity: log.activityName ?? t('remoteSync.emptyCell'),
                  id: log.remoteLogId,
                })
              }}
            </span>
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
