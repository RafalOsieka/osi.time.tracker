<script setup lang="ts">
import type { AutoCompleteCompleteEvent } from 'primevue/autocomplete';
import { useI18n } from 'vue-i18n';
import { useToast } from 'primevue/usetoast';

const props = defineProps<{
  visible: boolean;
  ids: string[];
  projectOptions: ProjectDto[];
}>();

const emit = defineEmits<{ 'update:visible': [boolean]; assigned: [] }>();

const { t } = useI18n();
const toast = useToast();
const { $csrfFetch } = useNuxtApp();

const title = ref('');
const projectId = ref<string | null>(null);
const suggestions = ref<TaskDto[]>([]);
const nameError = ref('');
const saving = ref(false);

watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      title.value = '';
      projectId.value = null;
      nameError.value = '';
    }
  },
);

async function search(event: AutoCompleteCompleteEvent) {
  const query = typeof event.query === 'string' ? event.query : '';
  suggestions.value = await $fetch<TaskDto[]>('/api/tasks', { query: { search: query } });
}

function onSelectSuggestion(task: TaskDto) {
  title.value = task.name;
  projectId.value = task.projectId;
}

function close() {
  emit('update:visible', false);
}

async function onSave() {
  const trimmed = title.value.trim();
  if (!trimmed) {
    nameError.value = t('timerView.bulkAssign.nameRequiredError');
    return;
  }
  nameError.value = '';
  saving.value = true;
  try {
    await $csrfFetch('/api/time-entries/bulk-assign', {
      method: 'POST',
      body: { ids: props.ids, title: trimmed, projectId: projectId.value },
    });
    toast.add({
      severity: 'success',
      summary: t('timerView.bulkAssign.toastSuccessSummary'),
      detail: t('timerView.bulkAssign.toastSuccessDetail', { name: trimmed }),
      life: 3000,
    });
    close();
    emit('assigned');
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
    :header="t('timerView.bulkAssign.dialogTitle')"
    modal
    closable
    data-testid="bulk-assign-dialog"
    @update:visible="emit('update:visible', $event)"
  >
    <form class="bulk-assign-form" @submit.prevent="onSave">
      <label for="bulk-assign-name">{{ t('timerView.bulkAssign.nameLabel') }}</label>
      <AutoComplete
        v-model="title"
        input-id="bulk-assign-name"
        :suggestions="suggestions"
        option-label="name"
        :placeholder="t('timerView.bulkAssign.namePlaceholder')"
        :aria-invalid="!!nameError"
        :aria-describedby="nameError ? 'bulk-assign-name-error' : undefined"
        data-testid="bulk-assign-name-input"
        @complete="search"
        @item-select="(e: { value: TaskDto }) => onSelectSuggestion(e.value)"
      >
        <template #option="{ option }: { option: TaskDto }">
          {{ option.name }}
        </template>
      </AutoComplete>
      <Message
        v-if="nameError"
        id="bulk-assign-name-error"
        severity="error"
        size="small"
        variant="simple"
        role="alert"
        data-testid="bulk-assign-name-error"
      >
        {{ nameError }}
      </Message>

      <label for="bulk-assign-project">{{ t('timerView.bulkAssign.projectLabel') }}</label>
      <Select
        id="bulk-assign-project"
        v-model="projectId"
        :options="projectOptions"
        option-label="name"
        option-value="id"
        show-clear
        :placeholder="t('timerView.bulkAssign.projectPlaceholder')"
        data-testid="bulk-assign-project-select"
      />

      <FormDialogFooter
        :cancel-label="t('timerView.bulkAssign.cancelButton')"
        :save-label="t('timerView.bulkAssign.saveButton')"
        :saving="saving"
        @cancel="close"
      />
    </form>
  </Dialog>
</template>

<style scoped>
.bulk-assign-form {
  display: grid;
  gap: 0.75rem;
  min-width: 20rem;
}
</style>
