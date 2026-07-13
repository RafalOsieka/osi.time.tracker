<script setup lang="ts">
import type { AutoCompleteCompleteEvent } from 'primevue/autocomplete';
import { useI18n } from 'vue-i18n';
import { useToast } from 'primevue/usetoast';
import { combineLocalDateAndTime } from '~/utils/timerViewGrouping';
import type { TimeEntryDto } from '../../shared/types/time-entry';

const props = defineProps<{
  visible: boolean;
  date: Date | null;
  timeZone: string;
}>();

const emit = defineEmits<{ 'update:visible': [boolean]; added: [TimeEntryDto] }>();

const { t } = useI18n();
const toast = useToast();
const { $csrfFetch } = useNuxtApp();

const title = ref('');
const startTime = ref('09:00');
const endTime = ref('10:00');
const suggestions = ref<TaskDto[]>([]);
const rangeError = ref('');
const saving = ref(false);

watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      title.value = '';
      startTime.value = '09:00';
      endTime.value = '10:00';
      rangeError.value = '';
    }
  },
);

async function search(event: AutoCompleteCompleteEvent) {
  const query = typeof event.query === 'string' ? event.query : '';
  suggestions.value = await $fetch<TaskDto[]>('/api/tasks', { query: { search: query } });
}

function onSelectSuggestion(task: TaskDto) {
  title.value = task.name;
}

function close() {
  emit('update:visible', false);
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
    toast.add({
      severity: 'success',
      summary: t('timerView.addEntry.toastSuccessSummary'),
      life: 3000,
    });
    close();
    emit('added', created);
  } catch (err: unknown) {
    const key = extractMessageKey(err, 'errors.unexpected');
    toast.add({ severity: 'error', summary: t(key), life: 4000 });
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <Dialog
    :visible="visible"
    :header="t('timerView.addEntry.dialogTitle')"
    modal
    closable
    data-testid="add-entry-dialog"
    @update:visible="emit('update:visible', $event)"
  >
    <form class="add-entry-form" @submit.prevent="onSave">
      <label for="add-entry-title">{{ t('timerView.addEntry.titleLabel') }}</label>
      <AutoComplete
        v-model="title"
        input-id="add-entry-title"
        :suggestions="suggestions"
        option-label="name"
        :placeholder="t('timerView.addEntry.titlePlaceholder')"
        data-testid="add-entry-title-input"
        @complete="search"
        @item-select="(e: { value: TaskDto }) => onSelectSuggestion(e.value)"
      >
        <template #option="{ option }: { option: TaskDto }">
          {{ option.name }}
        </template>
      </AutoComplete>

      <div class="add-entry-form__times">
        <div class="add-entry-form__time-field">
          <label for="add-entry-start-time">{{ t('timerView.addEntry.startLabel') }}</label>
          <TimeInput
            id="add-entry-start-time"
            v-model="startTime"
            :label="t('timerView.addEntry.startLabel')"
            :aria-invalid="!!rangeError"
            :aria-describedby="rangeError ? 'add-entry-range-error' : undefined"
            testid="add-entry-start-input"
          />
        </div>
        <div class="add-entry-form__time-field">
          <label for="add-entry-end-time">{{ t('timerView.addEntry.endLabel') }}</label>
          <TimeInput
            id="add-entry-end-time"
            v-model="endTime"
            :label="t('timerView.addEntry.endLabel')"
            :aria-invalid="!!rangeError"
            :aria-describedby="rangeError ? 'add-entry-range-error' : undefined"
            testid="add-entry-end-input"
          />
        </div>
      </div>

      <Message
        v-if="rangeError"
        id="add-entry-range-error"
        severity="error"
        size="small"
        variant="simple"
        role="alert"
        data-testid="add-entry-range-error"
      >
        {{ rangeError }}
      </Message>

      <FormDialogFooter
        :cancel-label="t('timerView.addEntry.cancelButton')"
        :save-label="t('timerView.addEntry.saveButton')"
        :saving="saving"
        @cancel="close"
      />
    </form>
  </Dialog>
</template>

<style scoped>
.add-entry-form {
  display: grid;
  gap: 0.75rem;
  min-width: 20rem;
}

.add-entry-form__times {
  display: flex;
  gap: 1rem;
}

.add-entry-form__time-field {
  display: grid;
  gap: 0.375rem;
}
</style>
