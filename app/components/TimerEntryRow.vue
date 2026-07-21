<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { entryDurationSeconds, isoToLocalTime, localDayKey } from '~/utils/timerViewGrouping';
import { wallClockToInstant } from '~/utils/dateTime';
import { formatDuration, formatTime } from '~/utils/formatDuration';
import type { TimeEntryDto } from '../../shared/types/time-entry';

const props = withDefaults(
  defineProps<{
    entry: TimeEntryDto;
    now: number;
    timeZone?: string;
  }>(),
  { timeZone: 'UTC' },
);

const emit = defineEmits<{ changed: []; deleted: [] }>();

const { t, locale } = useI18n();
const toast = useAppToast();
const confirm = useAppConfirm();
const { $csrfFetch } = useNuxtApp();

const editingField = ref<'title' | 'start' | 'stop' | null>(null);
const titleValue = ref(props.entry.taskName ?? '');
const startValue = ref(isoToLocalTime(props.entry.startedAt, props.timeZone));
const stopValue = ref(
  props.entry.stoppedAt ? isoToLocalTime(props.entry.stoppedAt, props.timeZone) : '',
);
const deleting = ref(false);

const durationLabel = computed(() => formatDuration(entryDurationSeconds(props.entry, props.now)));
const titleInputWidth = computed(() => `${Math.max(titleValue.value.length, 8) + 1}ch`);

async function startEditTitle() {
  editingField.value = null;
  titleValue.value = props.entry.taskName ?? '';
  editingField.value = 'title';
  await nextTick();
  document
    .querySelector<HTMLInputElement>(`[data-testid="timer-entry-title-input-${props.entry.id}"]`)
    ?.focus();
}

async function startEditStart() {
  editingField.value = null;
  startValue.value = isoToLocalTime(props.entry.startedAt, props.timeZone);
  editingField.value = 'start';
  await nextTick();
  document
    .querySelector<HTMLInputElement>(`[data-testid="timer-entry-start-input-${props.entry.id}"]`)
    ?.focus();
}

async function startEditStop() {
  editingField.value = null;
  stopValue.value = props.entry.stoppedAt
    ? isoToLocalTime(props.entry.stoppedAt, props.timeZone)
    : '';
  editingField.value = 'stop';
  await nextTick();
  document
    .querySelector<HTMLInputElement>(`[data-testid="timer-entry-stop-input-${props.entry.id}"]`)
    ?.focus();
}

function cancelEdit() {
  editingField.value = null;
}

async function commitTitle() {
  if (editingField.value !== 'title') return;
  editingField.value = null;
  const trimmed = titleValue.value.trim();
  const normalized = trimmed.length > 0 ? trimmed : null;
  if (normalized === (props.entry.taskName ?? null)) return;
  try {
    const updated = await $csrfFetch<TimeEntryDto>(`/api/time-entries/${props.entry.id}`, {
      method: 'PATCH',
      body: { title: normalized },
    });
    if (updated.taskId !== props.entry.taskId) {
      emit('changed');
    }
  } catch (err: unknown) {
    const key = extractMessageKey(err, 'errors.unexpected');
    toast.error(t(key));
    titleValue.value = props.entry.taskName ?? '';
  }
}

function combineWithEntryDay(iso: string, time: string): string {
  const dateKey = localDayKey(iso, props.timeZone);
  return wallClockToInstant(dateKey, time, props.timeZone);
}

async function commitStart() {
  if (editingField.value !== 'start') return;
  editingField.value = null;
  const startedAt = combineWithEntryDay(props.entry.startedAt, startValue.value);
  if (startedAt === props.entry.startedAt) return;
  try {
    await $csrfFetch<TimeEntryDto>(`/api/time-entries/${props.entry.id}`, {
      method: 'PATCH',
      body: { startedAt },
    });
    emit('changed');
  } catch (err: unknown) {
    const key = extractMessageKey(err, 'errors.unexpected');
    toast.error(t(key));
    startValue.value = isoToLocalTime(props.entry.startedAt, props.timeZone);
  }
}

async function commitStop() {
  if (editingField.value !== 'stop') return;
  editingField.value = null;
  if (!props.entry.stoppedAt) return;
  const stoppedAt = combineWithEntryDay(props.entry.stoppedAt, stopValue.value);
  if (stoppedAt === props.entry.stoppedAt) return;
  try {
    await $csrfFetch<TimeEntryDto>(`/api/time-entries/${props.entry.id}`, {
      method: 'PATCH',
      body: { stoppedAt },
    });
    emit('changed');
  } catch (err: unknown) {
    const key = extractMessageKey(err, 'errors.unexpected');
    toast.error(t(key));
    stopValue.value = props.entry.stoppedAt
      ? isoToLocalTime(props.entry.stoppedAt, props.timeZone)
      : '';
  }
}

