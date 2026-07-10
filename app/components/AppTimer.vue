<script setup lang="ts">
import type { AutoCompleteCompleteEvent } from 'primevue/autocomplete';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const { running, elapsedSeconds, loading, start, stop, updateTitle, updateStartedAt } = useTimer();

const title = ref('');
const editedTitle = ref('');
const suggestions = ref<TaskDto[]>([]);
const starting = ref(false);
const stopping = ref(false);
const overlayOpen = ref(false);

const startEditorPopover = ref();
const startDate = ref<Date | null>(null);
const startDateText = ref('');
const startTime = ref<string | null>(null);
const startEditorError = ref('');
const savingStartedAt = ref(false);

const isRunning = computed(() => running.value !== null);
const isLoading = computed(() => loading.value);

watch(
  () => running.value?.taskName ?? null,
  (taskName) => {
    editedTitle.value = taskName ?? '';
  },
  { immediate: true },
);

const displayedTitle = computed({
  get: () => (isRunning.value ? editedTitle.value : title.value),
  set: (value: string) => {
    if (isRunning.value) {
      editedTitle.value = value;
    } else {
      title.value = value;
    }
  },
});

const elapsedLabel = computed(() => {
  const total = elapsedSeconds.value;
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
});

function suggestionLabel(task: TaskDto): string {
  const context = task.projectName
    ? task.clientName
      ? `${task.projectName} · ${task.clientName}`
      : task.projectName
    : t('timer.noTask');
  return `${task.name} (${context})`;
}

async function search(event: AutoCompleteCompleteEvent) {
  const query = typeof event.query === 'string' ? event.query : '';
  suggestions.value = await $fetch<TaskDto[]>('/api/tasks', { query: { search: query } });
}

function onSelectSuggestion(task: TaskDto) {
  if (isRunning.value) {
    editedTitle.value = task.name;
    void updateTitle(task.name);
  } else {
    title.value = task.name;
  }
}

async function onToggle() {
  if (isRunning.value) {
    stopping.value = true;
    try {
      await stop();
    } finally {
      stopping.value = false;
    }
  } else {
    starting.value = true;
    try {
      await start(title.value || undefined, undefined);
      title.value = '';
    } finally {
      starting.value = false;
    }
  }
}

async function onBlur() {
  if (isRunning.value) {
    await updateTitle(editedTitle.value);
  }
}

async function onEnter() {
  if (overlayOpen.value) return;
  if (isRunning.value) {
    await updateTitle(editedTitle.value);
  } else if (!loading.value) {
    await onToggle();
  }
}

function openStartEditor(event: Event) {
  if (!running.value) return;
  const current = new Date(running.value.startedAt);
  startDate.value = current;
  startDateText.value = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
  startTime.value = `${String(current.getHours()).padStart(2, '0')}:${String(current.getMinutes()).padStart(2, '0')}`;
  startEditorError.value = '';
  startEditorPopover.value?.toggle(event);
}

function commitStartDateText() {
  const match = startDateText.value.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) {
    if (startDate.value) {
      startDateText.value = `${startDate.value.getFullYear()}-${String(startDate.value.getMonth() + 1).padStart(2, '0')}-${String(startDate.value.getDate()).padStart(2, '0')}`;
    }
    return;
  }
  const candidate = new Date(Number(match[1]!), Number(match[2]!) - 1, Number(match[3]!));
  if (
    candidate.getFullYear() !== Number(match[1]!) ||
    candidate.getMonth() !== Number(match[2]!) - 1 ||
    candidate.getDate() !== Number(match[3]!)
  ) {
    commitStartDateText();
    return;
  }
  startDate.value = candidate;
  startDateText.value = `${match[1]}-${String(candidate.getMonth() + 1).padStart(2, '0')}-${String(candidate.getDate()).padStart(2, '0')}`;
}

function onStartDateInput(event: Event) {
  const target = event.target as HTMLInputElement;
  if (target?.value !== undefined) startDateText.value = target.value;
}

function combineStartedAt(): Date | null {
  if (!startDate.value || !startTime.value) return null;
  const combined = new Date(startDate.value);
  const [hours = 0, minutes = 0] = startTime.value.split(':').map(Number);
  combined.setHours(hours, minutes, 0, 0);
  return combined;
}

