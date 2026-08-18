<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { TimerViewGroup } from '~/utils/timerViewGrouping';
import { formatDuration } from '~/utils/formatDuration';
import type { TrackerDto } from '../../shared/types/tracker';

const props = withDefaults(
  defineProps<{
    group: TimerViewGroup;
    isLive: boolean;
    now: number;
    timeZone: string;
    editorKey: string;
    activeEditorKey?: string | null;
    projectOptions?: ProjectDto[];
    tracker?: TrackerDto | null;
  }>(),
  { activeEditorKey: null, projectOptions: () => [], tracker: null },
);

const emit = defineEmits<{
  continue: [];
  stop: [];
  'entry-changed': [];
  'entry-deleted': [];
  'editing-started': [];
}>();

const { t } = useI18n();
const toast = useAppToast();
const { $csrfFetch } = useNuxtApp();

const expanded = ref(false);
const entriesId = computed(() => `timer-group-entries-${props.group.key}`);
const editingTitle = ref(false);
const titleValue = ref('');
const projectSelectOpen = ref(false);
watch(
  () => props.activeEditorKey,
  (activeKey) => {
    if (activeKey === props.editorKey) return;
    editingTitle.value = false;
    projectSelectOpen.value = false;
  },
);

const contextLabel = computed(() => props.group.projectName ?? null);

const projectSelectOptions = computed(() => {
  if (!props.group.projectId || props.projectOptions.some((p) => p.id === props.group.projectId)) {
    return props.projectOptions;
  }
  return [
    ...props.projectOptions,
    {
      id: props.group.projectId,
      name: props.group.projectName ?? '',
      trackerId: null,
      trackerName: null,
      createdAt: '',
    },
  ];
});

async function beginTitleEdit() {
  emit('editing-started');
  projectSelectOpen.value = false;
  titleValue.value = props.group.taskName ?? '';
  editingTitle.value = true;
  await nextTick();
  document
    .querySelector<HTMLInputElement>(`[data-testid="timer-group-title-input-${props.group.key}"]`)
    ?.focus();
}

function cancelTitleEdit() {
  editingTitle.value = false;
}

async function commitTitle() {
  if (!editingTitle.value) return;
  editingTitle.value = false;
  const name = titleValue.value.trim();
  if (!name || name === (props.group.taskName ?? '')) return;
  const ids = props.group.entries.map((entry) => entry.id);
  if (ids.length === 0) return;
  try {
    await $csrfFetch('/api/time-entries/reassign', {
      method: 'POST',
      body: { ids, name },
    });
    emit('entry-changed');
  } catch (err: unknown) {
    toast.error(t(extractMessageKey(err, 'errors.unexpected')));
  }
}

function onProjectOpen(open: boolean) {
  if (open && !canAssignProject.value) {
    projectSelectOpen.value = false;
    return;
  }
  projectSelectOpen.value = open;
  if (open) {
    emit('editing-started');
    editingTitle.value = false;
  }
}

async function commitProject(value: string | null) {
  projectSelectOpen.value = false;
  if (value === props.group.projectId) return;
  if (!props.group.taskId && !props.group.taskName) return;
  const ids = props.group.entries.map((entry) => entry.id);
  if (ids.length === 0) return;
  try {
    await $csrfFetch('/api/time-entries/reassign', {
      method: 'POST',
      body: { ids, projectId: value ?? null },
    });
    emit('entry-changed');
  } catch (err: unknown) {
    toast.error(t(extractMessageKey(err, 'errors.unexpected')));
  }
}

const titleDisplayValue = computed(() => props.group.taskName ?? t('timerView.noTask'));
const projectDisplayValue = computed(() => contextLabel.value ?? t('timerView.noProject'));
const canAssignProject = computed(() => !!(props.group.taskId || props.group.taskName));
const slotInputUi = { root: 'min-w-0 w-full max-w-full', base: 'min-w-0 truncate' };

const entryCount = computed(() => props.group.entries.length);
const countLabel = computed(() => {
  const count = entryCount.value;
  return t('timerView.entryCount', { count }, count);
});
const countDisplay = computed(() => (entryCount.value > 9 ? '9+' : String(entryCount.value)));

