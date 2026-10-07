<script setup lang="ts">
import {
  CalendarDate,
  parseDate,
  Time,
  toCalendarDateTime,
  toZoned,
} from '@internationalized/date';
import type { TitleProject, TitleTask } from '../utils/title-mention';

const { t } = useI18n();
const { running, elapsedSeconds, loading, start, stop, updateTitle, updateStartedAt } = useTimer();
const { effective } = useProfile();

const title = ref('');
const editedTitle = ref('');
/** Suggestion bound to the title text, if any (REQ-180). */
const boundTask = ref<TitleTask | null>(null);
/** Project chip (REQ-374). */
const chipProject = ref<TitleProject | null>(null);
const titleInput = useTemplateRef('titleInput');
const starting = ref(false);
const stopping = ref(false);

const startEditorOpen = ref(false);
const startCalendarOpen = ref(false);
const startDate = shallowRef<CalendarDate | null>(null);
const startTime = shallowRef<Time | null>(null);
const startEditorError = ref('');
const savingStartedAt = ref(false);

const isRunning = computed(() => running.value !== null);
const isLoading = computed(() => loading.value);

/** The running entry's title while a timer runs, the draft otherwise. */
const inputText = computed({
  get: () => (isRunning.value ? editedTitle.value : title.value),
  set: (value: string) => {
    if (isRunning.value) {
      editedTitle.value = value;
    } else {
      title.value = value;
    }
  },
});

watch(
  () => running.value?.taskName ?? null,
  (taskName) => {
    editedTitle.value = taskName ?? '';
    const taskId = running.value?.taskId;
    boundTask.value = taskId && taskName ? { id: taskId, name: taskName } : null;
  },
  { immediate: true },
);

// The chip follows the running entry's project and resets when the timer stops (REQ-471).
watch(
  () => running.value,
  (entry) => {
    chipProject.value =
      entry?.projectId && entry.projectName
        ? { id: entry.projectId, name: entry.projectName }
        : null;
  },
  { immediate: true },
);

// Close start editor if the timer stops while the popover is open.
watch(isRunning, (running) => {
  if (!running) {
    startEditorOpen.value = false;
  }
});

function onPickProject(project: TitleProject, strippedText: string) {
  // Untitled entries cannot carry a project: keep the chip locally (REQ-471).
  if (isRunning.value && strippedText.trim()) {
    void updateTitle(strippedText, null, project.id);
  }
}

function onRemoveProject() {
  if (isRunning.value && editedTitle.value.trim()) {
    boundTask.value = null;
    void updateTitle(editedTitle.value, null, null);
  }
}

function onPickTask(task: TitleTask) {
  if (isRunning.value) {
    void updateTitle(task.name, task.id);
  }
}

const elapsedLabel = computed(() => {
  const total = elapsedSeconds.value;
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
});

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
      const commit = titleInput.value?.resolveCommit();
      if (!commit) return;
      await start(commit.title || undefined, commit.projectId, commit.taskId);
      title.value = '';
    } finally {
      starting.value = false;
    }
  }
}

/** Commits the running entry's title with the chip's project, sent explicitly (REQ-471). */
async function commitRunningTitle() {
  const commit = titleInput.value?.resolveCommit();
  if (!commit) return;
  if (commit.taskId) {
    await updateTitle(editedTitle.value, commit.taskId);
    return;
  }
  if (commit.resolved) {
    chipProject.value = commit.resolved;
    editedTitle.value = commit.title;
  }
  await updateTitle(commit.title, null, commit.title ? (commit.projectId ?? null) : undefined);
}

async function onBlur() {
  if (isRunning.value) {
    await commitRunningTitle();
  }
}

async function onEnter() {
  if (isRunning.value) {
    await commitRunningTitle();
  } else if (!loading.value) {
    await onToggle();
  }
}

function openStartEditor() {
  if (!running.value) return;
  const current = instantToZoned(running.value.startedAt, effective.value.timeZone);
  startDate.value = parseDate(current.toPlainDate().toString());
  startTime.value = new Time(current.hour, current.minute);
  startEditorError.value = '';
  startEditorOpen.value = true;
}

function onSelectStartDate(value: CalendarDate | null) {
  startCalendarOpen.value = false;
  if (value) {
    startDate.value = value;
  }
}

function combineStartedAt(): string | null {
  if (!startDate.value || !startTime.value) return null;
  const combined = toZoned(
    toCalendarDateTime(startDate.value, startTime.value),
    effective.value.timeZone,
    'compatible',
  );
  return combined.toDate().toISOString();
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
  } catch (err) {
    startEditorError.value = t(extractCaughtMessageKey(err, 'errors.unexpected'));
  } finally {
    savingStartedAt.value = false;
  }
}
</script>

<template>
  <div class="flex w-full min-w-0 items-center gap-2" data-testid="app-timer">
    <TaskTitleInput
      ref="titleInput"
      v-model:text="inputText"
      v-model:project="chipProject"
      v-model:task="boundTask"
      :disabled="isLoading"
      :placeholder="isRunning ? undefined : t('timer.titlePlaceholder')"
      :aria-label="t('timer.titleLabel')"
      chip-testid="timer-project"
      data-testid="timer-title-input"
      @pick-project="onPickProject"
      @remove-project="onRemoveProject"
      @pick-task="onPickTask"
      @blur="onBlur"
      @enter="onEnter"
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
            <UInputDate
              id="timer-start-editor-date"
              v-model="startDate"
              :aria-label="t('timer.startEditor.dateLabel')"
              data-testid="timer-start-editor-date-input"
            >
              <template #trailing>
                <UPopover v-model:open="startCalendarOpen">
                  <UButton
                    color="neutral"
                    variant="link"
                    size="sm"
                    icon="i-lucide-calendar"
                    class="px-0"
                    :aria-label="t('common.openCalendar')"
                    data-testid="timer-start-editor-calendar-button"
                  />
                  <template #content>
                    <div data-testid="timer-start-editor-calendar">
                      <UCalendar
                        class="p-2"
                        :model-value="startDate"
                        :aria-label="t('timer.startEditor.dateLabel')"
                        @update:model-value="
                          (value) => onSelectStartDate(value instanceof CalendarDate ? value : null)
                        "
                      />
                    </div>
                  </template>
                </UPopover>
              </template>
            </UInputDate>
          </div>
          <div class="grid gap-1">
            <label for="timer-start-editor-time">{{ t('timer.startEditor.timeLabel') }}</label>
            <TimeField
              id="timer-start-editor-time"
              v-model="startTime"
              :label="t('timer.startEditor.timeLabel')"
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
              :disabled="!startDate || !startTime"
              data-testid="timer-start-editor-save-button"
              @click="onSaveStartedAt"
            />
          </div>
        </div>
      </template>
    </UPopover>

    <UTooltip :text="isRunning ? t('timer.stop') : t('timer.start')" :content="{ side: 'top' }">
      <UButton
        square
        variant="ghost"
        :icon="isRunning ? 'i-lucide-square' : 'i-lucide-play'"
        :aria-label="isRunning ? t('timer.stop') : t('timer.start')"
        :color="isRunning ? 'error' : 'primary'"
        :ui="
          isRunning
            ? {
                leadingIcon:
                  'origin-center motion-safe:animate-timer-stop-icon motion-reduce:animate-none',
              }
            : undefined
        "
        :loading="starting || stopping"
        :disabled="isLoading"
        :aria-pressed="isRunning"
        data-testid="timer-toggle-button"
        @click="onToggle"
      />
    </UTooltip>
  </div>
</template>
