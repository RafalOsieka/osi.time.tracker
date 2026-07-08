<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { TimerViewGroup } from '~/utils/timerViewGrouping';
import { entryDurationSeconds, UNTITLED_GROUP_KEY } from '~/utils/timerViewGrouping';
import { formatDuration, formatTime } from '~/utils/formatDuration';
import type { TimeEntryDto } from '../../shared/types/time-entry';

const props = defineProps<{
  group: TimerViewGroup;
  isLive: boolean;
  now: number;
}>();

const emit = defineEmits<{ continue: []; edit: []; 'bulk-assign': [] }>();

const { t, locale } = useI18n();

const expanded = ref(false);
const entriesId = computed(() => `timer-group-entries-${props.group.key}`);
const isUntitled = computed(() => props.group.key === UNTITLED_GROUP_KEY);

const contextLabel = computed(() => {
  if (!props.group.projectName) return null;
  return props.group.clientName
    ? `${props.group.projectName} · ${props.group.clientName}`
    : props.group.projectName;
});

const countLabel = computed(() => {
  const count = props.group.entries.length;
  return count === 1
    ? t('timerView.entryCountOne', { count })
    : t('timerView.entryCount', { count });
});

function entryRangeLabel(entry: TimeEntryDto): string {
  const start = formatTime(entry.startedAt, locale.value);
  if (!entry.stoppedAt) {
    return t('timerView.entryRunningLabel', { start });
  }
  return t('timerView.entryRangeLabel', { start, end: formatTime(entry.stoppedAt, locale.value) });
}

function entryDuration(entry: TimeEntryDto): string {
  return formatDuration(entryDurationSeconds(entry, props.now));
}
</script>

<template>
  <div class="timer-group" :data-testid="`timer-group-${group.key}`">
    <div class="timer-group__row">
      <button
        type="button"
        class="timer-group__toggle"
        :aria-expanded="expanded"
        :aria-controls="entriesId"
        :data-testid="`timer-group-toggle-${group.key}`"
        @click="expanded = !expanded"
      >
        <i :class="expanded ? 'pi pi-chevron-down' : 'pi pi-chevron-right'" aria-hidden="true" />
        <span class="timer-group__name">{{ group.taskName ?? t('timerView.noTask') }}</span>
        <span v-if="contextLabel" class="timer-group__context">{{ contextLabel }}</span>
      </button>

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
        v-if="!isUntitled"
        icon="pi pi-pencil"
        text
        rounded
        :aria-label="t('timerView.editLabel')"
        :data-testid="`timer-group-edit-${group.key}`"
        @click="emit('edit')"
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
      <div
        v-for="entry in group.entries"
        :key="entry.id"
        class="timer-entry"
        :data-testid="`timer-entry-${entry.id}`"
      >
        <span>{{ entryRangeLabel(entry) }}</span>
        <span>{{ entryDuration(entry) }}</span>
      </div>
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
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
  font: inherit;
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

.timer-entry {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  font-size: 0.875rem;
  color: var(--p-text-muted-color);
}
</style>