const actionLabel = computed(() => (props.isLive ? t('timer.stop') : t('timerView.continueLabel')));
const actionButtonUi = computed(() =>
  props.isLive
    ? {
        leadingIcon: 'origin-center motion-safe:animate-timer-stop-icon motion-reduce:animate-none',
      }
    : undefined,
);

function onActionClick() {
  if (props.isLive) {
    emit('stop');
    return;
  }
  emit('continue');
}

const showRemoteIssueControl = computed(() => !!props.tracker && !!props.group.taskId);
const remoteIssueRef = computed(() => props.group.remoteIssueRef);
const remoteIssueUnavailableLabel = computed(() =>
  props.group.projectId
    ? t('timerView.remoteIssue.unavailableNoTracker')
    : t('timerView.remoteIssue.unavailableNoProject'),
);

async function linkRemoteIssue(payload: {
  remoteIssueId: string;
  cachedTitle: string;
  cachedRemoteProjectTitle?: string;
}) {
  if (!props.group.taskId) return;
  const ids = props.group.entries.map((entry) => entry.id);
  if (ids.length === 0) return;
  try {
    await $csrfFetch('/api/time-entries/reassign', {
      method: 'POST',
      body: {
        ids,
        remoteIssueId: payload.remoteIssueId,
        cachedTitle: payload.cachedTitle,
        cachedRemoteProjectTitle: payload.cachedRemoteProjectTitle,
      },
    });
    emit('entry-changed');
  } catch (err: unknown) {
    toast.error(t(extractMessageKey(err, 'errors.unexpected')));
  }
}

async function unlinkRemoteIssue() {
  if (!props.group.taskId) return;
  const ids = props.group.entries.map((entry) => entry.id);
  if (ids.length === 0) return;
  try {
    await $csrfFetch('/api/time-entries/reassign', {
      method: 'POST',
      body: { ids, remoteIssueId: null },
    });
    emit('entry-changed');
  } catch (err: unknown) {
    toast.error(t(extractMessageKey(err, 'errors.unexpected')));
  }
}
</script>

