<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { combineLocalDateAndTime } from '~/utils/timerViewGrouping';
import type { TimeEntryDto } from '../../shared/types/time-entry';

const props = defineProps<{
  visible: boolean;
  date: Date | null;
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

const title = ref('');
const startTime = ref('09:00');
const endTime = ref('10:00');
const suggestions = ref<TaskDto[]>([]);
const searchTerm = ref('');
const rangeError = ref('');
const saving = ref(false);

watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      title.value = '';
      searchTerm.value = '';
      startTime.value = '09:00';
      endTime.value = '10:00';
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

function onSelectSuggestion(task: TaskDto) {
  title.value = task.name;
  searchTerm.value = task.name;
}

function close() {
  open.value = false;
}

async function onSave() {
  if (!props.date) return;
  rangeError.value = '';

  const startedAt = combineLocalDateAndTime(props.date, startTime.value, props.timeZone);
  const stoppedAt = combineLocalDateAndTime(props.date, endTime.value, props.timeZone);

  if (new Date(startedAt).getTime() > new Date(stoppedAt).getTime()) {
    rangeError.value = t('timerView.addEntry.rangeError');
    return;
  }

  saving.value = true;
  try {
    const trimmed = title.value.trim();
    const created = await $csrfFetch<TimeEntryDto>('/api/time-entries', {
      method: 'POST',
      body: { title: trimmed || null, startedAt, stoppedAt },
    });
    toast.success(t('timerView.addEntry.toastSuccessSummary'));
    close();
    emit('added', created);
  } catch (err: unknown) {
    const key = extractMessageKey(err, 'errors.unexpected');
    toast.error(t(key));
  } finally {
    saving.value = false;
  }
}

// Autocomplete mode wants a free-form string model; cast items so the prop types accept it.
const titleMenuItems = computed(() => suggestions.value as unknown as string[]);
</script>

<template>
  <UModal v-model:open="open" :title="t('timerView.addEntry.dialogTitle')">
    <template #body>
      <form data-testid="add-entry-dialog" class="grid min-w-80 gap-3" @submit.prevent="onSave">
        <div class="grid gap-1">
          <label for="add-entry-title">{{ t('timerView.addEntry.titleLabel') }}</label>
          <UInputMenu
            id="add-entry-title"
            v-model="title"
            v-model:search-term="searchTerm"
            :items="titleMenuItems"
            mode="autocomplete"
            ignore-filter
            :placeholder="t('timerView.addEntry.titlePlaceholder')"
            data-testid="add-entry-title-input"
          >
            <template #item-label="{ item }">
              <button
                type="button"
                class="w-full text-left"
                @click="onSelectSuggestion(item as unknown as TaskDto)"
              >
                {{ (item as unknown as TaskDto).name }}
              </button>
            </template>
          </UInputMenu>
        </div>

        <div class="grid gap-1">
          <label for="add-entry-start-time">{{ t('timerView.addEntry.startLabel') }}</label>
          <TimeInput
            id="add-entry-start-time"
            v-model="startTime"
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
            v-model="endTime"
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
      </form>
    </template>
  </UModal>
</template>
