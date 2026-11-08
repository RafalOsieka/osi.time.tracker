<script setup lang="ts">
import { CalendarDate, parseDate, parseTime, type Time } from '@internationalized/date';
import type { FormErrorEvent } from '@nuxt/ui';
import type {
  StartTimeEntryDto,
  TimeEntryDto,
  TimerAddEntryFormDto,
} from '~~/shared/types/time-entry';
import type { TitleProject, TitleTask } from '../utils/title-mention';

const { visible, timeZone } = defineProps<{
  visible: boolean;
  timeZone: string;
}>();

const emit = defineEmits<{ 'update:visible': [boolean]; added: [TimeEntryDto] }>();

const { t } = useI18n();
const toast = useAppToast();
const { $csrfFetch } = useNuxtApp();

const open = computed({
  get: () => visible,
  set: (value: boolean) => emit('update:visible', value),
});

function todayKey(): string {
  return localDayKeyFromInstant(new Date().toISOString(), timeZone);
}

const state = reactive<TimerAddEntryFormDto>({
  title: '',
  date: todayKey(),
  startTime: '09:00',
  endTime: '10:00',
});
const titleInput = useTemplateRef('titleInput');
const chipProject = ref<TitleProject | null>(null);
/** Suggestion picked from the overlay; binds the entry by identity until the text is edited. */
const pickedTask = ref<TitleTask | null>(null);
const rangeError = ref('');
const saving = ref(false);
const calendarOpen = ref(false);

// `state.date` stays the schema-validated `YYYY-MM-DD` string; the date field
// works in `CalendarDate` and converts at this boundary.
const dateValue = computed<CalendarDate | null>({
  get: () => (state.date ? parseDate(state.date) : null),
  set: (value) => {
    state.date = value ? value.toString() : '';
  },
});

function onSelectDate(value: CalendarDate | null) {
  calendarOpen.value = false;
  if (value) {
    dateValue.value = value;
  }
}

/** `HH:mm` bridge to `Time`, mirroring `dateValue` above (`state` keeps the schema-validated strings). */
const timesValue = computed<{ start: Time | undefined; end: Time | undefined }>({
  get: () => ({
    start: state.startTime ? parseTime(state.startTime) : undefined,
    end: state.endTime ? parseTime(state.endTime) : undefined,
  }),
  set: (value) => {
    state.startTime = value.start ? value.start.toString().slice(0, 5) : '';
    state.endTime = value.end ? value.end.toString().slice(0, 5) : '';
  },
});

const HH_MM = /^\d{2}:\d{2}$/;

