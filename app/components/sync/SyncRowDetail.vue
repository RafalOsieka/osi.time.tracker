<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { RemoteSyncDayEntryDto, RemoteSyncDayRowDto } from '~~/shared/types/remote-sync-day';
import type { RemoteTimeLogDto } from '~~/shared/types/remote-export';
import type { RoundingSuggestion } from '~~/shared/utils/rounding';
import { formatDuration, formatSignedDuration } from '~/utils/formatDuration';

defineProps<{
  row: RemoteSyncDayRowDto;
  entries: RemoteSyncDayEntryDto[];
  canManageEntries: boolean;
  selectedEntryIds: string[];
  trackedSeconds: number;
  toSendSeconds: number;
  deltaSeconds: number;
  roundedInput: string;
  hasOverride: boolean;
  isExcluded: boolean;
  excludedReason: 'none' | 'zero' | null;
  roundingSuggestions: RoundingSuggestion[];
  showRemoteLogs: boolean;
  remoteLogs: RemoteTimeLogDto[];
  remoteLogsLoading: boolean;
  remoteLogsErrorKey: string | null;
  remoteLogsLoaded: boolean;
  duplicateLog: RemoteTimeLogDto | null;
  duplicateDismissed: boolean;
  comment: string;
  formatEntryStart: (iso: string) => string;
}>();

const emit = defineEmits<{
  toggleEntry: [entryId: string, checked: boolean];
  selectAllEntries: [];
  deselectAllEntries: [];
  roundedInput: [value: string | undefined];
  commitRounded: [];
  resetRounded: [];
  applySuggestion: [seconds: number];
  retryRemoteLogs: [];
  dismissDuplicate: [];
  commentInput: [value: string | undefined];
}>();

const { t } = useI18n();

function suggestionLabel(suggestion: RoundingSuggestion): string {
  const duration = formatDuration(suggestion.seconds);
  if (suggestion.kind === 'exact') {
    return t('remoteSync.roundingSuggestionExact', { duration });
  }
  if (suggestion.kind === 'floor') {
    return t('remoteSync.roundingSuggestionFloor', { duration });
  }
  return t('remoteSync.roundingSuggestionCeil', { duration });
}

function commentText(log: RemoteTimeLogDto): string {
  const comment = log.comment?.trim();
  return comment && comment.length > 0 ? comment : t('remoteSync.remoteLogNoComment');
}

function hasRealComment(log: RemoteTimeLogDto): boolean {
  return !!(log.comment && log.comment.trim().length > 0);
}
</script>

