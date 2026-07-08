<script setup lang="ts">
import { Form } from '@primevue/forms';
import { zodResolver } from '@primevue/forms/resolvers/zod';
import type { FormSubmitEvent } from '@primevue/forms';
import { useToast } from 'primevue/usetoast';
import { useI18n } from 'vue-i18n';

const props = defineProps<{
  visible: boolean;
  task: { id: string; name: string; projectId: string | null; projectName: string | null } | null;
  projectOptions: ProjectDto[];
}>();

const emit = defineEmits<{ 'update:visible': [boolean]; updated: [TaskDto] }>();

const { t } = useI18n();
const toast = useToast();
const { $csrfFetch } = useNuxtApp();

const resolver = zodResolver(updateTaskSchema);
const saving = ref(false);
const nameServerError = ref('');

const initialValues = computed(() => ({
  name: props.task?.name ?? '',
  projectId: props.task?.projectId ?? null,
}));

const extraProjectOptions = computed<ProjectDto[]>(() => {
  if (!props.task?.projectId) return [];
  const known = props.projectOptions.some((p) => p.id === props.task!.projectId);
  if (known) return [];
  return [
    {
      id: props.task.projectId,
      name: props.task.projectName ?? '',
      clientId: '',
      clientName: '',
      createdAt: '',
    },
  ];
});

const projectSelectOptions = computed(() => [
  ...props.projectOptions,
  ...extraProjectOptions.value,
]);

watch(
  () => props.visible,
  (visible) => {
    if (visible) nameServerError.value = '';
  },
);

function close() {
  emit('update:visible', false);
}

async function onSave({ valid, values }: FormSubmitEvent) {
  nameServerError.value = '';
  if (!valid || !props.task) return;

  saving.value = true;
  try {
    const updated = await $csrfFetch<TaskDto>(`/api/tasks/${props.task.id}`, {
      method: 'PATCH',
      body: { name: values.name, projectId: values.projectId } satisfies UpdateTaskDto,
    });
    toast.add({
      severity: 'success',
      summary: t('timerView.editor.toastUpdatedSummary'),
      detail: t('timerView.editor.toastUpdatedDetail', { name: updated.name }),
      life: 3000,
    });
    close();
    emit('updated', updated);
  } catch (err: unknown) {
    const key = extractMessageKey(err, 'errors.unexpected');
    if (key === 'error.taskNameRequired' || key === 'error.taskNameTooLong') {
      nameServerError.value = t(key);
    } else {
      toast.add({ severity: 'error', summary: t(key), life: 4000 });
    }
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <Dialog
    :visible="visible"
    :header="t('timerView.editor.dialogTitle')"
    modal
    closable
    data-testid="timer-task-editor-dialog"
    @update:visible="emit('update:visible', $event)"
  >
    <Form
      :resolver="resolver"
      :initial-values="initialValues"
      class="timer-task-editor-form"
      @submit="onSave"
    >
      <FormFieldWrap
        v-slot="{ field }"
        :label="t('timerView.editor.nameLabel')"
        name="name"
        input-id="timer-task-editor-name"
        error-testid="timer-task-editor-name-error"
        :server-error="nameServerError"
      >
        <InputText
          id="timer-task-editor-name"
          :placeholder="t('timerView.editor.namePlaceholder')"
          :aria-invalid="field?.invalid"
          :aria-describedby="field?.invalid ? 'timer-task-editor-name-error' : undefined"
          data-testid="timer-task-editor-name-input"
        />
      </FormFieldWrap>

      <label for="timer-task-editor-project">{{ t('timerView.editor.projectLabel') }}</label>
      <Select
        id="timer-task-editor-project"
        name="projectId"
        :options="projectSelectOptions"
        option-label="name"
        option-value="id"
        show-clear
        :placeholder="t('timerView.editor.projectPlaceholder')"
        data-testid="timer-task-editor-project-select"
      />

      <FormDialogFooter
        :cancel-label="t('timerView.editor.cancelButton')"
        :save-label="t('timerView.editor.saveButton')"
        :saving="saving"
        @cancel="close"
      />
    </Form>
  </Dialog>
</template>

<style scoped>
.timer-task-editor-form {
  display: grid;
  gap: 0.75rem;
  min-width: 20rem;
}
</style>
