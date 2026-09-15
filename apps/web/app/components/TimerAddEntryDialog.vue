<script setup lang="ts">
import { CalendarDate, parseDate } from '@internationalized/date';
import type { FormErrorEvent } from '@nuxt/ui';
import type { TimeEntryDto, TimerAddEntryFormDto } from '~~/shared/types/time-entry';

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
const suggestions = ref<TaskDto[]>([]);
const searchTerm = ref('');
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

watch(
  () => visible,
  (visible) => {
    if (visible) {
      state.title = '';
      searchTerm.value = '';
      state.date = todayKey();
      state.startTime = '09:00';
      state.endTime = '10:00';
      rangeError.value = '';
    }
  },
);

async function search(query: string) {
  suggestions.value = await searchTasks(query);
}

watch(searchTerm, (query) => {
  void search(query ?? '');
});

function onSelectTask(task: TaskDto) {
  state.title = task.name;
  searchTerm.value = task.name;
}

function onSelectCreate(title: string) {
  state.title = title;
  searchTerm.value = title;
}

const titleMenuItems = computed(() =>
  buildTaskTitleMenuItems({
    suggestions: suggestions.value,
    searchText: searchTerm.value ?? '',
    noProjectLabel: t('timer.noTask'),
    createOptionLabel: (typed) => t('timer.createOption', { title: typed }),
    onSelectTask,
    onSelectCreate,
  }),
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

  // UInputMenu (autocomplete) keeps freeform typed text in `searchTerm` until
  // the user picks a suggestion; fall back to it so a typed title that
  // matches no existing task still submits instead of being silently
  // dropped as untitled (mirrors AppTimer's onToggle behavior).
  if (!state.title.trim()) {
    const typed = (searchTerm.value ?? '').trim();
    if (typed) {
      state.title = typed;
    }
  }

  const startedAt = wallClockToInstant(state.date, state.startTime, timeZone);
  const stoppedAt = wallClockToInstant(state.date, state.endTime, timeZone);

  saving.value = true;
  try {
    const trimmed = state.title.trim();
    const created = await $csrfFetch<TimeEntryDto>('/api/time-entries', {
      method: 'POST',
      body: { title: trimmed || null, startedAt, stoppedAt },
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
          <UInputMenu
            id="add-entry-title"
            v-model="state.title"
            v-model:search-term="searchTerm"
            :items="titleMenuItems"
            value-key="name"
            label-key="label"
            mode="autocomplete"
            ignore-filter
            :placeholder="t('timerView.addEntry.titlePlaceholder')"
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
          <label for="add-entry-start-time">{{ t('timerView.addEntry.startLabel') }}</label>
          <TimeInput
            id="add-entry-start-time"
            v-model="state.startTime"
            :label="t('timerView.addEntry.startLabel')"
            :compact="false"
            :invalid="!!rangeError"
            :describedby="rangeError ? 'add-entry-range-error' : undefined"
            testid="add-entry-start-input"
          />
        </div>

        <div class="grid gap-1">
          <label for="add-entry-end-time">{{ t('timerView.addEntry.endLabel') }}</label>
          <TimeInput
            id="add-entry-end-time"
            v-model="state.endTime"
            :label="t('timerView.addEntry.endLabel')"
            :compact="false"
            :invalid="!!rangeError"
            :describedby="rangeError ? 'add-entry-range-error' : undefined"
            testid="add-entry-end-input"
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