/** The entry's length for a complete, non-inverted range (wall clock on the chosen day), else null. */
const previewDuration = computed(() => {
  if (!state.date || !HH_MM.test(state.startTime) || !HH_MM.test(state.endTime)) return null;
  const startedAt = Date.parse(wallClockToInstant(state.date, state.startTime, timeZone));
  const stoppedAt = Date.parse(wallClockToInstant(state.date, state.endTime, timeZone));
  if (!(stoppedAt >= startedAt)) return null;
  // A preview inside a form reads as words ("1 godz. 30 min"); tables keep their mono formats.
  const totalMinutes = Math.floor((stoppedAt - startedAt) / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const parts = [
    hours > 0 ? t('timerView.addEntry.durationHours', { count: hours }) : '',
    minutes > 0 || hours === 0 ? t('timerView.addEntry.durationMinutes', { count: minutes }) : '',
  ];
  return parts.filter(Boolean).join(' ');
});

/** Whether the title came from the create-new-task option, for the "new Task" cue. */
const isNewTask = ref(false);

/** The timezone with its offset on the chosen date and start (DST applies), e.g. UTC+01:00. */
const timeZoneHint = computed(() => {
  const time = HH_MM.test(state.startTime) ? state.startTime : '12:00';
  const at = state.date ? wallClockToInstant(state.date, time, timeZone) : new Date().toISOString();
  return t('timerView.addEntry.timeZoneHint', { zone: timeZoneLabel(timeZone, at) });
});

watch(
  () => visible,
  (visible) => {
    if (visible) {
      chipProject.value = null;
      pickedTask.value = null;
      state.title = '';
      state.date = todayKey();
      state.startTime = '09:00';
      state.endTime = '10:00';
      rangeError.value = '';
    }
  },
);

function close() {
  open.value = false;
}

function onError(event: FormErrorEvent) {
  const range = event.errors.find(
    (error) => error.name === 'endTime' || error.name === 'startTime' || error.name === 'date',
  );
  if (range?.message) {
    rangeError.value = t(range.message);
    return;
  }
  rangeError.value = '';
}

async function onSave() {
  rangeError.value = '';

  const commit = titleInput.value?.resolveCommit();
  if (!commit) return;

  const startedAt = wallClockToInstant(state.date, state.startTime, timeZone);
  const stoppedAt = wallClockToInstant(state.date, state.endTime, timeZone);

  saving.value = true;
  try {
    const body: StartTimeEntryDto = { startedAt, stoppedAt };
    if (commit.taskId) {
      body.taskId = commit.taskId;
    } else {
      body.title = commit.title || null;
      if (commit.projectId) body.projectId = commit.projectId;
    }
    const created = await $csrfFetch<TimeEntryDto>('/api/time-entries', {
      method: 'POST',
      body,
    });
    toast.success(t('timerView.addEntry.toastSuccessSummary'));
    close();
    emit('added', created);
  } catch (err) {
    const key = extractCaughtMessageKey(err, 'errors.unexpected');
    toast.error(t(key));
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <UModal v-model:open="open" :title="t('timerView.addEntry.dialogTitle')">
    <template #body>
      <UForm
        :schema="timerAddEntryFormSchema"
        :state="state"
        data-testid="add-entry-dialog"
        class="grid min-w-80 gap-4"
        @submit="onSave"
        @error="onError"
      >
        <!--
          The help line says a new title is as welcome as an existing Task; once the create option
          is picked it says so ("Nowe zadanie") and names the entry's Project, or that it has none.
        -->
        <UFormField
          :label="t('timerView.addEntry.titleLabel')"
          :hint="t('timerView.addEntry.optionalHint')"
          :ui="{ help: 'mt-1.5 text-sm text-muted' }"
        >
          <template #help>
            <span
              v-if="isNewTask"
              class="flex flex-wrap items-center gap-x-2 gap-y-1"
              data-testid="add-entry-new-task"
            >
              <UBadge
                color="primary"
                variant="soft"
                size="md"
                class="rounded-full"
                :label="t('timerView.addEntry.newTaskBadge')"
              />
              <span>
                {{
                  chipProject
                    ? t('timerView.addEntry.newTaskProject', { project: chipProject.name })
                    : t('timerView.addEntry.newTaskNoProject')
                }}
              </span>
            </span>
            <template v-else>{{ t('timerView.addEntry.titleHelp') }}</template>
          </template>
          <TaskTitleInput
            ref="titleInput"
            v-model:text="state.title"
            v-model:project="chipProject"
            v-model:task="pickedTask"
            v-model:new-task="isNewTask"
            class="w-full"
            eager
            chip-testid="add-entry-project"
            data-testid="add-entry-title-input"
          />
        </UFormField>

        <!--
          Date and range share one row, like the top bar's start editor, so neither field runs
          long for its short value. Under them: the entry's length in words (a mistyped range is
          caught before saving), then, quieter as metadata, the timezone the times are in.
        -->
        <div class="grid grid-cols-[minmax(0,11fr)_minmax(0,9fr)] gap-3">
          <UFormField :label="t('timerView.addEntry.dateLabel')">
            <UInputDate
              v-model="dateValue"
              class="w-full"
              :ui="{ segment: 'data-[segment=literal]:text-current' }"
              :aria-label="t('timerView.addEntry.dateLabel')"
              data-testid="add-entry-date-input"
            >
              <template #trailing>
                <UPopover v-model:open="calendarOpen">
                  <UButton
                    color="neutral"
                    variant="link"
                    size="sm"
                    icon="i-lucide-calendar"
                    class="px-0"
                    :aria-label="t('common.openCalendar')"
                    data-testid="add-entry-calendar-button"
                  />
                  <template #content>
                    <div data-testid="add-entry-calendar">
                      <UCalendar
                        class="p-2"
                        :model-value="dateValue"
                        :aria-label="t('timerView.addEntry.dateLabel')"
                        @update:model-value="
                          (value) => onSelectDate(value instanceof CalendarDate ? value : null)
                        "
                      />
                    </div>
                  </template>
                </UPopover>
              </template>
            </UInputDate>
          </UFormField>
          <UFormField :label="t('timerView.addEntry.timesLabel')">
            <TimeField
              v-model="timesValue"
              range
              :label="t('timerView.addEntry.timesLabel')"
              :invalid="!!rangeError"
              :describedby="rangeError ? 'add-entry-range-error' : undefined"
              testid="add-entry-time-input"
            />
          </UFormField>
        </div>
        <div class="-mt-2 grid gap-1">
          <p
            v-if="rangeError"
            id="add-entry-range-error"
            class="m-0 text-sm text-error"
            role="alert"
            data-testid="add-entry-range-error"
          >
            {{ rangeError }}
          </p>
          <p v-if="previewDuration" class="m-0 text-sm text-muted">
            {{ t('timerView.addEntry.durationHint') }}
            <span class="ms-1 font-medium text-default" data-testid="add-entry-duration">
              {{ previewDuration }}
            </span>
          </p>
          <p class="m-0 text-xs text-muted" data-testid="add-entry-time-zone">
            {{ timeZoneHint }}
          </p>
        </div>

        <FormDialogFooter
          :cancel-label="t('timerView.addEntry.cancelButton')"
          :save-label="t('timerView.addEntry.saveButton')"
          :saving="saving"
          @cancel="close"
        />
      </UForm>
    </template>
  </UModal>
</template>
