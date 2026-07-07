<script setup lang="ts">
import type { AutoCompleteCompleteEvent } from 'primevue/autocomplete';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const { running, elapsedSeconds, loading, start, stop, updateTitle } = useTimer();

const title = ref('');
const editedTitle = ref('');
const suggestions = ref<TaskDto[]>([]);
const starting = ref(false);
const stopping = ref(false);
const overlayOpen = ref(false);

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

    <span
      class="app-timer__elapsed"
      role="timer"
      :aria-label="t('timer.elapsedLabel')"
      data-testid="timer-elapsed"
    >
      {{ elapsedLabel }}
    </span>

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
</style>