<template>
  <div class="grid gap-4 p-3" :data-testid="`remote-sync-detail-${row.taskId}`">
    <div class="flex flex-wrap items-center gap-3 font-mono text-sm">
      <span :data-testid="`remote-sync-original-duration-${row.taskId}`">
        {{ t('remoteSync.originalDurationLabel') }}: {{ formatDuration(row.totalSeconds) }}
      </span>
      <span :data-testid="`remote-sync-selected-duration-${row.taskId}`">
        {{ t('remoteSync.selectedDurationLabel') }}: {{ formatDuration(trackedSeconds) }}
      </span>
      <span :data-testid="`remote-sync-row-delta-detail-${row.taskId}`">
        {{
          t('remoteSync.trackedToSend', {
            tracked: formatDuration(trackedSeconds),
            toSend: formatDuration(toSendSeconds),
          })
        }}
        <span class="text-muted">({{ formatSignedDuration(deltaSeconds) }})</span>
      </span>
    </div>

    <div
      v-if="canManageEntries"
      class="flex flex-wrap items-center gap-3"
      :data-testid="`remote-sync-export-duration-block-${row.taskId}`"
    >
      <label :for="`remote-sync-rounded-${row.taskId}`" class="text-sm text-muted">
        {{ t('remoteSync.roundedDurationLabel') }}
      </label>
      <UInput
        :id="`remote-sync-rounded-${row.taskId}`"
        :model-value="roundedInput"
        :data-testid="`remote-sync-rounded-duration-${row.taskId}`"
        @update:model-value="(value: string | undefined) => emit('roundedInput', value)"
        @blur="emit('commitRounded')"
        @keydown.enter="emit('commitRounded')"
      />
      <UButton
        v-if="hasOverride"
        variant="ghost"
        size="sm"
        :label="t('remoteSync.resetDuration')"
        :data-testid="`remote-sync-reset-duration-${row.taskId}`"
        @click="emit('resetRounded')"
      />
      <div
        v-if="roundingSuggestions.length > 0"
        class="flex flex-wrap items-center gap-2"
        role="group"
        :aria-label="t('remoteSync.roundingSuggestionsLabel')"
        :data-testid="`remote-sync-rounding-suggestions-${row.taskId}`"
      >
        <span class="text-sm text-muted">{{ t('remoteSync.roundingSuggestionsLabel') }}</span>
        <UButton
          v-for="suggestion in roundingSuggestions"
          :key="`${suggestion.kind}-${suggestion.seconds}`"
          variant="soft"
          color="neutral"
          size="xs"
          :label="suggestionLabel(suggestion)"
          :data-testid="`remote-sync-rounding-suggestion-${row.taskId}-${suggestion.kind}`"
          @click="emit('applySuggestion', suggestion.seconds)"
        />
      </div>
      <span
        v-if="isExcluded"
        class="text-sm text-muted"
        :data-testid="`remote-sync-excluded-hint-${row.taskId}`"
      >
        {{
          excludedReason === 'none'
            ? t('remoteSync.excludedNoSelection')
            : t('remoteSync.roundedDurationHint')
        }}
      </span>
    </div>

    <div
      v-if="canManageEntries"
      class="grid gap-1"
      :data-testid="`remote-sync-comment-block-${row.taskId}`"
    >
      <label :for="`remote-sync-comment-${row.taskId}`" class="text-sm text-muted">
        {{ t('remoteSync.commentLabel') }}
      </label>
      <UInput
        :id="`remote-sync-comment-${row.taskId}`"
        :model-value="comment"
        :data-testid="`remote-sync-comment-${row.taskId}`"
        @update:model-value="(value: string | undefined) => emit('commentInput', value)"
      />
      <p class="m-0 text-xs text-muted">{{ t('remoteSync.commentHint') }}</p>
    </div>

    <div
      v-if="entries.length > 0"
      class="flex flex-col items-start gap-3"
      :data-testid="`remote-sync-entries-${row.taskId}`"
    >
      <div class="flex flex-wrap items-center gap-2">
        <p class="m-0 font-semibold">{{ t('remoteSync.entriesHeading') }}</p>
        <template v-if="canManageEntries">
          <UButton
            variant="ghost"
            size="xs"
            :label="t('remoteSync.selectAllEntries')"
            :data-testid="`remote-sync-select-all-entries-${row.taskId}`"
            @click="emit('selectAllEntries')"
          />
          <UButton
            variant="ghost"
            size="xs"
            :label="t('remoteSync.deselectAllEntries')"
            :data-testid="`remote-sync-deselect-all-entries-${row.taskId}`"
            @click="emit('deselectAllEntries')"
          />
        </template>
      </div>
      <div
        v-for="entry in entries"
        :key="entry.id"
        class="flex items-center gap-2"
        :data-testid="`remote-sync-entry-${entry.id}`"
      >
        <UCheckbox
          :model-value="selectedEntryIds.includes(entry.id)"
          :input-id="`remote-sync-entry-check-${entry.id}`"
          :disabled="!canManageEntries"
          :aria-label="
            t('remoteSync.entrySelectLabel', { start: formatEntryStart(entry.startedAt) })
          "
          :data-testid="`remote-sync-entry-check-${entry.id}`"
          @update:model-value="
            (checked: boolean | 'indeterminate') => emit('toggleEntry', entry.id, checked === true)
          "
        />
        <label :for="`remote-sync-entry-check-${entry.id}`">
          {{
            t('remoteSync.entrySummary', {
              start: formatEntryStart(entry.startedAt),
              duration: formatDuration(entry.durationSeconds),
            })
          }}
          <span
            v-if="entry.previouslyExported"
            class="ml-1.5 text-xs text-muted"
            :data-testid="`remote-sync-entry-exported-${entry.id}`"
          >
            {{ t('remoteSync.entryPreviouslyExported') }}
          </span>
        </label>
      </div>
    </div>

    <div
      v-if="duplicateLog && !duplicateDismissed"
      class="flex flex-wrap items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-2 text-sm"
      role="status"
      :data-testid="`remote-sync-duplicate-warning-${row.taskId}`"
    >
      <UIcon name="i-lucide-triangle-alert" class="mt-0.5 size-4 shrink-0 text-warning" />
      <span class="flex-1">
        {{
          t('remoteSync.duplicateWarning', {
            id: duplicateLog.remoteLogId,
            commentPart: hasRealComment(duplicateLog)
              ? t('remoteSync.duplicateWarningComment', { comment: duplicateLog.comment })
              : '',
          })
        }}
      </span>
      <UTooltip :text="t('remoteSync.duplicateWarningDismiss')" :content="{ side: 'top' }">
        <UButton
          icon="i-lucide-x"
          color="neutral"
          variant="ghost"
          size="xs"
          square
          :aria-label="t('remoteSync.duplicateWarningDismiss')"
          :data-testid="`remote-sync-duplicate-dismiss-${row.taskId}`"
          @click="emit('dismissDuplicate')"
        />
      </UTooltip>
    </div>

    <div
      v-if="showRemoteLogs"
      class="flex flex-col items-start gap-3"
      :data-testid="`remote-sync-remote-logs-${row.taskId}`"
    >
      <p class="m-0 font-semibold">{{ t('remoteSync.remoteLogsHeading') }}</p>
      <span
        v-if="remoteLogsLoading"
        role="status"
        aria-live="polite"
        :data-testid="`remote-sync-remote-logs-loading-${row.taskId}`"
      >
        {{ t('remoteSync.remoteLogsLoading') }}
      </span>
      <template v-else-if="remoteLogsErrorKey">
        <span role="alert" :data-testid="`remote-sync-remote-logs-error-${row.taskId}`">
          {{ t('remoteSync.remoteLogsError') }}
        </span>
        <UButton
          variant="ghost"
          size="sm"
          :label="t('remoteSync.remoteLogsRetry')"
          :data-testid="`remote-sync-remote-logs-retry-${row.taskId}`"
          @click="emit('retryRemoteLogs')"
        />
      </template>
      <p
        v-else-if="remoteLogsLoaded && remoteLogs.length === 0"
        :data-testid="`remote-sync-remote-logs-empty-${row.taskId}`"
      >
        {{ t('remoteSync.remoteLogsEmpty') }}
      </p>
      <ul v-else-if="remoteLogs.length > 0" class="m-0 grid w-full gap-2 pl-0">
        <li
          v-for="log in remoteLogs"
          :key="log.remoteLogId"
          class="grid gap-0.5 list-none"
          :data-testid="`remote-sync-remote-log-${log.remoteLogId}`"
        >
          <span>
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
</template>
