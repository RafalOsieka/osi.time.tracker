<script setup lang="ts">
import { EXTENSION_ERROR_MESSAGE_KEYS } from '@osi/time-tracker-extension-protocol';
import type { RemoteSyncDayRowDto } from '~~/shared/types/remote-sync-day';
import type {
  RemoteFieldOption,
  RemoteIssueScope,
} from '@osi/time-tracker-remote-trackers/contracts';
import type { TrackerDto } from '~~/shared/types/tracker';
import type { ColumnDefinition } from '../ColumnList.vue';

/**
 * A row's state kind (REQ-504): Ready, Sent, Loading while activities load, blocked by something
 * the user can fix (no issue, a failed load), or excluded by design (a local Project).
 */
export type SyncRowKind = 'ready' | 'sent' | 'loading' | 'blocked' | 'excluded';

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
  issueReason = null,
  showLinkPicker,
  pickerConfig,
  pickerScope = null,
  dayLabel = undefined,
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
  /** A short read-only reason ("Local project") shown in the issue cell instead of a bare dash. */
  issueReason?: string | null;
  showLinkPicker: boolean;
  pickerConfig: TrackerDto | null;
  /** The owning project's remote project scope (REQ-328), if any. */
  pickerScope?: (RemoteIssueScope & { remoteProjectTitle: string }) | null;
  /** The reviewed day without its weekday ("7 listopada 2026"), named by the picker's context. */
  dayLabel?: string;
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
 * Ready titles read as primary text in the quiet editable frame the Timer's time editors use, so
 * they look editable at rest. While activities load they keep that shape, inactive.
 */
const titleDisplayClass = computed(() =>
  canEdit ? 'font-medium text-highlighted' : 'font-medium text-default',
);
/**
 * An editable to send is a row value (500, the body tone: in the mono face the darkest tone read
 * heavier than 500); a Sent row's exported value and the
 * local time sit at the body weight and tone (valid data, never disabled-looking), so neither
 * reads like a total. Only a zero, an export that cannot happen, recedes.
 */
const toSendClass = computed(() => {
  if (toSendLabel === formatDuration(0)) return 'font-normal text-dimmed';
  return showEditors ? 'font-medium text-default' : 'font-normal text-default';
});
/**
 * The to-send editor at rest: the same frame as the title to send (card tone, 3:1 outline),
 * sized like the duration field it turns into, so the value does not move when editing starts.
 */
const TO_SEND_FRAME =
  'w-[calc(8ch+1rem)] rounded-md bg-muted px-2 py-1.5 ring ring-inset ring-accented transition-colors';

const rowDeltaTooltip = computed(() => t('remoteSync.rowDeltaTooltip', { delta: deltaLabel }));
/**
 * A distinct shape per kind, so states never rely on color alone. Each kind also carries its
 * meaning color: cyan for Ready (it can go), green for Sent, amber only for what the user can fix;
 * Loading and a deliberate exclusion (a local Project) are neutral.
 */
const stateIcons = {
  ready: { icon: 'i-lucide-circle-arrow-up', color: 'primary', iconClass: '' },
  sent: { icon: 'i-lucide-check-check', color: 'success', iconClass: '' },
  loading: {
    icon: 'i-lucide-loader-circle',
    color: 'neutral',
    iconClass: 'animate-spin text-dimmed',
  },
  blocked: { icon: 'i-lucide-circle-alert', color: 'warning', iconClass: '' },
  excluded: { icon: 'i-lucide-circle-minus', color: 'neutral', iconClass: 'text-dimmed' },
} as const satisfies Record<
  SyncRowKind,
  { icon: string; color: 'primary' | 'neutral' | 'success' | 'warning'; iconClass: string }
>;
const activityOpen = ref(false);
const selectedActivityName = computed(
  () => activityOptions.find((option) => option.id === selectedActivityId)?.name,
);
const activityDisplayValue = computed(() => {
  if (activityLoading) return t('remoteSync.activityLoading');
  return selectedActivityName.value ?? t('remoteSync.activityEmptyOption');
});

/**
 * The option the keyboard is on: marked with the neutral 3:1 outline (as in the issue picker), so
 * the open trigger's cyan ring stays the only cyan frame; picked by Enter.
 */
const activeOptionId = ref<string | null>(null);

function onActivityOpen(open: boolean) {
  if (open && (!canEdit || activityLoading)) {
    activityOpen.value = false;
    return;
  }
  if (open) activeOptionId.value = selectedActivityId ?? activityOptions[0]?.id ?? null;
  activityOpen.value = open;
}

const activityList = useTemplateRef<HTMLElement>('activityList');

function activityOptionElements(): HTMLElement[] {
  return [...(activityList.value?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])];
}

/** Opening the menu focuses the chosen activity (else the first), as a native select does. */
function onActivityMenuAutoFocus(event: Event) {
  event.preventDefault();
  const options = activityOptionElements();
  (
    options.find((option) => option.getAttribute('aria-selected') === 'true') ?? options[0]
  )?.focus();
}

