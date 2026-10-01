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
        class="grid min-w-80 gap-3"
        @submit="onSave"
        @error="onError"
      >
        <div class="grid gap-1">
          <label for="add-entry-title">{{ t('timerView.addEntry.titleLabel') }}</label>
          <TaskTitleInput
            id="add-entry-title"
            ref="titleInput"
            v-model:text="state.title"
            v-model:project="chipProject"
            v-model:task="pickedTask"
            eager
            :placeholder="t('timerView.addEntry.titlePlaceholder')"
            chip-testid="add-entry-project"
            data-testid="add-entry-title-input"
          />
        </div>

        <div class="grid gap-1">
          <label for="add-entry-date">{{ t('timerView.addEntry.dateLabel') }}</label>
          <UInputDate
            id="add-entry-date"
            v-model="dateValue"
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
        </div>

        <div class="grid gap-1">
          <label for="add-entry-times">{{ t('timerView.addEntry.timesLabel') }}</label>
          <TimeField
            id="add-entry-times"
            v-model="timesValue"
            range
            :label="t('timerView.addEntry.timesLabel')"
            :invalid="!!rangeError"
            :describedby="rangeError ? 'add-entry-range-error' : undefined"
            testid="add-entry-time-input"
          />
        </div>

        <p
          v-if="rangeError"
          id="add-entry-range-error"
          class="m-0 text-sm text-error"
          role="alert"
          data-testid="add-entry-range-error"
        >
          {{ rangeError }}
        </p>

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
