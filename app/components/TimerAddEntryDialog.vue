<script setup lang="ts">
import type { FormErrorEvent } from '@nuxt/ui';
import { useI18n } from 'vue-i18n';
import { wallClockToInstant, localDayKeyFromInstant } from '~/utils/dateTime';
import { buildTaskTitleMenuItems } from '~/utils/taskTitleMenu';
import type { TimeEntryDto, TimerAddEntryFormDto } from '~~/shared/types/time-entry';
import { timerAddEntryFormSchema } from '~~/shared/types/time-entry';

const props = defineProps<{
  visible: boolean;
  timeZone: string;
}>();

const emit = defineEmits<{ 'update:visible': [boolean]; added: [TimeEntryDto] }>();

const { t } = useI18n();
const toast = useAppToast();
const { $csrfFetch } = useNuxtApp();

const open = computed({
  get: () => props.visible,
  set: (value: boolean) => emit('update:visible', value),
});

function todayKey(): string {
  return localDayKeyFromInstant(new Date().toISOString(), props.timeZone);
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

watch(
  () => props.visible,
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
  suggestions.value = await $fetch<TaskDto[]>('/api/tasks', { query: { search: query } });
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

  const startedAt = wallClockToInstant(state.date, state.startTime, props.timeZone);
  const stoppedAt = wallClockToInstant(state.date, state.endTime, props.timeZone);

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
          <UInput
            id="add-entry-date"
            v-model="state.date"
            type="date"
            data-testid="add-entry-date-input"
          />
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
