<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { instantToZoned, wallClockToInstant, toPickerDate, fromPickerDate } from '~/utils/dateTime';
import { buildTaskTitleMenuItems, TASK_TITLE_CREATE_ITEM_ID } from '~/utils/taskTitleMenu';
import type { TaskDto } from '../../shared/types/task';

const { t } = useI18n();
const { running, elapsedSeconds, loading, start, stop, updateTitle, updateStartedAt } = useTimer();
const { effective } = useUserSettings();

const title = ref('');
const editedTitle = ref('');
const selectedTaskId = ref<string | null>(null);
const selectedTaskName = ref<string | null>(null);
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
    selectedTaskId.value = running.value?.taskId ?? null;
    selectedTaskName.value = taskName;
  },
  { immediate: true },
);

// Close start editor if the timer stops while the popover is open.
watch(isRunning, (running) => {
  if (!running) {
    startEditorOpen.value = false;
  }
});

const displayedTitle = computed(() => (isRunning.value ? editedTitle.value : title.value));

/**
 * Menu items use a string `name` as the model value (autocomplete mode
 * stringifies objects to "[object Object]"). `onSelect` captures the
 * concrete task id before the model update lands.
 */
const menuItems = computed(() =>
  buildTaskTitleMenuItems({
    suggestions: suggestions.value,
    searchText: searchTerm.value ?? '',
    noProjectLabel: t('timer.noTask'),
    createOptionLabel: (typed) => t('timer.createOption', { title: typed }),
    onSelectTask: (task) => {
      selectedTaskId.value = task.id;
      selectedTaskName.value = task.name;
    },
    onSelectCreate: (typed) => {
      // Clear any previously captured task identity so start is freeform.
      selectedTaskId.value = null;
      selectedTaskName.value = null;
      if (isRunning.value) {
        editedTitle.value = typed;
      } else {
        title.value = typed;
      }
      overlayOpen.value = false;
    },
  }),
);

const elapsedLabel = computed(() => {
  const total = elapsedSeconds.value;
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
});

async function search(query: string) {
  suggestions.value = await $fetch<TaskDto[]>('/api/tasks', { query: { search: query } });
}

watch(searchTerm, (query) => {
  void search(query ?? '');
});

function applyFreeformTitle(text: string) {
  selectedTaskId.value = null;
  selectedTaskName.value = null;
  if (isRunning.value) {
    editedTitle.value = text;
  } else {
    title.value = text;
  }
  searchTerm.value = text;
}

function applySelectedTitle(name: string, taskId: string) {
  selectedTaskId.value = taskId;
  selectedTaskName.value = name;
  if (isRunning.value) {
    editedTitle.value = name;
  } else {
    title.value = name;
  }
  searchTerm.value = name;
}

function onTitleModelUpdate(value: string | { name?: string; id?: string } | null | undefined) {
  // Autocomplete + value-key="name" yields the task name string. Object
  // payloads are still handled defensively (e.g. tests / future UI changes).
  if (value && typeof value === 'object') {
    const name = typeof value.name === 'string' ? value.name : '';
    const taskId = typeof value.id === 'string' ? value.id : selectedTaskId.value;
    if (taskId === TASK_TITLE_CREATE_ITEM_ID) {
      applyFreeformTitle(name);
      overlayOpen.value = false;
      return;
    }
    if (taskId && name) {
      applySelectedTitle(name, taskId);
      if (isRunning.value) {
        void updateTitle(name, taskId);
      }
      return;
    }
  }

  const text = typeof value === 'string' ? value : '';

  // Selection path: item onSelect already stashed the task id for this name.
  // Create-sentinel onSelect clears the id so this branch is skipped (freeform).
  if (selectedTaskId.value && selectedTaskName.value === text) {
    applySelectedTitle(text, selectedTaskId.value);
    if (isRunning.value) {
      void updateTitle(text, selectedTaskId.value);
    }
    return;
  }

  applyFreeformTitle(text);
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
      // UInputMenu autocomplete keeps typed text in `searchTerm` until a menu
      // item commits `model-value`. Commit freeform text before starting so a
      // typed title is not dropped as an untitled entry.
      if (!selectedTaskId.value) {
        const typed = (searchTerm.value ?? '').trim();
        if (typed) {
          title.value = typed;
        }
      }
      await start(title.value || undefined, undefined, selectedTaskId.value);
      title.value = '';
      searchTerm.value = '';
      selectedTaskId.value = null;
      selectedTaskName.value = null;
    } finally {
      starting.value = false;
    }
  }
}

async function onBlur() {
  if (isRunning.value) {
    await updateTitle(editedTitle.value, selectedTaskId.value);
  }
}

async function onEnter() {
  if (overlayOpen.value) return;
  if (isRunning.value) {
    await updateTitle(editedTitle.value, selectedTaskId.value);
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
</script>

<template>
  <div class="flex w-full min-w-0 items-center gap-2" data-testid="app-timer">
    <UInputMenu
      v-model:search-term="searchTerm"
      v-model:open="overlayOpen"
      :model-value="displayedTitle"
      :items="menuItems"
      value-key="name"
      label-key="label"
      :disabled="isLoading"
      :placeholder="isRunning ? undefined : t('timer.titlePlaceholder')"
      :aria-label="t('timer.titleLabel')"
      mode="autocomplete"
      ignore-filter
      class="min-w-0 flex-1"
      data-testid="timer-title-input"
      @update:model-value="onTitleModelUpdate"
      @blur="onBlur"
      @keydown.enter="onEnter"
    />

    <!--
      Always UButton for consistent mono size. Idle: disabled (no popover).
      Running: opens start-time editor.
    -->
    <UPopover v-model:open="startEditorOpen">
      <UButton
        color="neutral"
        variant="link"
        class="min-w-[4.5rem] font-mono tabular-nums"
        role="timer"
        :label="elapsedLabel"
        :aria-label="isRunning ? t('timer.editStartLabel') : t('timer.elapsedLabel')"
        :disabled="!isRunning"
        data-testid="timer-elapsed"
        @click="openStartEditor"
      />
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
      square
      variant="ghost"
      :icon="isRunning ? 'i-lucide-square' : 'i-lucide-play'"
      :aria-label="isRunning ? t('timer.stop') : t('timer.start')"
      :color="isRunning ? 'error' : 'primary'"
      :ui="
        isRunning
          ? {
              // Pulse icon color only — not the button chrome / background.
              leadingIcon: 'motion-safe:animate-timer-stop-icon motion-reduce:animate-none',
            }
          : undefined
      "
      :loading="starting || stopping"
      :disabled="isLoading"
      :aria-pressed="isRunning"
      data-testid="timer-toggle-button"
      @click="onToggle"
    />
  </div>
</template>
