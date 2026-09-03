<script setup lang="ts">
import type { TimeEntryDto } from '../../shared/types/time-entry';

const {
  entry,
  now,
  timeZone = 'UTC',
} = defineProps<{
  entry: TimeEntryDto;
  now: number;
  timeZone?: string;
}>();

const emit = defineEmits<{ changed: []; deleted: [] }>();

const { t } = useI18n();
const toast = useAppToast();
const confirm = useAppConfirm();
const { $csrfFetch } = useNuxtApp();

const editingField = ref<'title' | 'start' | 'stop' | null>(null);
const titleValue = ref(entry.taskName ?? '');
const startValue = ref(isoToLocalTime(entry.startedAt, timeZone));
const stopValue = ref(entry.stoppedAt ? isoToLocalTime(entry.stoppedAt, timeZone) : '');
const deleting = ref(false);

const durationLabel = computed(() => formatDuration(entryDurationSeconds(entry, now)));
const titleDisplayValue = computed(() => entry.taskName ?? t('timerView.noTask'));
const timeSlotUi = {
  root: 'w-full min-w-0',
  base: 'w-full min-w-0 px-2 py-1 text-center text-sm/4 tabular-nums',
};

async function startEditTitle() {
  editingField.value = null;
  titleValue.value = entry.taskName ?? '';
  editingField.value = 'title';
  await nextTick();
  document
    .querySelector<HTMLInputElement>(`[data-testid="timer-entry-title-input-${entry.id}"]`)
    ?.focus();
}

async function startEditStart() {
  editingField.value = null;
  startValue.value = isoToLocalTime(entry.startedAt, timeZone);
  editingField.value = 'start';
  await nextTick();
  document
    .querySelector<HTMLInputElement>(`[data-testid="timer-entry-start-input-${entry.id}"]`)
    ?.focus();
}

async function startEditStop() {
  editingField.value = null;
  stopValue.value = entry.stoppedAt ? isoToLocalTime(entry.stoppedAt, timeZone) : '';
  editingField.value = 'stop';
  await nextTick();
  document
    .querySelector<HTMLInputElement>(`[data-testid="timer-entry-stop-input-${entry.id}"]`)
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
  if (normalized === (entry.taskName ?? null)) return;
  try {
    const updated = await $csrfFetch<TimeEntryDto>(`/api/time-entries/${entry.id}`, {
      method: 'PATCH',
      body: { title: normalized },
    });
    if (updated.taskId !== entry.taskId) {
      emit('changed');
    }
  } catch (err) {
    const key = extractCaughtMessageKey(err, 'errors.unexpected');
    toast.error(t(key));
    titleValue.value = entry.taskName ?? '';
  }
}

function combineWithEntryDay(iso: string, time: string): string {
  const dateKey = localDayKey(iso, timeZone);
  return wallClockToInstant(dateKey, time, timeZone);
}

async function commitStart() {
  if (editingField.value !== 'start') return;
  editingField.value = null;
  const startedAt = combineWithEntryDay(entry.startedAt, startValue.value);
  if (startedAt === entry.startedAt) return;
  try {
    await $csrfFetch<TimeEntryDto>(`/api/time-entries/${entry.id}`, {
      method: 'PATCH',
      body: { startedAt },
    });
    emit('changed');
  } catch (err) {
    const key = extractCaughtMessageKey(err, 'errors.unexpected');
    toast.error(t(key));
    startValue.value = isoToLocalTime(entry.startedAt, timeZone);
  }
}

async function commitStop() {
  if (editingField.value !== 'stop') return;
  editingField.value = null;
  if (!entry.stoppedAt) return;
  const stoppedAt = combineWithEntryDay(entry.stoppedAt, stopValue.value);
  if (stoppedAt === entry.stoppedAt) return;
  try {
    await $csrfFetch<TimeEntryDto>(`/api/time-entries/${entry.id}`, {
      method: 'PATCH',
      body: { stoppedAt },
    });
    emit('changed');
  } catch (err) {
    const key = extractCaughtMessageKey(err, 'errors.unexpected');
    toast.error(t(key));
    stopValue.value = entry.stoppedAt ? isoToLocalTime(entry.stoppedAt, timeZone) : '';
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
    await $csrfFetch(`/api/time-entries/${entry.id}`, { method: 'DELETE' });
    emit('deleted');
  } catch (err) {
    const key = extractCaughtMessageKey(err, 'errors.unexpected');
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
      <InlineEditText
        v-model="titleValue"
        :editing="editingField === 'title'"
        :display-value="titleDisplayValue"
        :field-label="t('timerView.entryRow.titleLabel')"
        :display-testid="`timer-entry-title-${entry.id}`"
        :input-testid="`timer-entry-title-input-${entry.id}`"
        @edit="startEditTitle"
        @commit="commitTitle"
        @cancel="cancelEdit"
      />
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
