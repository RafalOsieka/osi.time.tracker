<script setup lang="ts">
import type { TimerViewGroup } from '~/utils/timer-view-grouping';
import type { TrackerDto } from '../../shared/types/tracker';

const {
  group,
  isLive,
  now,
  timeZone,
  editorKey,
  activeEditorKey = null,
  projectOptions = [],
  tracker = null,
} = defineProps<{
  group: TimerViewGroup;
  isLive: boolean;
  now: number;
  timeZone: string;
  editorKey: string;
  activeEditorKey?: string | null;
  projectOptions?: ProjectDto[];
  tracker?: TrackerDto | null;
}>();

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
const entriesId = computed(() => `timer-group-entries-${group.key}`);
const editingTitle = ref(false);
const titleValue = ref('');
const projectSelectOpen = ref(false);
watch(
  () => activeEditorKey,
  (activeKey) => {
    if (activeKey === editorKey) return;
    editingTitle.value = false;
    projectSelectOpen.value = false;
  },
);

const contextLabel = computed(() => group.projectName ?? null);

const projectSelectOptions = computed(() => {
  if (!group.projectId || projectOptions.some((p) => p.id === group.projectId)) {
    return projectOptions;
  }
  return [
    ...projectOptions,
    {
      id: group.projectId,
      name: group.projectName ?? '',
      trackerId: null,
      trackerName: null,
      createdAt: '',
    },
  ];
});

async function beginTitleEdit() {
  emit('editing-started');
  projectSelectOpen.value = false;
  titleValue.value = group.taskName ?? '';
  editingTitle.value = true;
  await nextTick();
  document
    .querySelector<HTMLInputElement>(`[data-testid="timer-group-title-input-${group.key}"]`)
    ?.focus();
}

function cancelTitleEdit() {
  editingTitle.value = false;
}

async function commitTitle() {
  if (!editingTitle.value) return;
  editingTitle.value = false;
  const name = titleValue.value.trim();
  if (!name || name === (group.taskName ?? '')) return;
  const ids = group.entries.map((entry) => entry.id);
  if (ids.length === 0) return;
  try {
    await $csrfFetch('/api/time-entries/reassign', {
      method: 'POST',
      body: { ids, name },
    });
    emit('entry-changed');
  } catch (err) {
    toast.error(t(extractCaughtMessageKey(err, 'errors.unexpected')));
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
  if (value === group.projectId) return;
  if (!group.taskId && !group.taskName) return;
  const ids = group.entries.map((entry) => entry.id);
  if (ids.length === 0) return;
  try {
    await $csrfFetch('/api/time-entries/reassign', {
      method: 'POST',
      body: { ids, projectId: value ?? null },
    });
    emit('entry-changed');
  } catch (err) {
    toast.error(t(extractCaughtMessageKey(err, 'errors.unexpected')));
  }
}

const titleDisplayValue = computed(() => group.taskName ?? t('timerView.noTask'));
const projectDisplayValue = computed(() => contextLabel.value ?? t('timerView.noProject'));
const canAssignProject = computed(() => !!(group.taskId || group.taskName));

const entryCount = computed(() => group.entries.length);
const countLabel = computed(() => {
  const count = entryCount.value;
  return t('timerView.entryCount', { count }, count);
});
const countDisplay = computed(() => (entryCount.value > 9 ? '9+' : String(entryCount.value)));

const actionLabel = computed(() => (isLive ? t('timer.stop') : t('timerView.continueLabel')));
const actionButtonUi = computed(() =>
  isLive
    ? {
        leadingIcon: 'origin-center motion-safe:animate-timer-stop-icon motion-reduce:animate-none',
      }
    : undefined,
);

function onActionClick() {
  if (isLive) {
    emit('stop');
    return;
  }
  emit('continue');
}

const showRemoteIssueControl = computed(() => !!tracker && !!group.taskId);
const remoteIssueRef = computed(() => group.remoteIssueRef);
const remoteIssueUnavailableLabel = computed(() =>
  group.projectId
    ? t('timerView.remoteIssue.unavailableNoTracker')
    : t('timerView.remoteIssue.unavailableNoProject'),
);

async function linkRemoteIssue(payload: {
  remoteIssueId: string;
  cachedTitle: string;
  cachedRemoteProjectTitle?: string;
}) {
  if (!group.taskId) return;
  const ids = group.entries.map((entry) => entry.id);
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
  } catch (err) {
    toast.error(t(extractCaughtMessageKey(err, 'errors.unexpected')));
  }
}

