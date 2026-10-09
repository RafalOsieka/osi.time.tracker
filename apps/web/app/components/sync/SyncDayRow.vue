<script setup lang="ts">
import { EXTENSION_ERROR_MESSAGE_KEYS } from '@osi/extension-protocol';
import type { RemoteSyncDayRowDto } from '~~/shared/types/remote-sync-day';
import type { RemoteFieldOption, RemoteIssueScope } from '@osi/remote-trackers/contracts';
import type { TrackerDto } from '~~/shared/types/tracker';
import type { ColumnDefinition } from '../ColumnList.vue';

const {
  columns = [
    { key: 'expand', track: '1.5rem' },
    { key: 'state', track: '1.5rem' },
    { key: 'title', track: '8rem' },
    { key: 'issue', track: '6rem' },
    { key: 'activity', track: '6rem' },
    { key: 'tracked', track: '5rem' },
    { key: 'toSend', track: '6rem' },
    { key: 'actions', track: '1.5rem' },
  ],
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
  pickerScope = null,
  comment,
  editingTitle,
  trackedLabel,
  toSendLabel,
  deltaLabel,
  editingToSend,
  toSendInput,
  activityLoading,
  activityError,
  activityErrorKey = null,
  activityOptions,
  selectedActivityId,
  noActivity,
} = defineProps<{
  columns?: readonly ColumnDefinition[];
  row: RemoteSyncDayRowDto;
  expanded: boolean;
  canEdit: boolean;
  showEditors: boolean;
  kindLabel: string | null;
  /** One color per state kind: Ready, Sent, Loading, not exportable. */
  kindColor: 'primary' | 'success' | 'neutral' | 'warning';
  reason: string;
  issueTitle: string | null;
  issueId: string | null;
  showLinkPicker: boolean;
  pickerConfig: TrackerDto | null;
  /** The owning project's remote project scope (REQ-328), if any. */
  pickerScope?: (RemoteIssueScope & { remoteProjectTitle: string }) | null;
  comment: string;
  editingTitle: boolean;
  trackedLabel: string;
  toSendLabel: string;
  deltaLabel: string;
  editingToSend: boolean;
  toSendInput: string;
  activityLoading: boolean;
  activityError: boolean;
  activityErrorKey?: string | null;
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
const extensionActivityErrorKey = computed(() =>
  Object.values(EXTENSION_ERROR_MESSAGE_KEYS).find((key) => key === activityErrorKey),
);
/** The tracker this row exports to, when the extension has not approved it yet (REQ-317). */
const unapprovedDestination = computed(() =>
  extensionActivityErrorKey.value === EXTENSION_ERROR_MESSAGE_KEYS.destinationUnapproved &&
  pickerConfig
    ? { provider: pickerConfig.systemType, baseUrl: pickerConfig.baseUrl }
    : null,
);
const suggestion = useExtensionSuggestion(() => emit('retry-activity'));
/** Extension guidance does not fit a cell: a full-width line under the row, shown collapsed too. */
const hasGuidance = computed(() => activityError && !!extensionActivityErrorKey.value);

const rowDeltaTooltip = computed(() => t('remoteSync.rowDeltaTooltip', { delta: deltaLabel }));
/** A distinct shape per kind, so states never rely on color alone. */
const stateIcons = {
  primary: 'i-lucide-circle-arrow-up',
  success: 'i-lucide-check-check',
  neutral: 'i-lucide-loader-circle',
  warning: 'i-lucide-circle-alert',
} as const satisfies Record<typeof kindColor, string>;
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
  <ColumnRow :data-testid="`remote-sync-row-${row.taskId}`" :joined="expanded || hasGuidance">
    <ColumnCell :columns="columns" col="expand" :narrow="{ col: [1, 2], row: 1 }">
      <UButton
        :icon="expanded ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
        color="neutral"
        variant="ghost"
        size="xs"
        :aria-label="t(expanded ? 'remoteSync.collapseRow' : 'remoteSync.expandRow')"
        :aria-expanded="expanded"
        :aria-controls="`remote-sync-detail-${row.taskId}`"
        :data-testid="`remote-sync-expand-${row.taskId}`"
        @click="emit('toggle')"
      />
    </ColumnCell>
    <ColumnCell :columns="columns" col="state" :narrow="{ col: [2, 3], row: 1 }">
      <UPopover mode="hover" enable-touch :content="{ side: 'top' }">
        <UButton
          :icon="stateIcons[kindColor]"
          :color="kindColor"
          variant="ghost"
          square
          size="xs"
          :ui="{ leadingIcon: kindColor === 'neutral' ? 'animate-spin' : '' }"
          :aria-label="`${kindLabel ?? t('remoteSync.kind.blocked')}: ${reason}`"
          :data-testid="`remote-sync-state-${row.taskId}`"
        >
          <span class="sr-only">{{ kindLabel }}</span>
        </UButton>
        <template #content>
          <p class="max-w-xs p-2 text-xs">{{ kindLabel }}: {{ reason }}</p>
        </template>
      </UPopover>
    </ColumnCell>
    <ColumnCell :columns="columns" col="title" :narrow="{ col: [3, 5], row: 1 }">
      <InlineEditText
        v-if="showEditors"
        :model-value="comment"
        :editing="editingTitle"
        :disabled="!canEdit"
        :field-label="t('remoteSync.titleToSendLabel')"
        :display-testid="`remote-sync-task-name-${row.taskId}`"
        :input-testid="`remote-sync-comment-${row.taskId}`"
        display-class="font-medium text-default"
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
    </ColumnCell>

    <ColumnCell :columns="columns" col="issue" :narrow="{ col: [3, 4], row: 2 }">
      <UTooltip
        v-if="issueTitle && issueId"
        :text="`${issueTitle} (#${issueId})`"
        :content="{ side: 'top' }"
      >
        <span
          class="flex min-w-0 gap-1 text-xs text-muted"
          :data-testid="`remote-sync-issue-${row.taskId}`"
        >
          <span class="truncate">{{ issueTitle }}</span>
          <span class="shrink-0">(#{{ issueId }})</span>
        </span>
      </UTooltip>
      <RemoteIssuePicker
        v-else-if="showLinkPicker && pickerConfig"
        :config="pickerConfig"
        :scope="pickerScope"
        :link-label="t('remoteSync.linkAction')"
        :data-testid="`remote-sync-link-${row.taskId}`"
        @link="(payload) => emit('link', payload)"
      />
      <span v-else class="text-xs text-muted">{{ t('remoteSync.emptyCell') }}</span>
    </ColumnCell>

    <ColumnCell :columns="columns" col="activity" :narrow="{ col: [3, 4], row: 3 }">
      <div class="min-w-0">
        <template v-if="activityError">
          <div class="flex min-w-0 items-center gap-1">
            <UPopover mode="hover" enable-touch :content="{ side: 'top' }">
              <UButton
                icon="i-lucide-circle-alert"
                color="error"
                variant="ghost"
                size="xs"
                :aria-label="t(extensionActivityErrorKey ?? 'remoteSync.activityFetchError')"
                :data-testid="`remote-sync-activity-error-${row.taskId}`"
              >
                <span class="sr-only">
                  {{ t(extensionActivityErrorKey ?? 'remoteSync.activityFetchError') }}
                </span>
              </UButton>
              <template #content>
                <p class="max-w-xs p-2 text-xs">
                  {{ t(extensionActivityErrorKey ?? 'remoteSync.activityFetchError') }}
                </p>
              </template>
            </UPopover>
            <UButton
              variant="ghost"
              size="xs"
              :label="
                t(
                  extensionActivityErrorKey
                    ? 'trackers.extensionRecheckButton'
                    : 'remoteSync.activityRetry',
                )
              "
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
          <span tabindex="0" class="inline-flex min-w-0">
            <UButton
              variant="ghost"
              color="neutral"
              size="xs"
              disabled
              class="-ms-2 justify-start truncate font-normal text-muted disabled:opacity-40"
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
          <OverflowTooltip :text="activityDisplayValue">
            <UButton
              variant="ghost"
              color="neutral"
              size="xs"
              trailing-icon="i-lucide-chevron-down"
              class="-ms-2 max-w-[calc(100%+0.5rem)] justify-start font-normal text-muted"
              :ui="{ label: 'truncate', trailingIcon: 'size-3.5' }"
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
    </ColumnCell>

    <ColumnCell :columns="columns" col="tracked" align="end" :narrow="{ col: [4, 5], row: 2 }">
      <span
        class="font-mono text-sm font-medium tabular-nums text-muted"
        :data-testid="`remote-sync-tracked-${row.taskId}`"
      >
        {{ trackedLabel }}
      </span>
    </ColumnCell>
    <ColumnCell :columns="columns" col="toSend" align="end" :narrow="{ col: [4, 5], row: 3 }">
      <UTooltip :text="rowDeltaTooltip" :disabled="editingToSend" :content="{ side: 'top' }">
        <div
          class="inline-flex items-baseline gap-1 font-mono text-sm font-medium tabular-nums text-muted"
          :data-testid="`remote-sync-row-duration-${row.taskId}`"
        >
          <span aria-hidden="true" class="hidden @max-[40rem]/list:inline">
            {{ t('remoteSync.trackedToSendArrow') }}
          </span>
          <DurationInput
            v-if="showEditors && editingToSend"
            :model-value="toSendInput"
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
    </ColumnCell>
    <ColumnCell :columns="columns" col="actions" :narrow="{ col: [5, 6], row: 1 }" />
  </ColumnRow>
  <ColumnRow
    v-if="hasGuidance"
    kind="sub"
    :class="!expanded && 'border-b border-default pb-2'"
    :data-testid="`remote-sync-activity-guidance-${row.taskId}`"
  >
    <ColumnCell
      :columns="columns"
      col="title"
      to="actions"
      :narrow="{ col: [3, 6], row: 1 }"
      class="text-xs text-muted"
    >
      {{ t('trackers.extensionSetupGuidance') }}
      <ExtensionApprovalRequest
        v-if="unapprovedDestination"
        :state="suggestion.states.value[suggestionKey(unapprovedDestination)]"
        :test-id="`remote-sync-activity-request-${row.taskId}`"
        @request="suggestion.request(unapprovedDestination)"
      />
    </ColumnCell>
  </ColumnRow>
  <slot v-if="expanded" name="detail" />
</template>
