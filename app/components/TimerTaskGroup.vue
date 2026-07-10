<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { TimerViewGroup } from '~/utils/timerViewGrouping';
import { UNTITLED_GROUP_KEY } from '~/utils/timerViewGrouping';
import { formatDuration } from '~/utils/formatDuration';
import { useToast } from 'primevue/usetoast';

const props = withDefaults(
  defineProps<{
    group: TimerViewGroup;
    isLive: boolean;
    now: number;
    editorKey: string;
    activeEditorKey?: string | null;
    projectOptions?: ProjectDto[];
  }>(),
  { activeEditorKey: null, projectOptions: () => [] },
);

const emit = defineEmits<{
  continue: [];
  'bulk-assign': [];
  'entry-changed': [];
  'entry-deleted': [];
  'editing-started': [];
}>();

const { t } = useI18n();
const toast = useToast();
const { $csrfFetch } = useNuxtApp();

const expanded = ref(false);
const entriesId = computed(() => `timer-group-entries-${props.group.key}`);
const isUntitled = computed(() => props.group.key === UNTITLED_GROUP_KEY);
const editingTitle = ref(false);
const titleValue = ref('');
const editingProject = ref(false);
const projectValue = ref<string | null>(null);
const projectSelect = ref<{ show: () => void; hide: () => void }>();

watch(
  () => props.activeEditorKey,
  (activeKey) => {
    if (activeKey === props.editorKey) return;
    projectSelect.value?.hide();
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
  projectSelect.value?.hide();
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
  try {
    await $csrfFetch(`/api/tasks/${props.group.taskId}`, { method: 'PATCH', body: { name } });
    emit('entry-changed');
  } catch (err: unknown) {
    toast.add({
      severity: 'error',
      summary: t(extractMessageKey(err, 'errors.unexpected')),
      life: 4000,
    });
  }
}

async function beginProjectEdit() {
  emit('editing-started');
  editingTitle.value = false;
  projectValue.value = props.group.projectId;
  editingProject.value = true;
  await nextTick();
  projectSelect.value?.show();
}

async function commitProject(value: string | null) {
  if (!props.group.taskId) return;
  editingProject.value = false;
  if (value === props.group.projectId) return;
  try {
    await $csrfFetch(`/api/tasks/${props.group.taskId}`, {
      method: 'PATCH',
      body: { name: props.group.taskName, projectId: value },
    });
    emit('entry-changed');
  } catch (err: unknown) {
    toast.add({
      severity: 'error',
      summary: t(extractMessageKey(err, 'errors.unexpected')),
      life: 4000,
    });
  }
}

const countLabel = computed(() => {
  const count = props.group.entries.length;
  return count === 1
    ? t('timerView.entryCountOne', { count })
    : t('timerView.entryCount', { count });
});
</script>

<template>
  <div class="timer-group" :data-testid="`timer-group-${group.key}`">
    <div class="timer-group__row">
      <div class="timer-group__toggle">
        <Button
          :icon="expanded ? 'pi pi-chevron-down' : 'pi pi-chevron-right'"
          text
          rounded
          :aria-label="expanded ? t('timerView.collapseLabel') : t('timerView.expandLabel')"
          :aria-expanded="expanded"
          :aria-controls="entriesId"
          :data-testid="`timer-group-toggle-${group.key}`"
          @click="expanded = !expanded"
        />
        <InputText
          v-if="editingTitle"
          v-model="titleValue"
          :aria-label="t('timerView.editLabel')"
          :data-testid="`timer-group-title-input-${group.key}`"
          @blur="commitTitle"
          @keydown.enter="commitTitle"
          @keydown.esc="cancelTitleEdit"
        />
        <Button
          v-else-if="!isUntitled"
          class="timer-group__inline-button timer-group__name"
          text
          :label="group.taskName ?? ''"
          :aria-label="t('timerView.editLabel')"
          :data-testid="`timer-group-title-${group.key}`"
          @click.stop="beginTitleEdit"
        />
        <span v-else class="timer-group__name">{{ t('timerView.noTask') }}</span>
        <Select
          v-if="editingProject"
          ref="projectSelect"
          v-model="projectValue"
          :options="projectSelectOptions"
          option-label="name"
          option-value="id"
          show-clear
          :aria-label="t('timerView.editor.projectLabel')"
          :data-testid="`timer-group-project-select-${group.key}`"
          @update:model-value="commitProject"
        />
        <Button
          v-else-if="!isUntitled"
          class="timer-group__inline-button timer-group__context"
          text
          :label="contextLabel ?? t('timerView.noProject')"
          :aria-label="t('timerView.editor.projectLabel')"
          :data-testid="`timer-group-project-${group.key}`"
          @click.stop="beginProjectEdit"
        />
      </div>

      <span class="timer-group__count">{{ countLabel }}</span>

      <span v-if="isLive" class="timer-group__live" :data-testid="`timer-group-live-${group.key}`">
        {{ t('timerView.liveLabel') }}
      </span>

      <span class="timer-group__total" :data-testid="`timer-group-total-${group.key}`">
        {{ formatDuration(group.totalSeconds) }}
      </span>

      <Button
        v-if="!isUntitled"
        icon="pi pi-play"
        text
        rounded
        :aria-label="t('timerView.continueLabel')"
        :data-testid="`timer-group-continue-${group.key}`"
        @click="emit('continue')"
      />
      <Button
        v-else
        :label="t('timerView.bulkAssign.buttonLabel')"
        icon="pi pi-tag"
        text
        :data-testid="`timer-group-bulk-assign-${group.key}`"
        @click="emit('bulk-assign')"
      />
    </div>

    <div
      v-if="expanded"
      :id="entriesId"
      class="timer-group__entries"
      :data-testid="`timer-group-entries-${group.key}`"
    >
      <TimerEntryRow
        v-for="entry in group.entries"
        :key="entry.id"
        :entry="entry"
        :now="now"
        @changed="emit('entry-changed')"
        @deleted="emit('entry-deleted')"
      />
    </div>
  </div>
</template>

<style scoped>
.timer-group {
  border-bottom: 1px solid var(--p-content-border-color);
  padding: 0.5rem 0;
}

.timer-group__row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.timer-group__toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
  text-align: left;
  color: inherit;
}

.timer-group__context {
  color: var(--p-text-muted-color);
  font-size: 0.875rem;
}

.timer-group__count {
  color: var(--p-text-muted-color);
  font-size: 0.875rem;
}

.timer-group__live {
  color: var(--p-primary-color);
  font-weight: 600;
  font-size: 0.875rem;
}

.timer-group__total {
  font-family: monospace;
  min-width: 4.5rem;
  text-align: right;
}

.timer-group__entries {
  display: grid;
  gap: 0.25rem;
  padding: 0.5rem 0 0.25rem 1.75rem;
}
</style>