async function onSaveStartedAt() {
  const combined = combineStartedAt();
  if (!combined) return;
  if (combined.getTime() > Date.now()) {
    startEditorError.value = t('error.timeEntryStartedAtInFuture');
    return;
  }
  savingStartedAt.value = true;
  try {
    await updateStartedAt(combined.toISOString());
    startEditorPopover.value?.hide();
  } catch (err: unknown) {
    startEditorError.value = t(extractMessageKey(err, 'errors.unexpected'));
  } finally {
    savingStartedAt.value = false;
  }
}
</script>

<template>
  <div class="app-timer" data-testid="app-timer">
    <AutoComplete
      v-model="displayedTitle"
      :suggestions="suggestions"
      option-label="name"
      :disabled="isLoading"
      :placeholder="isRunning ? undefined : t('timer.titlePlaceholder')"
      :aria-label="t('timer.titleLabel')"
      input-id="timer-title"
      data-testid="timer-title-input"
      @complete="search"
      @item-select="(e: { value: TaskDto }) => onSelectSuggestion(e.value)"
      @blur="onBlur"
      @keydown.enter="onEnter"
      @before-show="overlayOpen = true"
      @hide="overlayOpen = false"
    >
      <template #option="{ option }: { option: TaskDto }">
        {{ suggestionLabel(option) }}
      </template>
    </AutoComplete>

    <Button
      v-if="isRunning"
      class="app-timer__elapsed app-timer__elapsed-trigger"
      text
      :label="elapsedLabel"
      role="timer"
      :aria-label="t('timer.editStartLabel')"
      data-testid="timer-elapsed"
      @click="openStartEditor"
    />
    <span
      v-else
      class="app-timer__elapsed"
      role="timer"
      :aria-label="t('timer.elapsedLabel')"
      data-testid="timer-elapsed"
    >
      {{ elapsedLabel }}
    </span>

    <Popover ref="startEditorPopover" data-testid="timer-start-editor-popover">
      <div class="timer-start-editor">
        <div class="timer-start-editor__field">
          <label for="timer-start-editor-date">{{ t('timer.startEditor.dateLabel') }}</label>
          <DatePicker
            v-model="startDate"
            input-id="timer-start-editor-date"
            date-format="yy-mm-dd"
            show-icon
            data-testid="timer-start-editor-date-input"
            @input="onStartDateInput"
            @blur="commitStartDateText"
            @keydown.enter.prevent="commitStartDateText"
          />
        </div>
        <div class="timer-start-editor__field">
          <label for="timer-start-editor-time">{{ t('timer.startEditor.timeLabel') }}</label>
          <TimeInput
            id="timer-start-editor-time"
            v-model="startTime"
            :label="t('timer.startEditor.timeLabel')"
            testid="timer-start-editor-time-input"
          />
        </div>
        <p
          v-if="startEditorError"
          class="timer-start-editor__error"
          role="alert"
          data-testid="timer-start-editor-error"
        >
          {{ startEditorError }}
        </p>
        <div class="timer-start-editor__actions">
          <Button
            :label="t('timer.startEditor.cancelButton')"
            severity="secondary"
            text
            data-testid="timer-start-editor-cancel-button"
            @click="startEditorPopover?.hide()"
          />
          <Button
            :label="t('timer.startEditor.saveButton')"
            :loading="savingStartedAt"
            data-testid="timer-start-editor-save-button"
            @click="onSaveStartedAt"
          />
        </div>
      </div>
    </Popover>

    <Button
      :label="isRunning ? t('timer.stop') : t('timer.start')"
      :severity="isRunning ? 'danger' : 'primary'"
      :loading="starting || stopping"
      :disabled="isLoading"
      :aria-pressed="isRunning"
      data-testid="timer-toggle-button"
      @click="onToggle"
    />
  </div>
</template>

<style scoped>
.app-timer {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.app-timer__elapsed {
  min-width: 4.5rem;
  font-family: monospace;
  color: var(--p-text-color);
}

.app-timer__elapsed-trigger {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  text-align: left;
}

.timer-start-editor {
  display: grid;
  gap: 0.75rem;
  min-width: 16rem;
}

.timer-start-editor__field {
  display: grid;
  gap: 0.25rem;
}

.timer-start-editor__error {
  color: var(--p-red-500);
  margin: 0;
}

.timer-start-editor__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}
</style>
