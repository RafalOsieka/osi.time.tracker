<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { entryDurationSeconds, isoToLocalTime, localDayKey } from '~/utils/timerViewGrouping';
import { wallClockToInstant } from '~/utils/dateTime';
import { formatDuration } from '~/utils/formatDuration';
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

const { t } = useI18n();
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
const titleDisplayValue = computed(() => props.entry.taskName ?? t('timerView.noTask'));
const titleInputUi = { root: 'min-w-0 w-full max-w-full', base: 'min-w-0 truncate' };
const timeSlotUi = {
  root: 'w-full min-w-0',
  base: 'w-full min-w-0 px-2 py-1 text-center text-sm/4 tabular-nums',
};

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
  <div
    class="flex items-center justify-between gap-4 text-sm text-muted"
    :data-testid="`timer-entry-${entry.id}`"
  >
    <span class="min-w-0 flex-1">
      <UInput
        v-if="editingField === 'title'"
        v-model="titleValue"
        type="text"
        variant="ghost"
        size="xs"
        :aria-label="t('timerView.entryRow.titleLabel')"
        class="w-full min-w-0 max-w-full"
        :ui="titleInputUi"
        :data-testid="`timer-entry-title-input-${entry.id}`"
        @blur="commitTitle"
        @keydown.enter="commitTitle"
        @keydown.esc="cancelEdit"
      />
      <OverflowTooltip v-else :text="titleDisplayValue">
        <UInput
          :model-value="titleDisplayValue"
          type="text"
          variant="none"
          readonly
          size="xs"
          :aria-label="t('timerView.entryRow.titleLabel')"
          class="w-full min-w-0 max-w-full cursor-pointer"
          :ui="titleInputUi"
          :data-testid="`timer-entry-title-${entry.id}`"
          @focus="startEditTitle"
          @click="startEditTitle"
        />
      </OverflowTooltip>
    </span>

    <span class="flex shrink-0 items-center gap-1.5">
      <span class="inline-flex w-[10ch] shrink-0">
        <TimeInput
          v-if="editingField === 'start'"
          v-model="startValue"
          :label="t('timerView.entryRow.startLabel')"
          :testid="`timer-entry-start-input-${entry.id}`"
          @commit="commitStart"
          @cancel="cancelEdit"
        />
        <UInput
          v-else
          :model-value="isoToLocalTime(entry.startedAt, timeZone)"
          variant="none"
          readonly
          size="xs"
          class="w-full min-w-0 cursor-pointer"
          :ui="timeSlotUi"
          :aria-label="t('timerView.entryRow.startLabel')"
          :data-testid="`timer-entry-start-${entry.id}`"
          @focus="startEditStart"
          @click="startEditStart"
        />
      </span>

      <span aria-hidden="true">{{ t('timerView.entryRow.separator') }}</span>

      <span class="inline-flex w-[10ch] shrink-0">
        <template v-if="entry.stoppedAt">
          <TimeInput
            v-if="editingField === 'stop'"
            v-model="stopValue"
            :label="t('timerView.entryRow.stopLabel')"
            :testid="`timer-entry-stop-input-${entry.id}`"
            @commit="commitStop"
            @cancel="cancelEdit"
          />
          <UInput
            v-else
            :model-value="isoToLocalTime(entry.stoppedAt, timeZone)"
            variant="none"
            readonly
            size="xs"
            class="w-full min-w-0 cursor-pointer"
            :ui="timeSlotUi"
            :aria-label="t('timerView.entryRow.stopLabel')"
            :data-testid="`timer-entry-stop-${entry.id}`"
            @focus="startEditStop"
            @click="startEditStop"
          />
        </template>
        <span v-else class="w-full text-center">{{ t('timerView.entryRow.nowLabel') }}</span>
      </span>
    </span>

    <span class="min-w-[4.5rem] text-right font-mono text-sm font-medium tabular-nums text-muted">
      {{ durationLabel }}
    </span>

    <UTooltip :text="t('timerView.entryRow.deleteLabel')" :content="{ side: 'top' }">
      <UButton
        icon="i-lucide-trash-2"
        variant="ghost"
        square
        size="xs"
        color="error"
        :aria-label="t('timerView.entryRow.deleteLabel')"
        :loading="deleting"
        :data-testid="`timer-entry-delete-${entry.id}`"
        @click="onDelete"
      />
    </UTooltip>
  </div>
</template>
