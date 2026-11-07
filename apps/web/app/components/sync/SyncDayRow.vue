<script setup lang="ts">
import { EXTENSION_ERROR_MESSAGE_KEYS } from '@osi/time-tracker-extension-protocol';
import type { RemoteSyncDayRowDto } from '~~/shared/types/remote-sync-day';
import type {
  RemoteFieldOption,
  RemoteIssueScope,
} from '@osi/time-tracker-remote-trackers/contracts';
import type { TrackerDto } from '~~/shared/types/tracker';
import type { ColumnDefinition } from '../ColumnList.vue';

/** A row's state kind (REQ-504): Ready, Sent, Loading while activities load, or blocked. */
export type SyncRowKind = 'ready' | 'sent' | 'loading' | 'blocked';

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
  kind,
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
  kind: SyncRowKind;
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

/**
 * Ready titles read as primary text and show a ghost input on hover, so they look editable
 * without chrome at rest. While activities load they keep that shape, inactive.
 */
const titleDisplayClass = computed(() =>
  canEdit
    ? 'font-medium text-highlighted rounded-md transition-colors hover:bg-elevated hover:ring hover:ring-inset hover:ring-accented'
    : 'font-medium text-default',
);
/**
 * To send is a row value (a touch above body weight, default text) next to tracked (400,
 * muted); it stays clearly under the stat figures, since the strongest text belongs to
 * totals. Zero recedes.
 */
const toSendClass = computed(() => {
  if (toSendLabel === formatDuration(0)) return 'font-normal text-dimmed';
  return showEditors ? 'font-[450] text-default dark:font-[340]' : 'font-normal text-muted';
});

const rowDeltaTooltip = computed(() => t('remoteSync.rowDeltaTooltip', { delta: deltaLabel }));
/**
 * A distinct shape per kind, so states never rely on color alone. Ready is the common case and
 * stays neutral; color marks the exceptions: amber for blocked, green for Sent.
 */
const stateIcons = {
  ready: { icon: 'i-lucide-circle-arrow-up', color: 'neutral', iconClass: 'text-muted' },
  sent: { icon: 'i-lucide-check-check', color: 'success', iconClass: '' },
  loading: {
    icon: 'i-lucide-loader-circle',
    color: 'neutral',
    iconClass: 'animate-spin text-dimmed',
  },
  blocked: { icon: 'i-lucide-circle-alert', color: 'warning', iconClass: '' },
} as const satisfies Record<
  SyncRowKind,
  { icon: string; color: 'neutral' | 'success' | 'warning'; iconClass: string }
>;
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
      <!-- The Timer's toggle: a plain ghost chevron. No hover/active tile, so a row never looks
           selected while the pointer rests on it; the glyph darkens instead. -->
      <UButton
        :icon="expanded ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
        color="neutral"
        variant="ghost"
        square
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
          :icon="stateIcons[kind].icon"
          :color="stateIcons[kind].color"
          variant="ghost"
          square
          size="xs"
          :ui="{ leadingIcon: stateIcons[kind].iconClass }"
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
        :display-class="titleDisplayClass"
        @edit="emit('edit-title')"
        @update:model-value="(value) => emit('update:comment', value)"
        @commit="emit('commit-title')"
        @cancel="emit('cancel-title')"
      />
      <span
        v-else
        class="block truncate text-sm font-medium text-muted"
        :data-testid="`remote-sync-task-name-${row.taskId}`"
      >
        {{ row.taskName }}
      </span>
    </ColumnCell>

    <ColumnCell :columns="columns" col="issue" :narrow="{ col: [3, 4], row: 2 }">
      <UTooltip
        v-if="issueTitle && issueId"
        :text="`#${issueId} ${issueTitle}`"
        :content="{ side: 'top', align: 'start' }"
      >
        <!-- The number leads and never truncates; the title gives way. -->
        <span
          class="flex min-w-0 items-baseline gap-1.5 text-sm"
          :data-testid="`remote-sync-issue-${row.taskId}`"
        >
          <span class="shrink-0 font-mono text-xs tabular-nums text-dimmed">#{{ issueId }}</span>
          <span class="truncate" :class="showEditors ? 'text-default' : 'text-muted'">
            {{ issueTitle }}
          </span>
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
      <span v-else class="text-sm text-dimmed">{{ t('remoteSync.emptyCell') }}</span>
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
          class="block truncate text-sm text-muted"
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
              class="-ms-2 justify-start truncate text-sm font-normal text-dimmed disabled:opacity-100"
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
            <!-- Still empty, the required activity is drawn as a control (a dashed 3:1 outline,
                 solid on hover and focus) so the row shows what Export waits for; once chosen it
                 reads as plain row text. Either way its text starts on the column's edge. -->
            <UButton
              variant="ghost"
              color="neutral"
              size="xs"
              trailing-icon="i-lucide-chevron-down"
              class="max-w-[calc(100%+0.5rem)] justify-start text-sm font-normal"
              :class="
                selectedActivityName
                  ? '-ms-2 text-default'
                  : '-ms-2 border border-dashed border-accented text-muted hover:border-solid focus-visible:border-solid'
              "
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
          class="block truncate text-sm"
          :class="selectedActivityName ? 'text-muted' : 'text-dimmed'"
          :data-testid="`remote-sync-activity-select-${row.taskId}`"
        >
          {{ selectedActivityName ?? t('remoteSync.emptyCell') }}
        </span>
      </div>
    </ColumnCell>

    <ColumnCell :columns="columns" col="tracked" align="end" :narrow="{ col: [4, 5], row: 2 }">
      <span
        class="font-mono text-sm tabular-nums text-muted"
        :data-testid="`remote-sync-tracked-${row.taskId}`"
      >
        {{ trackedLabel }}
      </span>
    </ColumnCell>
    <ColumnCell :columns="columns" col="toSend" align="end" :narrow="{ col: [4, 5], row: 3 }">
      <UTooltip :text="rowDeltaTooltip" :disabled="editingToSend" :content="{ side: 'top' }">
        <div
          class="inline-flex items-baseline gap-1 font-mono text-sm tabular-nums"
          :class="toSendClass"
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
            class="-me-1 rounded-sm bg-transparent px-1 font-[inherit] text-[length:inherit] leading-[inherit] transition-colors"
            :class="canEdit ? 'cursor-pointer hover:bg-elevated' : 'cursor-default'"
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