<template>
  <div class="border-b border-default py-1" :data-testid="`timer-group-${group.key}`">
    <div
      class="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-x-2 gap-y-1 [grid-template-areas:'toggle_title_duration_action'_'._project_meta_meta'] lg:flex lg:flex-nowrap lg:gap-3"
      data-testid="timer-group-header-controls"
    >
      <div class="[grid-area:toggle] shrink-0">
        <UButton
          :icon="expanded ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
          variant="ghost"
          square
          size="xs"
          :aria-label="expanded ? t('timerView.collapseLabel') : t('timerView.expandLabel')"
          :aria-expanded="expanded"
          :aria-controls="entriesId"
          :data-testid="`timer-group-toggle-${group.key}`"
          @click="expanded = !expanded"
        />
      </div>

      <div class="flex min-w-0 items-center gap-2 [grid-area:title] lg:min-w-0 lg:flex-1">
        <UBadge
          color="neutral"
          variant="subtle"
          size="sm"
          class="w-5 shrink-0 justify-center tabular-nums"
          :aria-label="countLabel"
          :data-testid="`timer-group-count-${group.key}`"
        >
          {{ countDisplay }}
        </UBadge>
        <div class="min-w-0 flex-1">
          <UInput
            v-if="editingTitle"
            v-model="titleValue"
            variant="ghost"
            size="xs"
            class="w-full min-w-0 max-w-full"
            :ui="slotInputUi"
            :placeholder="t('timerView.noTask')"
            :aria-label="t('timerView.editLabel')"
            :data-testid="`timer-group-title-input-${group.key}`"
            @blur="commitTitle"
            @keydown.enter="commitTitle"
            @keydown.esc="cancelTitleEdit"
          />
          <OverflowTooltip v-else :text="titleDisplayValue">
            <UInput
              :model-value="titleDisplayValue"
              variant="none"
              readonly
              size="xs"
              class="w-full min-w-0 max-w-full cursor-pointer font-medium"
              :ui="slotInputUi"
              :aria-label="t('timerView.editLabel')"
              :data-testid="`timer-group-title-${group.key}`"
              @focus="beginTitleEdit"
              @click.stop="beginTitleEdit"
            />
          </OverflowTooltip>
        </div>
      </div>

      <div class="w-48 min-w-0 max-w-full shrink-0 justify-self-start [grid-area:project]">
        <UButton
          v-if="!canAssignProject"
          variant="ghost"
          color="neutral"
          size="xs"
          disabled
          class="w-full justify-start truncate text-muted disabled:opacity-40"
          :label="projectDisplayValue"
          :aria-label="t('timerView.projectRequiresTitle')"
          :title="t('timerView.projectRequiresTitle')"
          :data-testid="`timer-group-project-${group.key}`"
        />
        <UPopover
          v-else
          :open="projectSelectOpen"
          :modal="false"
          :content="{ side: 'bottom', align: 'start', sideOffset: 4 }"
          @update:open="onProjectOpen"
        >
          <OverflowTooltip class="w-full" :text="projectDisplayValue">
            <UButton
              variant="ghost"
              color="neutral"
              size="xs"
              class="w-full justify-start truncate text-muted"
              :label="projectDisplayValue"
              :aria-label="t('timerView.editor.projectLabel')"
              :data-testid="`timer-group-project-${group.key}`"
            />
          </OverflowTooltip>
          <template #content>
            <div
              class="flex max-h-60 min-w-48 flex-col overflow-auto p-1"
              role="listbox"
              :aria-label="t('timerView.editor.projectLabel')"
              :data-testid="`timer-group-project-select-${group.key}`"
            >
              <UButton
                variant="ghost"
                color="neutral"
                class="w-full justify-start"
                role="option"
                :label="t('timerView.noProject')"
                data-testid="timer-group-project-option-none"
                @click.stop="commitProject(null)"
              />
              <UButton
                v-for="option in projectSelectOptions"
                :key="option.id"
                variant="ghost"
                color="neutral"
                class="w-full justify-start"
                role="option"
                :label="option.name"
                :data-testid="`timer-group-project-option-${option.id}`"
                @click.stop="commitProject(option.id)"
              />
            </div>
          </template>
        </UPopover>
      </div>

      <div class="flex min-w-0 items-center gap-2 [grid-area:meta] lg:contents">
        <RemoteIssuePicker
          v-if="showRemoteIssueControl"
          :config="tracker!"
          :current-ref="remoteIssueRef"
          class="shrink-0"
          :link-testid="`timer-group-remote-issue-link-${group.key}`"
          :cached-testid="`timer-group-remote-issue-cached-${group.key}`"
          :unlinked-testid="`timer-group-remote-issue-unlinked-${group.key}`"
          :data-testid="`timer-group-remote-issue-picker-${group.key}`"
          @link="linkRemoteIssue"
          @unlink="unlinkRemoteIssue"
        />
        <UButton
          v-else
          icon="i-lucide-link-2-off"
          color="neutral"
          variant="ghost"
          square
          size="xs"
          disabled
          class="h-6 w-6 shrink-0 justify-center text-dimmed disabled:opacity-40"
          :aria-label="remoteIssueUnavailableLabel"
          :title="remoteIssueUnavailableLabel"
          :data-testid="`timer-group-remote-issue-disabled-${group.key}`"
        />
      </div>

      <span
        class="min-w-[4.5rem] text-right font-mono text-sm font-medium tabular-nums text-muted [grid-area:duration]"
        :data-testid="`timer-group-total-${group.key}`"
      >
        {{ formatDuration(group.totalSeconds) }}
      </span>

      <div class="shrink-0 [grid-area:action]">
        <UButton
          :icon="isLive ? 'i-lucide-square' : 'i-lucide-play'"
          variant="ghost"
          square
          size="xs"
          :color="isLive ? 'error' : undefined"
          :ui="actionButtonUi"
          :aria-label="actionLabel"
          :aria-pressed="isLive"
          :data-testid="`timer-group-continue-${group.key}`"
          @click="onActionClick"
        />
      </div>
    </div>

    <div
      v-if="expanded"
      :id="entriesId"
      class="grid gap-0.5 py-1 pr-0 pl-7"
      :data-testid="`timer-group-entries-${group.key}`"
    >
      <TimerEntryRow
        v-for="entry in group.entries"
        :key="entry.id"
        :entry="entry"
        :now="now"
        :time-zone="timeZone"
        @changed="emit('entry-changed')"
        @deleted="emit('entry-deleted')"
      />
    </div>
  </div>
</template>