async function unlinkRemoteIssue() {
  if (!group.taskId) return;
  const ids = group.entries.map((entry) => entry.id);
  if (ids.length === 0) return;
  try {
    await $csrfFetch('/api/time-entries/reassign', {
      method: 'POST',
      body: { ids, remoteIssueId: null },
    });
    emit('entry-changed');
  } catch (err) {
    toast.error(t(extractCaughtMessageKey(err, 'errors.unexpected')));
  }
}
</script>

<template>
  <CompactExpandableRow
    :expanded="expanded"
    :expand-label="t('timerView.expandLabel')"
    :collapse-label="t('timerView.collapseLabel')"
    :expand-testid="`timer-group-toggle-${group.key}`"
    :details-id="entriesId"
    header-testid="timer-group-header-controls"
    :data-testid="`timer-group-${group.key}`"
    @toggle="expanded = !expanded"
  >
    <template #title>
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
      <InlineEditText
        v-model="titleValue"
        :editing="editingTitle"
        :display-value="titleDisplayValue"
        :field-label="t('timerView.editLabel')"
        :display-testid="`timer-group-title-${group.key}`"
        :input-testid="`timer-group-title-input-${group.key}`"
        :placeholder="t('timerView.noTask')"
        display-class="font-medium"
        @edit="beginTitleEdit"
        @commit="commitTitle"
        @cancel="cancelTitleEdit"
      />
    </template>

    <template #secondary>
      <div class="w-48 min-w-0 max-w-full">
        <UTooltip
          v-if="!canAssignProject"
          :text="t('timerView.projectRequiresTitle')"
          :content="{ side: 'top' }"
        >
          <span tabindex="0" class="inline-flex w-full min-w-0">
            <UButton
              variant="ghost"
              color="neutral"
              size="xs"
              disabled
              class="w-full justify-start truncate text-muted disabled:opacity-40"
              :label="projectDisplayValue"
              :aria-label="t('timerView.projectRequiresTitle')"
              :data-testid="`timer-group-project-${group.key}`"
            />
          </span>
        </UTooltip>
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
    </template>

    <template #meta>
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
      <UTooltip v-else :text="remoteIssueUnavailableLabel" :content="{ side: 'top' }">
        <span tabindex="0" class="inline-flex">
          <UButton
            icon="i-lucide-link-2-off"
            color="neutral"
            variant="ghost"
            square
            size="xs"
            disabled
            class="h-6 w-6 shrink-0 justify-center text-dimmed disabled:opacity-40"
            :aria-label="remoteIssueUnavailableLabel"
            :data-testid="`timer-group-remote-issue-disabled-${group.key}`"
          />
        </span>
      </UTooltip>
    </template>

    <template #duration>
      <span
        class="block min-w-[4.5rem] text-right font-mono text-sm font-medium tabular-nums text-muted"
        :data-testid="`timer-group-total-${group.key}`"
      >
        {{ formatDuration(group.totalSeconds) }}
      </span>
    </template>

    <template #action>
      <UTooltip :text="actionLabel" :content="{ side: 'top' }">
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
      </UTooltip>
    </template>

    <template #detail>
      <div class="grid gap-0.5" :data-testid="`timer-group-entries-${group.key}`">
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
    </template>
  </CompactExpandableRow>
</template>