async function onDelete() {
  const accepted = await confirm({
    title: t('timerView.entryRow.deleteConfirmHeader'),
    description: t('timerView.entryRow.deleteConfirmMessage'),
    confirmLabel: t('timerView.entryRow.deleteConfirmAccept'),
    cancelLabel: t('timerView.entryRow.deleteConfirmReject'),
  });
  if (!accepted) return;
  deleting.value = true;
  try {
    await $csrfFetch(`/api/time-entries/${props.entry.id}`, { method: 'DELETE' });
    emit('deleted');
  } catch (err: unknown) {
    const key = extractMessageKey(err, 'errors.unexpected');
    toast.error(t(key));
  } finally {
    deleting.value = false;
  }
}
</script>

<template>
  <div class="timer-entry" :data-testid="`timer-entry-${entry.id}`">
    <span class="timer-entry__title">
      <UInput
        v-if="editingField === 'title'"
        v-model="titleValue"
        type="text"
        :aria-label="t('timerView.entryRow.titleLabel')"
        class="timer-entry__input timer-entry__title-input"
        :style="{ width: titleInputWidth }"
        :data-testid="`timer-entry-title-input-${entry.id}`"
        @blur="commitTitle"
        @keydown.enter="commitTitle"
        @keydown.esc="cancelEdit"
      />
      <UButton
        v-else
        class="timer-entry__edit-trigger"
        variant="ghost"
        :label="entry.taskName ?? t('timerView.noTask')"
        :aria-label="t('timerView.entryRow.titleLabel')"
        :data-testid="`timer-entry-title-${entry.id}`"
        @click="startEditTitle"
      />
    </span>

    <span class="timer-entry__range">
      <template v-if="editingField === 'start'">
        <TimeInput
          v-model="startValue"
          :label="t('timerView.entryRow.startLabel')"
          class="timer-entry__input"
          :testid="`timer-entry-start-input-${entry.id}`"
          @commit="commitStart"
          @cancel="cancelEdit"
        />
      </template>
      <UButton
        v-else
        class="timer-entry__edit-trigger"
        variant="ghost"
        :label="formatTime(entry.startedAt, locale, timeZone)"
        :aria-label="t('timerView.entryRow.startLabel')"
        :data-testid="`timer-entry-start-${entry.id}`"
        @click="startEditStart"
      />

      <span aria-hidden="true">{{ t('timerView.entryRow.separator') }}</span>

      <template v-if="entry.stoppedAt">
        <template v-if="editingField === 'stop'">
          <TimeInput
            v-model="stopValue"
            :label="t('timerView.entryRow.stopLabel')"
            class="timer-entry__input"
            :testid="`timer-entry-stop-input-${entry.id}`"
            @commit="commitStop"
            @cancel="cancelEdit"
          />
        </template>
        <UButton
          v-else
          class="timer-entry__edit-trigger"
          variant="ghost"
          :label="formatTime(entry.stoppedAt, locale, timeZone)"
          :aria-label="t('timerView.entryRow.stopLabel')"
          :data-testid="`timer-entry-stop-${entry.id}`"
          @click="startEditStop"
        />
      </template>
      <span v-else>{{ t('timerView.entryRow.nowLabel') }}</span>
    </span>

    <span class="timer-entry__duration">{{ durationLabel }}</span>

    <UButton
      icon="i-lucide-trash-2"
      variant="ghost"
      square
      color="error"
      :aria-label="t('timerView.entryRow.deleteLabel')"
      :loading="deleting"
      :data-testid="`timer-entry-delete-${entry.id}`"
      @click="onDelete"
    />
  </div>
</template>

<style scoped>
.timer-entry {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  font-size: 0.875rem;
  color: var(--ui-text-muted);
}

.timer-entry__title {
  flex: 1;
}

.timer-entry__range {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.timer-entry__duration {
  font-family: monospace;
  min-width: 4.5rem;
  text-align: right;
}

.timer-entry__edit-trigger {
  background: none;
  border: none;
  cursor: pointer;
  font: inherit;
  color: inherit;
  padding: 0;
}

.timer-entry__edit-trigger:hover {
  text-decoration: underline;
}

.timer-entry__input {
  font: inherit;
  color: inherit;
  border: 1px solid var(--ui-border);
  border-radius: 4px;
  padding: 0.125rem 0.25rem;
}

.timer-entry__title-input {
  max-width: 100%;
}
</style>
