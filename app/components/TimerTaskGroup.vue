<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { TimerViewGroup } from '~/utils/timerViewGrouping';
import { UNTITLED_GROUP_KEY } from '~/utils/timerViewGrouping';
import { formatDuration } from '~/utils/formatDuration';
import type { RemoteSystemConfigDto } from '../../shared/types/remote-system-config';

const props = withDefaults(
  defineProps<{
    group: TimerViewGroup;
    isLive: boolean;
    now: number;
    timeZone: string;
    editorKey: string;
    activeEditorKey?: string | null;
    projectOptions?: ProjectDto[];
    remoteConfig?: RemoteSystemConfigDto | null;
  }>(),
  { activeEditorKey: null, projectOptions: () => [], remoteConfig: null },
);

const emit = defineEmits<{
  continue: [];
  'bulk-assign': [];
  'entry-changed': [];
  'entry-deleted': [];
  'editing-started': [];
}>();

const { t } = useI18n();
const toast = useAppToast();
const { $csrfFetch } = useNuxtApp();

const expanded = ref(false);
const entriesId = computed(() => `timer-group-entries-${props.group.key}`);
const isUntitled = computed(() => props.group.key === UNTITLED_GROUP_KEY);
const editingTitle = ref(false);
const titleValue = ref('');
const editingProject = ref(false);
const projectValue = ref<string | undefined>(undefined);
watch(
  () => props.activeEditorKey,
  (activeKey) => {
    if (activeKey === props.editorKey) return;
    editingTitle.value = false;
    editingProject.value = false;
  },
);

const contextLabel = computed(() => {
  if (!props.group.projectName) return null;
  return props.group.clientName
    ? `${props.group.projectName} · ${props.group.clientName}`
    : props.group.projectName;
});

const projectSelectOptions = computed(() => {
  if (!props.group.projectId || props.projectOptions.some((p) => p.id === props.group.projectId)) {
    return props.projectOptions;
  }
  return [
    ...props.projectOptions,
    {
      id: props.group.projectId,
      name: props.group.projectName ?? '',
      clientId: '',
      clientName: props.group.clientName ?? '',
      createdAt: '',
    },
  ];
});

