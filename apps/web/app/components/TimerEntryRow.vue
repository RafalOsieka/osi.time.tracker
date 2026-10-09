<script setup lang="ts">
import type { ZonedDateTime } from '@internationalized/date';
import type { TimeEntryDto } from '../../shared/types/time-entry';
import type { ColumnDefinition } from './ColumnList.vue';

const {
  entry,
  now,
  timeZone = 'UTC',
  columns,
} = defineProps<{
  columns: readonly ColumnDefinition<
    'toggle' | 'count' | 'title' | 'project' | 'issue' | 'duration' | 'action'
  >[];
  entry: TimeEntryDto;
  now: number;
  timeZone?: string;
}>();

const emit = defineEmits<{ changed: []; deleted: [] }>();

const { t } = useI18n();
const toast = useAppToast();
const confirm = useAppConfirm();
const { $csrfFetch } = useNuxtApp();

const editingField = ref<'title' | null>(null);
const titleValue = ref(entry.taskName ?? '');
const deleting = ref(false);

type EntryTimes = { start: ZonedDateTime; end: ZonedDateTime | undefined };

function deriveTimesFromEntry(): EntryTimes {
  return {
    start: instantToZonedDateTime(entry.startedAt, timeZone),
    end: entry.stoppedAt ? instantToZonedDateTime(entry.stoppedAt, timeZone) : undefined,
  };
}

// The field's own live draft; resynced from the entry whenever the parent
// refreshes it (a successful commit, or a revert after a failed one).
const timesModel = shallowRef<EntryTimes>(deriveTimesFromEntry());

watch(
  () => [entry.startedAt, entry.stoppedAt, timeZone],
  () => {
    timesModel.value = deriveTimesFromEntry();
  },
);

const durationLabel = computed(() => formatDuration(entryDurationSeconds(entry, now)));
const titleDisplayValue = computed(() => entry.taskName ?? t('timerView.noTask'));
// Tight segments like a plain "08:00 – 08:30" label; each keeps a small hover/focus pad.
const timeFieldUi = {
  base: 'justify-center gap-0 px-0 py-1 text-xs text-muted tabular-nums @max-[40rem]/list:justify-start',
  segment: 'px-px data-[segment=literal]:px-0 not-data-[segment=literal]:w-auto',
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

/**
 * Sends only the bound(s) that actually changed from the entry's stored
 * instants; `TimeField` already reports an unchanged commit by not firing at
 * all, so reaching here means at least one side moved (REQ-431, REQ-456).
 */
type TimeEntryTimesPatch = Partial<Pick<TimeEntryDto, 'startedAt' | 'stoppedAt'>>;

async function commitTimes() {
  if (!timesModel.value.start) return;
  const patch: TimeEntryTimesPatch = {};
  const startedAt = zonedDateTimeToInstant(timesModel.value.start);
  if (startedAt !== entry.startedAt) patch.startedAt = startedAt;
  if (timesModel.value.end) {
    const stoppedAt = zonedDateTimeToInstant(timesModel.value.end);
    if (stoppedAt !== entry.stoppedAt) patch.stoppedAt = stoppedAt;
  }
  if (Object.keys(patch).length === 0) return;

  try {
    await $csrfFetch<TimeEntryDto>(`/api/time-entries/${entry.id}`, {
      method: 'PATCH',
      body: patch,
    });
    emit('changed');
  } catch (err) {
    const key = extractCaughtMessageKey(err, 'errors.unexpected');
    toast.error(t(key));
    // KNOWN LIMITATION (accepted, not fixed): this correctly resets the
    // underlying value, but reka-ui 2.10.4's range TimeRangeFieldRoot seeds
    // its rendered segments from an internal ref once at mount and never
    // re-syncs them from a later external modelValue change (unlike its
    // single-value TimeFieldRoot, which is a properly controlled component).
    // So a stopped entry's row keeps showing the rejected value until it
    // remounts, even though `timesModel` (and the entry's stored instants)
    // are correct. See design.md — Risks / Trade-offs.
    timesModel.value = deriveTimesFromEntry();
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
  <ColumnRow kind="sub" :data-testid="`timer-entry-${entry.id}`">
    <ColumnCell :columns="columns" col="title" :narrow="{ col: [3, 5], row: 2 }">
      <InlineEditText
        v-model="titleValue"
        :editing="editingField === 'title'"
        :display-value="titleDisplayValue"
        :field-label="t('timerView.entryRow.titleLabel')"
        :display-testid="`timer-entry-title-${entry.id}`"
        :input-testid="`timer-entry-title-input-${entry.id}`"
        display-class="text-muted"
        @edit="startEditTitle"
        @commit="commitTitle"
        @cancel="cancelEdit"
      />
    </ColumnCell>

    <!--
      One fixed-width slot for either a stopped entry's start–stop range field
      or a running entry's single start field plus the "now" label, so the
      slot (and the duration column after it) never shifts between rows
      (REQ-459, REQ-361).
    -->
    <ColumnCell
      :columns="columns"
      col="project"
      to="issue"
      :narrow="{ col: [3, 5], row: 1 }"
      class="flex min-w-0 items-center justify-end gap-1.5 @max-[40rem]/list:justify-start"
    >
      <TimeField
        v-if="entry.stoppedAt"
        v-model="timesModel"
        range
        clamp-seconds
        size="xs"
        variant="none"
        :ui="timeFieldUi"
        :separator="t('timerView.entryRow.separator')"
        :label="t('timerView.entryRow.timesLabel')"
        :testid="`timer-entry-times-${entry.id}`"
        class="w-full max-w-46"
        @commit="commitTimes"
      />
      <template v-else>
        <TimeField
          v-model="timesModel.start"
          size="xs"
          variant="none"
          :ui="timeFieldUi"
          :label="t('timerView.entryRow.startLabel')"
          :testid="`timer-entry-times-${entry.id}`"
          class="min-w-0 max-w-24 flex-1"
          @commit="commitTimes"
        />
        <span aria-hidden="true">{{ t('timerView.entryRow.separator') }}</span>
        <span class="min-w-0 max-w-24 flex-1 text-center">
          {{ t('timerView.entryRow.nowLabel') }}
        </span>
      </template>
    </ColumnCell>

    <ColumnCell
      :columns="columns"
      col="duration"
      align="end"
      :narrow="{ col: [5, 6], row: 1 }"
      class="font-mono text-sm font-medium tabular-nums"
    >
      {{ durationLabel }}
    </ColumnCell>

    <ColumnCell :columns="columns" col="action" :narrow="{ col: [6, 7], row: 1 }">
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
    </ColumnCell>
  </ColumnRow>
</template>
