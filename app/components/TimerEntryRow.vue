<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';
import {
  combineLocalDateAndTime,
  entryDurationSeconds,
  isoToLocalTime,
} from '~/utils/timerViewGrouping';
import { formatDuration, formatTime } from '~/utils/formatDuration';
import type { TimeEntryDto } from '../../shared/types/time-entry';

const props = defineProps<{
  entry: TimeEntryDto;
  now: number;
}>();

const emit = defineEmits<{ changed: []; deleted: [] }>();

const { t, locale } = useI18n();
const toast = useToast();
const confirm = useConfirm();
const { $csrfFetch } = useNuxtApp();

const editingField = ref<'title' | 'start' | 'stop' | null>(null);
const titleValue = ref(props.entry.taskName ?? '');
const startValue = ref(isoToLocalTime(props.entry.startedAt));
const stopValue = ref(props.entry.stoppedAt ? isoToLocalTime(props.entry.stoppedAt) : '');
const deleting = ref(false);

const durationLabel = computed(() => formatDuration(entryDurationSeconds(props.entry, props.now)));

function startEditTitle() {
  titleValue.value = props.entry.taskName ?? '';
  editingField.value = 'title';
}

function startEditStart() {
  startValue.value = isoToLocalTime(props.entry.startedAt);
  editingField.value = 'start';
}

function startEditStop() {
  stopValue.value = props.entry.stoppedAt ? isoToLocalTime(props.entry.stoppedAt) : '';
  editingField.value = 'stop';
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
    toast.add({ severity: 'error', summary: t(key), life: 4000 });
    titleValue.value = props.entry.taskName ?? '';
  }
}

function combineWithEntryDay(iso: string, time: string): string {
  const base = new Date(iso);
  return combineLocalDateAndTime(base, time);
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
    toast.add({ severity: 'error', summary: t(key), life: 4000 });
    startValue.value = isoToLocalTime(props.entry.startedAt);
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
    toast.add({ severity: 'error', summary: t(key), life: 4000 });
    stopValue.value = props.entry.stoppedAt ? isoToLocalTime(props.entry.stoppedAt) : '';
  }
}

function onDelete() {
  confirm.require({
    header: t('timerView.entryRow.deleteConfirmHeader'),
    message: t('timerView.entryRow.deleteConfirmMessage'),
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: t('timerView.entryRow.deleteConfirmAccept'),
    rejectLabel: t('timerView.entryRow.deleteConfirmReject'),
    acceptClass: 'p-button-danger',
    accept: async () => {
      deleting.value = true;
      try {
        await $csrfFetch(`/api/time-entries/${props.entry.id}`, { method: 'DELETE' });
        emit('deleted');
      } catch (err: unknown) {
        const key = extractMessageKey(err, 'errors.unexpected');
        toast.add({ severity: 'error', summary: t(key), life: 4000 });
      } finally {
        deleting.value = false;
      }
    },
  });
}
</script>

<template>
  <div class="timer-entry" :data-testid="`timer-entry-${entry.id}`">
    <span class="timer-entry__title">
      <input
        v-if="editingField === 'title'"
        v-model="titleValue"
        type="text"
        :aria-label="t('timerView.entryRow.titleLabel')"
        class="timer-entry__input"
        :data-testid="`timer-entry-title-input-${entry.id}`"
        @blur="commitTitle"
        @keydown.enter="commitTitle"
        @keydown.esc="cancelEdit"
      />
      <button
        v-else
        type="button"
        class="timer-entry__edit-trigger"
        :aria-label="t('timerView.entryRow.titleLabel')"
        :data-testid="`timer-entry-title-${entry.id}`"
        @click="startEditTitle"
      >
        {{ entry.taskName ?? t('timerView.noTask') }}
      </button>
    </span>

    <span class="timer-entry__range">
      <template v-if="editingField === 'start'">
        <input
          v-model="startValue"
          type="time"
          :aria-label="t('timerView.entryRow.startLabel')"
          class="timer-entry__input"
          :data-testid="`timer-entry-start-input-${entry.id}`"
          @blur="commitStart"
          @keydown.enter="commitStart"
          @keydown.esc="cancelEdit"
        />
      </template>
      <button
        v-else
        type="button"
        class="timer-entry__edit-trigger"
        :aria-label="t('timerView.entryRow.startLabel')"
        :data-testid="`timer-entry-start-${entry.id}`"
        @click="startEditStart"
      >
        {{ formatTime(entry.startedAt, locale) }}
      </button>

      <span aria-hidden="true">{{ t('timerView.entryRow.separator') }}</span>

      <template v-if="entry.stoppedAt">
        <template v-if="editingField === 'stop'">
          <input
            v-model="stopValue"
            type="time"
            :aria-label="t('timerView.entryRow.stopLabel')"
            class="timer-entry__input"
            :data-testid="`timer-entry-stop-input-${entry.id}`"
            @blur="commitStop"
            @keydown.enter="commitStop"
            @keydown.esc="cancelEdit"
          />
        </template>
        <button
          v-else
          type="button"
          class="timer-entry__edit-trigger"
          :aria-label="t('timerView.entryRow.stopLabel')"
          :data-testid="`timer-entry-stop-${entry.id}`"
          @click="startEditStop"
        >
          {{ formatTime(entry.stoppedAt, locale) }}
        </button>
      </template>
      <span v-else>{{ t('timerView.entryRow.nowLabel') }}</span>
    </span>

    <span class="timer-entry__duration">{{ durationLabel }}</span>

    <Button
      icon="pi pi-trash"
      text
      rounded
      severity="danger"
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
  color: var(--p-text-muted-color);
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
  border: 1px solid var(--p-content-border-color);
  border-radius: 4px;
  padding: 0.125rem 0.25rem;
}
</style>
