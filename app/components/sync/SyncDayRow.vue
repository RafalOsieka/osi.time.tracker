<script setup lang="ts">
import type { RemoteSyncDayRowDto } from '~~/shared/types/remote-sync-day';
import type { RemoteFieldOption } from '~~/shared/types/remote-field-option';
import type { TrackerDto } from '~~/shared/types/tracker';

const {
  row,
  expanded,
  canEdit,
  kindLabel,
  kindColor,
  reason,
  issueTitle,
  issueId,
  showLinkPicker,
  pickerConfig,
  comment,
  editingTitle,
  trackedLabel,
  toSendLabel,
  deltaLabel,
  editingToSend,
  toSendInput,
  activityLoading,
  activityError,
  activityOptions,
  selectedActivityId,
  noActivity,
} = defineProps<{
  row: RemoteSyncDayRowDto;
  expanded: boolean;
  canEdit: boolean;
  kindLabel: string | null;
  kindColor: 'success' | 'warning' | 'error' | 'neutral';
  reason: string;
  issueTitle: string | null;
  issueId: string | null;
  showLinkPicker: boolean;
  pickerConfig: TrackerDto | null;
  comment: string;
  editingTitle: boolean;
  trackedLabel: string;
  toSendLabel: string;
  deltaLabel: string;
  editingToSend: boolean;
  toSendInput: string;
  activityLoading: boolean;
  activityError: boolean;
  activityOptions: RemoteFieldOption[];
  selectedActivityId: string | undefined;
  noActivity: boolean;
}>();

const emit = defineEmits<{
  toggle: [];
  link: [
    payload: {
      remoteIssueId: string;
      cachedTitle: string;
      cachedRemoteProjectTitle?: string;
    },
  ];
  'edit-title': [];
  'update:comment': [value: string];
  'commit-title': [];
  'cancel-title': [];
  'edit-to-send': [];
  'update:to-send': [value: string | undefined];
  'commit-to-send': [];
  'cancel-to-send': [];
  'update:activity': [value: string | undefined];
  'retry-activity': [];
}>();

const { t } = useI18n();
</script>

<template>
  <CompactExpandableRow
    :expanded="expanded"
    :expand-label="t('remoteSync.expandRow')"
    :collapse-label="t('remoteSync.collapseRow')"
    :expand-testid="`remote-sync-expand-${row.taskId}`"
    :details-id="`remote-sync-detail-${row.taskId}`"
    :data-testid="`remote-sync-row-${row.taskId}`"
    @toggle="emit('toggle')"
  >
    <template #title>
      <UBadge
        v-if="kindLabel"
        :color="kindColor"
        variant="subtle"
        size="sm"
        :data-testid="`remote-sync-state-${row.taskId}`"
      >
        <UTooltip :text="reason" :content="{ side: 'top' }">
          <span tabindex="0">{{ kindLabel }}</span>
        </UTooltip>
      </UBadge>
      <InlineEditText
        v-if="canEdit"
        :model-value="comment"
        :editing="editingTitle"
        :field-label="t('remoteSync.titleToSendLabel')"
        :display-testid="`remote-sync-task-name-${row.taskId}`"
        :input-testid="`remote-sync-comment-${row.taskId}`"
        display-class="font-semibold"
        @edit="emit('edit-title')"
        @update:model-value="(value) => emit('update:comment', value)"
        @commit="emit('commit-title')"
        @cancel="emit('cancel-title')"
      />
      <span
        v-else
        class="truncate font-semibold"
        :data-testid="`remote-sync-task-name-${row.taskId}`"
      >
        {{ row.taskName }}
      </span>
    </template>

    <template #secondary>
      <span
        v-if="issueTitle && issueId"
        class="block max-w-48 truncate text-sm text-muted"
        :data-testid="`remote-sync-issue-${row.taskId}`"
      >
        {{ issueTitle }}
        <span>(#{{ issueId }})</span>
      </span>
      <RemoteIssuePicker
        v-else-if="showLinkPicker && pickerConfig"
        :config="pickerConfig"
        :data-testid="`remote-sync-link-${row.taskId}`"
        @link="(payload) => emit('link', payload)"
      />
      <span v-else class="text-sm text-muted">{{ t('remoteSync.emptyCell') }}</span>
    </template>

    <template #meta>
      <div class="flex min-w-0 max-w-48 items-center gap-1">
        <span
          v-if="activityLoading"
          role="status"
          aria-live="polite"
          class="text-xs text-muted"
          :data-testid="`remote-sync-activity-loading-${row.taskId}`"
        >
          {{ t('remoteSync.activityLoading') }}
        </span>
        <template v-else-if="activityError">
          <span
            role="alert"
            class="text-xs"
            :data-testid="`remote-sync-activity-error-${row.taskId}`"
          >
            {{ t('remoteSync.activityFetchError') }}
          </span>
          <UButton
            variant="ghost"
            size="xs"
            :label="t('remoteSync.activityRetry')"
            :data-testid="`remote-sync-activity-retry-${row.taskId}`"
            @click="emit('retry-activity')"
          />
        </template>
        <span
          v-else-if="noActivity"
          class="text-xs text-muted"
          :data-testid="`remote-sync-no-activity-${row.taskId}`"
        >
          {{ t('remoteSync.noActivityReason') }}
        </span>
        <USelect
          v-else-if="canEdit"
          :id="`remote-sync-activity-${row.taskId}`"
          :model-value="selectedActivityId"
          :items="activityOptions"
          label-key="name"
          value-key="id"
          size="xs"
          variant="ghost"
          class="w-40"
          :placeholder="t('remoteSync.activityEmptyOption')"
          :aria-label="t('remoteSync.activityLabel')"
          :data-testid="`remote-sync-activity-select-${row.taskId}`"
          @update:model-value="(value: string | undefined) => emit('update:activity', value)"
        />
        <span
          v-else
          class="truncate text-sm text-muted"
          :data-testid="`remote-sync-activity-select-${row.taskId}`"
        >
          {{
            activityOptions.find((option) => option.id === selectedActivityId)?.name ??
            t('remoteSync.emptyCell')
          }}
        </span>
      </div>
    </template>

    <template #duration>
      <div
        class="flex flex-wrap items-center justify-end gap-1 font-mono text-sm tabular-nums"
        :data-testid="`remote-sync-row-duration-${row.taskId}`"
      >
        <span :data-testid="`remote-sync-tracked-${row.taskId}`">{{ trackedLabel }}</span>
        <span aria-hidden="true">{{ t('remoteSync.trackedToSendArrow') }}</span>
        <InlineEditText
          v-if="canEdit"
          :model-value="editingToSend ? toSendInput : toSendLabel"
          :editing="editingToSend"
          :field-label="t('remoteSync.roundedDurationLabel')"
          :display-testid="`remote-sync-to-send-${row.taskId}`"
          :input-testid="`remote-sync-to-send-input-${row.taskId}`"
          display-class="font-mono text-right"
          @edit="emit('edit-to-send')"
          @update:model-value="(value) => emit('update:to-send', value)"
          @commit="emit('commit-to-send')"
          @cancel="emit('cancel-to-send')"
        />
        <span v-else :data-testid="`remote-sync-to-send-${row.taskId}`">{{ toSendLabel }}</span>
        <span class="text-muted" :data-testid="`remote-sync-row-delta-${row.taskId}`">
          ({{ deltaLabel }})
        </span>
      </div>
    </template>

    <template #detail>
      <slot name="detail" />
    </template>
  </CompactExpandableRow>
</template>