/** The listbox keys: arrows, Home and End move between options; Enter and Space pick one. */
function onActivityListKeydown(event: KeyboardEvent) {
  const options = activityOptionElements();
  if (options.length === 0) return;
  const current = options.findIndex((option) => option === document.activeElement);
  const last = options.length - 1;
  let next: number;
  switch (event.key) {
    case 'ArrowDown':
      next = current < 0 ? 0 : Math.min(current + 1, last);
      break;
    case 'ArrowUp':
      next = current < 0 ? last : Math.max(current - 1, 0);
      break;
    case 'Home':
      next = 0;
      break;
    case 'End':
      next = last;
      break;
    default:
      return;
  }
  event.preventDefault();
  options[next]?.focus();
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
        framed
        @edit="emit('edit-title')"
        @update:model-value="(value) => emit('update:comment', value)"
        @commit="emit('commit-title')"
        @cancel="emit('cancel-title')"
      />
      <span
        v-else
        class="block truncate text-sm font-medium text-default"
        :data-testid="`remote-sync-task-name-${row.taskId}`"
      >
        {{ row.taskName }}
      </span>
    </ColumnCell>

    <ColumnCell :columns="columns" col="issue" :narrow="{ col: [3, 4], row: 2 }">
      <!-- The issue, then the Tracker it lives in as a quiet second line: two connections of
           one type stay distinguishable, and the two lines fit the 44px row. -->
      <div v-if="issueTitle && issueId" class="grid min-w-0">
        <UTooltip :text="`#${issueId} ${issueTitle}`" :content="{ side: 'top', align: 'start' }">
          <!-- The number leads and never truncates; the title gives way. -->
          <span
            class="flex min-w-0 items-baseline gap-1.5 text-sm/5"
            :data-testid="`remote-sync-issue-${row.taskId}`"
          >
            <span class="shrink-0 font-mono text-xs tabular-nums text-dimmed">#{{ issueId }}</span>
            <span class="truncate text-default">
              {{ issueTitle }}
            </span>
          </span>
        </UTooltip>
        <span
          v-if="row.trackerName"
          class="truncate text-xs/4 text-muted"
          :data-testid="`remote-sync-destination-${row.taskId}`"
        >
          {{ row.trackerName }}
        </span>
      </div>
      <!-- A flex host, so the inline trigger centres on the row like the issue text does. -->
      <div v-else-if="showLinkPicker && pickerConfig" class="flex items-center">
        <RemoteIssuePicker
          :config="pickerConfig"
          :scope="pickerScope"
          :day-label="dayLabel"
          :link-label="t('remoteSync.linkAction')"
          :data-testid="`remote-sync-link-${row.taskId}`"
          @link="(payload) => emit('link', payload)"
        />
      </div>
      <span
        v-else-if="issueReason"
        class="block truncate text-sm text-dimmed"
        :data-testid="`remote-sync-issue-reason-${row.taskId}`"
      >
        {{ issueReason }}
      </span>
      <span v-else class="text-sm text-dimmed">{{ t('remoteSync.emptyCell') }}</span>
    </ColumnCell>

    <ColumnCell :columns="columns" col="activity" :narrow="{ col: [3, 4], row: 3 }">
      <div class="min-w-0">
        <!-- REQ-506: the failure stays inside the cell, an icon carrying the message (muted: the
             row's state icon is its one amber mark) and a compact retry, so a day of failed rows
             stays calm. -->
        <template v-if="activityError">
          <div class="-ms-1 flex min-w-0 items-center gap-0.5">
            <UPopover mode="hover" enable-touch :content="{ side: 'top' }">
              <UButton
                icon="i-lucide-unplug"
                color="neutral"
                variant="ghost"
                size="xs"
                square
                class="shrink-0 text-muted"
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
            <!-- The extension check keeps its labelled button; the plain retry is the agreed row
                 action, a cyan tinted tile at the row controls' 28px, named by its tooltip, so a day of failed rows does
                 not repeat "Ponów" down the column. -->
            <UButton
              v-if="extensionActivityErrorKey"
              color="neutral"
              variant="outline"
              size="xs"
              icon="i-lucide-refresh-cw"
              class="min-w-0"
              :ui="{ label: 'truncate', leadingIcon: 'size-3.5' }"
              :label="t('trackers.extensionRecheckButton')"
              :data-testid="`remote-sync-activity-retry-${row.taskId}`"
              @click="emit('retry-activity')"
            />
            <UTooltip v-else :text="t('remoteSync.activityRetry')" :content="{ side: 'top' }">
              <UButton
                color="primary"
                variant="soft"
                square
                icon="i-lucide-refresh-cw"
                class="size-7 justify-center rounded-md"
                :ui="{ leadingIcon: 'size-4' }"
                :aria-label="t('remoteSync.activityRetry')"
                :data-testid="`remote-sync-activity-retry-${row.taskId}`"
                @click="emit('retry-activity')"
              />
            </UTooltip>
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
          <span tabindex="0" class="flex w-full min-w-0">
            <UButton
              variant="outline"
              color="neutral"
              size="xs"
              disabled
              trailing-icon="i-lucide-chevron-down"
              class="w-full justify-between text-sm font-normal text-dimmed disabled:opacity-100"
              :ui="{ label: 'truncate', trailingIcon: 'size-3.5 text-dimmed' }"
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
          :content="{
            side: 'bottom',
            align: 'end',
            sideOffset: 4,
            onOpenAutoFocus: onActivityMenuAutoFocus,
          }"
          @update:open="onActivityOpen"
        >
          <OverflowTooltip :text="activityDisplayValue">
            <!-- The outlined control language of the row's other editors: a rounded-md select
                 with the 3:1 outline at rest, filling its column at their 28px height (inside it,
                 so the issue column keeps the full 12px gutter), a muted
                 placeholder until an activity is chosen, and a cyan ring while its menu is open.
                 The row's amber state, not a loud fill, says the activity is still missing. -->
            <UButton
              variant="outline"
              color="neutral"
              size="xs"
              trailing-icon="i-lucide-chevron-down"
              class="w-full max-w-full justify-between text-sm font-normal"
              :class="[
                selectedActivityName ? 'text-default' : 'text-dimmed',
                activityOpen && 'ring-primary',
              ]"
              :ui="{
                label: 'truncate',
                trailingIcon: `size-3.5 text-dimmed transition-transform ${activityOpen ? 'rotate-180' : ''}`,
              }"
              :label="activityDisplayValue"
              :aria-label="t('remoteSync.activityLabel')"
              :data-testid="`remote-sync-activity-select-${row.taskId}`"
            />
          </OverflowTooltip>
          <template #content>
            <div
              ref="activityList"
              tabindex="-1"
              class="flex max-h-60 w-(--reka-popover-trigger-width) flex-col overflow-auto p-1 outline-none"
              role="listbox"
              :aria-label="t('remoteSync.activityLabel')"
              :data-testid="`remote-sync-activity-list-${row.taskId}`"
              @keydown="onActivityListKeydown"
            >
              <!-- Which tracker the activities come from, as a one-line group label: the
                   Tracker's name alone fits the trigger's width. -->
              <p
                v-if="row.trackerName"
                class="m-0 truncate px-2.5 pt-1 pb-1.5 text-xs font-medium text-muted"
                aria-hidden="true"
              >
                {{ row.trackerName }}
              </p>
              <UButton
                v-for="option in activityOptions"
                :key="option.id"
                variant="ghost"
                color="neutral"
                class="w-full justify-start hover:bg-elevated dark:hover:bg-accented/60"
                :class="[
                  option.id === selectedActivityId && 'font-medium text-highlighted',
                  option.id === activeOptionId &&
                    'bg-elevated ring-1 ring-accented ring-inset dark:bg-accented/60',
                ]"
                :ui="{ trailingIcon: 'ms-auto size-4 text-primary' }"
                role="option"
                :aria-selected="option.id === selectedActivityId"
                :trailing-icon="option.id === selectedActivityId ? 'i-lucide-check' : undefined"
                :label="option.name"
                :data-active="option.id === activeOptionId || undefined"
                :data-testid="`remote-sync-activity-option-${row.taskId}-${option.id}`"
                @focus="activeOptionId = option.id"
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
      <!-- Local time is valid local data on every row, never shown as disabled: the body tone,
           a step below the editable to-send value. -->
      <span
        class="font-mono text-sm tabular-nums text-default"
        :data-testid="`remote-sync-tracked-${row.taskId}`"
      >
        {{ trackedLabel }}
      </span>
    </ColumnCell>
    <ColumnCell :columns="columns" col="toSend" align="end" :narrow="{ col: [4, 5], row: 3 }">
      <UTooltip :text="rowDeltaTooltip" :disabled="editingToSend" :content="{ side: 'top' }">
        <div
          class="flex w-full items-baseline justify-end gap-1 font-mono text-sm tabular-nums"
          :class="toSendClass"
          :data-testid="`remote-sync-row-duration-${row.taskId}`"
        >
          <span aria-hidden="true" class="hidden @max-[40rem]/list:inline">
            {{ t('remoteSync.trackedToSendArrow') }}
          </span>
          <DurationInput
            v-if="showEditors && editingToSend"
            class="-me-2"
            :model-value="toSendInput"
            :label="t('remoteSync.roundedDurationLabel')"
            :testid="`remote-sync-to-send-input-${row.taskId}`"
            @update:model-value="(value) => emit('update:to-send', value ?? undefined)"
            @commit="emit('commit-to-send')"
            @cancel="emit('cancel-to-send')"
          />
          <!-- The frame holds the value's own fixed width (every to-send value is HH:MM:SS, so
               the frames still line up), on the card's quietest fill: the 3:1 edge stays, the
               column no longer stacks into a dark block. Its padding hangs past the column
               edge, so the digits keep the edge the other rows' values sit on. -->
          <button
            v-else-if="showEditors"
            type="button"
            class="-me-2 shrink-0 text-end font-[inherit] text-[length:inherit] leading-4"
            :class="[
              TO_SEND_FRAME,
              canEdit ? 'cursor-pointer hover:bg-elevated' : 'cursor-default',
            ]"
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
