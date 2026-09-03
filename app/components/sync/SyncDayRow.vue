<script setup lang="ts">
import type { RemoteSyncDayRowDto } from '~~/shared/types/remote-sync-day';
import type { RemoteFieldOption } from '~~/shared/types/remote-field-option';
import type { TrackerDto } from '~~/shared/types/tracker';

const {
  row,
  expanded,
  canEdit,
  showEditors,
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
  showEditors: boolean;
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

const rowDeltaTooltip = computed(() => t('remoteSync.rowDeltaTooltip', { delta: deltaLabel }));
const durationClusterAria = computed(() =>
  t('remoteSync.durationClusterAria', {
    tracked: trackedLabel,
    toSend: toSendLabel,
    delta: deltaLabel,
  }),
);
const activityOpen = ref(false);
const selectedActivityName = computed(
  () => activityOptions.find((option) => option.id === selectedActivityId)?.name,
);
const activityDisplayValue = computed(() => {
  if (activityLoading) return t('remoteSync.activityLoading');
  return selectedActivityName.value ?? t('remoteSync.activityEmptyOption');
});

function onActivityOpen(open: boolean) {
  if (open && (!canEdit || activityLoading)) {
    activityOpen.value = false;
    return;
  }
  activityOpen.value = open;
}

function commitActivity(id: string) {
  activityOpen.value = false;
  if (!canEdit) return;
  emit('update:activity', id);
}

function onEditToSend() {
  if (!canEdit) return;
  emit('edit-to-send');
}
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
        v-if="showEditors"
        :model-value="comment"
        :editing="editingTitle"
        :disabled="!canEdit"
        :field-label="t('remoteSync.titleToSendLabel')"
        :display-testid="`remote-sync-task-name-${row.taskId}`"
        :input-testid="`remote-sync-comment-${row.taskId}`"
        display-class="font-medium"
        @edit="emit('edit-title')"
        @update:model-value="(value) => emit('update:comment', value)"
        @commit="emit('commit-title')"
        @cancel="emit('cancel-title')"
      />
      <span
        v-else
        class="truncate text-xs text-muted"
        :data-testid="`remote-sync-task-name-${row.taskId}`"
      >
        {{ row.taskName }}
      </span>
    </template>

    <template #secondary>
      <span
        v-if="issueTitle && issueId"
        class="block max-w-48 truncate text-xs text-muted"
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
      <span v-else class="text-xs text-muted">{{ t('remoteSync.emptyCell') }}</span>
    </template>

    <template #meta>
      <div class="w-48 min-w-0 max-w-full">
        <template v-if="activityError">
          <div class="flex min-w-0 items-center gap-1">
            <span
              role="alert"
              class="truncate text-xs text-muted"
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
          </div>
        </template>
        <span
          v-else-if="noActivity"
          class="truncate text-xs text-muted"
          :data-testid="`remote-sync-no-activity-${row.taskId}`"
        >
          {{ t('remoteSync.noActivityReason') }}
        </span>
        <UTooltip v-else-if="showEditors && !canEdit" :text="reason" :content="{ side: 'top' }">
          <span tabindex="0" class="inline-flex w-full min-w-0">
            <UButton
              variant="ghost"
              color="neutral"
              size="xs"
              disabled
              class="w-full justify-start truncate text-muted disabled:opacity-40"
              :label="activityDisplayValue"
              :loading="activityLoading"
              :aria-label="t('remoteSync.activityLabel')"
              :aria-busy="activityLoading"
              :data-testid="
                activityLoading
                  ? `remote-sync-activity-loading-${row.taskId}`
                  : `remote-sync-activity-select-${row.taskId}`
              "
            />
          </span>
        </UTooltip>
        <UPopover
          v-else-if="showEditors"
          :open="activityOpen"
          :modal="false"
          :content="{ side: 'bottom', align: 'start', sideOffset: 4 }"
          @update:open="onActivityOpen"
        >
          <OverflowTooltip class="w-full" :text="activityDisplayValue">
            <UButton
              variant="ghost"
              color="neutral"
              size="xs"
              class="w-full justify-start truncate text-muted"
              :label="activityDisplayValue"
              :aria-label="t('remoteSync.activityLabel')"
              :data-testid="`remote-sync-activity-select-${row.taskId}`"
            />
          </OverflowTooltip>
          <template #content>
            <div
              class="flex max-h-60 min-w-48 flex-col overflow-auto p-1"
              role="listbox"
              :aria-label="t('remoteSync.activityLabel')"
              :data-testid="`remote-sync-activity-list-${row.taskId}`"
            >
              <UButton
                v-for="option in activityOptions"
                :key="option.id"
                variant="ghost"
                color="neutral"
                class="w-full justify-start"
                role="option"
                :label="option.name"
                :data-testid="`remote-sync-activity-option-${row.taskId}-${option.id}`"
                @click.stop="commitActivity(option.id)"
              />
            </div>
          </template>
        </UPopover>
        <span
          v-else
          class="block truncate text-xs text-muted"
          :data-testid="`remote-sync-activity-select-${row.taskId}`"
        >
          {{ selectedActivityName ?? t('remoteSync.emptyCell') }}
        </span>
      </div>
    </template>

    <template #duration>
      <UTooltip :text="rowDeltaTooltip" :disabled="editingToSend" :content="{ side: 'top' }">
        <div
          class="inline-flex items-baseline gap-1 font-mono text-sm font-medium tabular-nums text-muted"
          :aria-label="durationClusterAria"
          :data-testid="`remote-sync-row-duration-${row.taskId}`"
        >
          <span :data-testid="`remote-sync-tracked-${row.taskId}`">{{ trackedLabel }}</span>
          <span aria-hidden="true">{{ t('remoteSync.trackedToSendArrow') }}</span>
          <TimeInput
            v-if="showEditors && editingToSend"
            :model-value="toSendInput"
            duration
            :label="t('remoteSync.roundedDurationLabel')"
            :testid="`remote-sync-to-send-input-${row.taskId}`"
            @update:model-value="(value) => emit('update:to-send', value ?? undefined)"
            @commit="emit('commit-to-send')"
            @cancel="emit('cancel-to-send')"
          />
          <button
            v-else-if="showEditors"
            type="button"
            class="bg-transparent p-0 font-[inherit] text-[length:inherit] leading-[inherit]"
            :class="canEdit ? 'cursor-pointer' : 'cursor-default'"
            :disabled="!canEdit"
            :aria-label="t('remoteSync.roundedDurationLabel')"
            :data-testid="`remote-sync-to-send-${row.taskId}`"
            @click="onEditToSend"
          >
            {{ toSendLabel }}
          </button>
          <span v-else :data-testid="`remote-sync-to-send-${row.taskId}`">
            {{ toSendLabel }}
          </span>
          <span class="sr-only" :data-testid="`remote-sync-row-delta-${row.taskId}`">
            {{ t('remoteSync.deltaLabel') }}: {{ deltaLabel }}
          </span>
        </div>
      </UTooltip>
    </template>

    <template #detail>
      <slot name="detail" />
    </template>
  </CompactExpandableRow>
</template>
