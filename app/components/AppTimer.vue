<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { instantToZoned, wallClockToInstant, toPickerDate, fromPickerDate } from '~/utils/dateTime';

const { t } = useI18n();
const { running, elapsedSeconds, loading, start, stop, updateTitle, updateStartedAt } = useTimer();
const { effective } = useUserSettings();

const title = ref('');
const editedTitle = ref('');
const suggestions = ref<TaskDto[]>([]);
const searchTerm = ref('');
const starting = ref(false);
const stopping = ref(false);
const overlayOpen = ref(false);

const startEditorOpen = ref(false);
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
    searchTerm.value = taskName ?? '';
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
    searchTerm.value = value;
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

async function search(query: string) {
  suggestions.value = await $fetch<TaskDto[]>('/api/tasks', { query: { search: query } });
}

watch(searchTerm, (query) => {
  void search(query ?? '');
});

function onSelectSuggestion(task: TaskDto) {
  if (isRunning.value) {
    editedTitle.value = task.name;
    searchTerm.value = task.name;
    void updateTitle(task.name);
  } else {
    title.value = task.name;
    searchTerm.value = task.name;
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
      searchTerm.value = '';
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

function openStartEditor() {
  if (!running.value) return;
  const current = instantToZoned(running.value.startedAt, effective.value.timeZone);
  startDateText.value = current.toPlainDate().toString();
  startDate.value = toPickerDate(startDateText.value, effective.value.timeZone);
  startTime.value = `${String(current.hour).padStart(2, '0')}:${String(current.minute).padStart(2, '0')}`;
  startEditorError.value = '';
  startEditorOpen.value = true;
}

function commitStartDateText() {
  const match = startDateText.value.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) {
    if (startDate.value) {
      startDateText.value = `${startDate.value.getFullYear()}-${String(startDate.value.getMonth() + 1).padStart(2, '0')}-${String(startDate.value.getDate()).padStart(2, '0')}`;
    }
    return;
  }
  startDateText.value = `${match[1]}-${String(Number(match[2])).padStart(2, '0')}-${String(Number(match[3])).padStart(2, '0')}`;
  try {
    startDate.value = toPickerDate(startDateText.value, effective.value.timeZone);
  } catch {
    startDateText.value = '';
  }
}

function combineStartedAt(): string | null {
  if (!startDate.value || !startTime.value) return null;
  return wallClockToInstant(
    fromPickerDate(startDate.value),
    startTime.value,
    effective.value.timeZone,
  );
}

async function onSaveStartedAt() {
  const combined = combineStartedAt();
  if (!combined) return;
  if (new Date(combined).getTime() > Date.now()) {
    startEditorError.value = t('error.timeEntryStartedAtInFuture');
    return;
  }
  savingStartedAt.value = true;
  try {
    await updateStartedAt(combined);
    startEditorOpen.value = false;
  } catch (err: unknown) {
    startEditorError.value = t(extractMessageKey(err, 'errors.unexpected'));
  } finally {
    savingStartedAt.value = false;
  }
}

// Autocomplete mode wants a free-form string model; cast items so the prop types accept it.
const titleMenuItems = computed(() => suggestions.value as unknown as string[]);
</script>

<template>
  <div class="flex items-center gap-2" data-testid="app-timer">
    <UInputMenu
      v-model="displayedTitle"
      v-model:search-term="searchTerm"
      :items="titleMenuItems"
      :disabled="isLoading"
      :placeholder="isRunning ? undefined : t('timer.titlePlaceholder')"
      :aria-label="t('timer.titleLabel')"
      mode="autocomplete"
      ignore-filter
      class="min-w-40"
      data-testid="timer-title-input"
      @update:open="(value: boolean) => (overlayOpen = value)"
      @blur="onBlur"
      @keydown.enter="onEnter"
    >
      <template #item-label="{ item }">
        <button
          type="button"
          class="w-full text-left"
          @click="onSelectSuggestion(item as unknown as TaskDto)"
        >
          {{ suggestionLabel(item as unknown as TaskDto) }}
        </button>
      </template>
    </UInputMenu>

    <UButton
      v-if="isRunning"
      color="neutral"
      variant="link"
      class="min-w-[4.5rem] font-mono"
      role="timer"
      :label="elapsedLabel"
      :aria-label="t('timer.editStartLabel')"
      data-testid="timer-elapsed"
      @click="openStartEditor"
    />
    <span
      v-else
      class="min-w-[4.5rem] font-mono text-default"
      role="timer"
      :aria-label="t('timer.elapsedLabel')"
      data-testid="timer-elapsed"
    >
      {{ elapsedLabel }}
    </span>

    <UPopover v-model:open="startEditorOpen">
      <span class="sr-only">{{ t('timer.editStartLabel') }}</span>
      <template #content>
        <div class="grid min-w-64 gap-3 p-3" data-testid="timer-start-editor-popover">
          <div class="grid gap-1">
            <label for="timer-start-editor-date">{{ t('timer.startEditor.dateLabel') }}</label>
            <UInput
              id="timer-start-editor-date"
              v-model="startDateText"
              type="date"
              data-testid="timer-start-editor-date-input"
              @blur="commitStartDateText"
              @keydown.enter.prevent="commitStartDateText"
              @change="
                () => {
                  if (startDateText) {
                    try {
                      startDate = toPickerDate(startDateText, effective.timeZone);
                    } catch {
                      /* ignore invalid */
                    }
                  }
                }
              "
            />
          </div>
          <div class="grid gap-1">
            <label for="timer-start-editor-time">{{ t('timer.startEditor.timeLabel') }}</label>
            <TimeInput
              id="timer-start-editor-time"
              v-model="startTime"
              :label="t('timer.startEditor.timeLabel')"
              :compact="false"
              testid="timer-start-editor-time-input"
            />
          </div>
          <p
            v-if="startEditorError"
            class="m-0 text-error"
            role="alert"
            data-testid="timer-start-editor-error"
          >
            {{ startEditorError }}
          </p>
          <div class="flex justify-end gap-2">
            <UButton
              color="neutral"
              variant="ghost"
              :label="t('timer.startEditor.cancelButton')"
              data-testid="timer-start-editor-cancel-button"
              @click="startEditorOpen = false"
            />
            <UButton
              :label="t('timer.startEditor.saveButton')"
              :loading="savingStartedAt"
              data-testid="timer-start-editor-save-button"
              @click="onSaveStartedAt"
            />
          </div>
        </div>
      </template>
    </UPopover>

    <UButton
      :label="isRunning ? t('timer.stop') : t('timer.start')"
      :color="isRunning ? 'error' : 'primary'"
      :loading="starting || stopping"
      :disabled="isLoading"
      :aria-pressed="isRunning"
      data-testid="timer-toggle-button"
      @click="onToggle"
    />
  </div>
</template>
