<script setup lang="ts">
import type { TimerViewGroup } from '~/utils/timer-view-grouping';
import type { RemoteIssueScope } from '@osi/remote-trackers/contracts';
import type { TrackerDto } from '../../shared/types/tracker';
import type { ColumnDefinition } from './ColumnList.vue';

const {
  group,
  isLive,
  now,
  timeZone,
  editorKey,
  activeEditorKey = null,
  projectOptions = [],
  tracker = null,
  scope = null,
  columns,
} = defineProps<{
  columns: readonly ColumnDefinition<
    'toggle' | 'count' | 'title' | 'project' | 'issue' | 'duration' | 'action'
  >[];
  group: TimerViewGroup;
  isLive: boolean;
  /** Current time for the running entry's live duration; constant for groups without one. */
  now: number;
  timeZone: string;
  editorKey: string;
  activeEditorKey?: string | null;
  projectOptions?: ProjectDto[];
  tracker?: TrackerDto | null;
  /** The owning project's remote project scope (REQ-328), if any. */
  scope?: (RemoteIssueScope & { remoteProjectTitle: string }) | null;
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
      remoteProjectId: null,
      remoteProjectTitle: null,
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
  <ColumnRow :data-testid="`timer-group-${group.key}`" :joined="expanded">
    <ColumnCell :columns="columns" col="toggle" :narrow="{ col: [1, 2], row: 1 }">
      <UTooltip
        :text="expanded ? t('timerView.collapseLabel') : t('timerView.expandLabel')"
        :content="{ side: 'top' }"
      >
        <UButton
          :icon="expanded ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
          variant="ghost"
          color="neutral"
          square
          size="xs"
          :aria-label="expanded ? t('timerView.collapseLabel') : t('timerView.expandLabel')"
          :aria-expanded="expanded"
          :aria-controls="entriesId"
          :data-testid="`timer-group-toggle-${group.key}`"
          @click="expanded = !expanded"
        />
      </UTooltip>
    </ColumnCell>
    <ColumnCell :columns="columns" col="count" :narrow="{ col: [2, 3], row: 1 }">
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
    </ColumnCell>
    <ColumnCell :columns="columns" col="title" :narrow="{ col: [3, 5], row: 1 }">
      <InlineEditText
        v-model="titleValue"
        :editing="editingTitle"
        :display-value="titleDisplayValue"
        :field-label="t('timerView.editLabel')"
        :display-testid="`timer-group-title-${group.key}`"
        :input-testid="`timer-group-title-input-${group.key}`"
        :placeholder="t('timerView.noTask')"
        :display-class="group.taskName ? 'font-medium text-default' : 'text-dimmed'"
        @edit="beginTitleEdit"
        @commit="commitTitle"
        @cancel="cancelTitleEdit"
      />
    </ColumnCell>

    <ColumnCell :columns="columns" col="project" :narrow="{ col: [3, 4], row: 2 }">
      <div class="min-w-0">
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
              class="-ms-2 w-[calc(100%+0.5rem)] max-w-[calc(100%+0.5rem)] justify-start truncate font-normal text-muted disabled:opacity-40"
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
              class="-ms-2 w-[calc(100%+0.5rem)] max-w-[calc(100%+0.5rem)] justify-start truncate font-normal text-muted"
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
    </ColumnCell>

    <ColumnCell :columns="columns" col="issue" :narrow="{ col: [4, 5], row: 2 }">
      <RemoteIssuePicker
        v-if="showRemoteIssueControl"
        :config="tracker!"
        :current-ref="remoteIssueRef"
        :scope="scope"
        class="min-w-0"
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
            class="-ms-1 h-6 w-6 shrink-0 justify-center text-dimmed disabled:opacity-40"
            :aria-label="remoteIssueUnavailableLabel"
            :data-testid="`timer-group-remote-issue-disabled-${group.key}`"
          />
        </span>
      </UTooltip>
    </ColumnCell>

    <ColumnCell :columns="columns" col="duration" align="end" :narrow="{ col: [5, 6], row: 1 }">
      <span
        class="block text-right font-mono text-sm font-medium tabular-nums text-muted"
        :data-testid="`timer-group-total-${group.key}`"
      >
        {{ formatDuration(group.totalSeconds + liveSeconds(group.liveStartedAt, now)) }}
      </span>
    </ColumnCell>

    <ColumnCell :columns="columns" col="action" :narrow="{ col: [6, 7], row: 1 }">
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
    </ColumnCell>
  </ColumnRow>

  <ColumnDetail v-if="expanded" :id="entriesId" :data-testid="`timer-group-entries-${group.key}`">
    <TimerEntryRow
      v-for="entry in group.entries"
      :key="entry.id"
      :columns="columns"
      :entry="entry"
      :now="entry.stoppedAt ? 0 : now"
      :time-zone="timeZone"
      @changed="emit('entry-changed')"
      @deleted="emit('entry-deleted')"
    />
  </ColumnDetail>
</template>