async function beginTitleEdit() {
  emit('editing-started');
  editingProject.value = false;
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
  if (!editingTitle.value || !props.group.taskId) return;
  editingTitle.value = false;
  const name = titleValue.value.trim();
  if (!name || name === props.group.taskName) return;
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

async function beginProjectEdit() {
  emit('editing-started');
  editingTitle.value = false;
  projectValue.value = props.group.projectId ?? undefined;
  editingProject.value = true;
}

async function commitProject(value: string | null | undefined) {
  if (!editingProject.value || !props.group.taskId) return;
  editingProject.value = false;
  if (value === props.group.projectId) return;
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

const titleInputWidth = computed(() => `${Math.max(titleValue.value.length, 8) + 3}ch`);
const titleDisplayValue = computed(() => props.group.taskName ?? '');
const titleDisplayWidth = computed(() => `${Math.max(titleDisplayValue.value.length, 8) + 3}ch`);
const projectDisplayValue = computed(() => contextLabel.value ?? t('timerView.noProject'));
const projectSelectWidth = computed(() => {
  const selected = projectSelectOptions.value.find((p) => p.id === projectValue.value);
  const label = selected ? selected.name : t('timerView.noProject');
  return `${Math.ceil(Math.max(label.length, projectDisplayValue.value.length, 8) + 4)}ch`;
});
const projectDisplayWidth = computed(
  () => `${Math.max(projectDisplayValue.value.length, 8) + 4}ch`,
);

const countLabel = computed(() => {
  const count = props.group.entries.length;
  return count === 1
    ? t('timerView.entryCountOne', { count })
    : t('timerView.entryCount', { count });
});

const showRemoteIssueControl = computed(() => !!props.remoteConfig && !!props.group.taskId);
const remoteIssueRef = computed(() => props.group.remoteIssueRef);
const remoteIssueTooltip = computed(() =>
  remoteIssueRef.value
    ? `${t('timerView.remoteIssue.linkedTooltipPrefix')} #${remoteIssueRef.value.remoteIssueId}: ${remoteIssueRef.value.cachedTitle}`
    : undefined,
);

async function linkRemoteIssue(payload: { remoteIssueId: string; cachedTitle: string }) {
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
  <div class="border-b border-default py-2" :data-testid="`timer-group-${group.key}`">
    <div class="flex items-center gap-3">
      <div
        class="timer-group__toggle flex min-w-0 flex-1 items-center gap-2 text-left"
        data-testid="timer-group-header-controls"
      >
        <UButton
          :icon="expanded ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
          variant="ghost"
          square
          :aria-label="expanded ? t('timerView.collapseLabel') : t('timerView.expandLabel')"
          :aria-expanded="expanded"
          :aria-controls="entriesId"
          :data-testid="`timer-group-toggle-${group.key}`"
          @click="expanded = !expanded"
        />
        <UInput
          v-if="editingTitle"
          v-model="titleValue"
          variant="ghost"
          class="max-w-full"
          :style="{ width: titleInputWidth }"
          :aria-label="t('timerView.editLabel')"
          :data-testid="`timer-group-title-input-${group.key}`"
          @blur="commitTitle"
          @keydown.enter="commitTitle"
          @keydown.esc="cancelTitleEdit"
        />
        <UInput
          v-else-if="!isUntitled"
          :model-value="titleDisplayValue"
          variant="none"
          readonly
          class="max-w-full cursor-pointer font-medium"
          :style="{ width: titleDisplayWidth }"
          :aria-label="t('timerView.editLabel')"
          :data-testid="`timer-group-title-${group.key}`"
          @focus="beginTitleEdit"
          @click.stop="beginTitleEdit"
        />
        <span v-else class="font-medium">{{ t('timerView.noTask') }}</span>
        <USelect
          v-if="editingProject"
          v-model="projectValue"
          :items="projectSelectOptions"
          label-key="name"
          value-key="id"
          class="max-w-full"
          :style="{ width: projectSelectWidth }"
          :aria-label="t('timerView.editor.projectLabel')"
          :data-testid="`timer-group-project-select-${group.key}`"
          @update:model-value="commitProject"
        />
        <UInput
          v-else-if="!isUntitled"
          :model-value="projectDisplayValue"
          variant="none"
          readonly
          class="max-w-full cursor-pointer text-sm text-muted"
          :style="{ width: projectDisplayWidth }"
          :aria-label="t('timerView.editor.projectLabel')"
          :data-testid="`timer-group-project-${group.key}`"
          @focus="beginProjectEdit"
          @click.stop="beginProjectEdit"
        />
      </div>

      <span class="text-sm text-muted">{{ countLabel }}</span>

      <span
        v-if="isLive"
        class="text-sm font-semibold text-primary"
        :data-testid="`timer-group-live-${group.key}`"
      >
        {{ t('timerView.liveLabel') }}
      </span>

      <span
        class="min-w-[4.5rem] text-right font-mono"
        :data-testid="`timer-group-total-${group.key}`"
      >
        {{ formatDuration(group.totalSeconds) }}
      </span>

      <template v-if="showRemoteIssueControl">
        <UButton
          v-if="remoteIssueRef && remoteIssueRef.url"
          :to="remoteIssueRef.url"
          target="_blank"
          external
          variant="link"
          class="font-mono text-sm"
          :label="`#${remoteIssueRef.remoteIssueId}`"
          :title="remoteIssueTooltip"
          :data-testid="`timer-group-remote-issue-link-${group.key}`"
        />
        <span
          v-else-if="remoteIssueRef"
          :title="remoteIssueTooltip"
          class="font-mono text-sm text-primary"
          :data-testid="`timer-group-remote-issue-cached-${group.key}`"
        >
          #{{ remoteIssueRef.remoteIssueId }}
        </span>
        <span
          v-else
          class="text-sm text-muted"
          :data-testid="`timer-group-remote-issue-unlinked-${group.key}`"
        >
          {{ t('timerView.remoteIssue.unlinked') }}
        </span>

        <RemoteIssuePicker
          :config="remoteConfig!"
          :current-ref="remoteIssueRef"
          :data-testid="`timer-group-remote-issue-picker-${group.key}`"
          @link="linkRemoteIssue"
          @unlink="unlinkRemoteIssue"
        />
      </template>

      <UButton
        v-if="!isUntitled"
        icon="i-lucide-play"
        variant="ghost"
        square
        :aria-label="t('timerView.continueLabel')"
        :data-testid="`timer-group-continue-${group.key}`"
        @click="emit('continue')"
      />
      <UButton
        v-else
        :label="t('timerView.bulkAssign.buttonLabel')"
        icon="i-lucide-tag"
        variant="ghost"
        :data-testid="`timer-group-bulk-assign-${group.key}`"
        @click="emit('bulk-assign')"
      />
    </div>

    <div
      v-if="expanded"
      :id="entriesId"
      class="grid gap-1 py-2 pr-0 pl-7"
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
