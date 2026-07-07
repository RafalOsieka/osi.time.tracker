<script setup lang="ts">
import { Form } from '@primevue/forms';
import { zodResolver } from '@primevue/forms/resolvers/zod';
import type { FormSubmitEvent } from '@primevue/forms';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const confirm = useConfirm();
const toast = useToast();
const { $csrfFetch } = useNuxtApp();

const NONE_PROJECT_FILTER = 'none';

const resolver = zodResolver(createTaskSchema);

// --- Data fetching ---
const { data: projectsData, pending: projectsPending } = useAsyncData(
  'projects-for-tasks',
  () => $fetch<ProjectDto[]>('/api/projects'),
  { server: false },
);
const extraProjectOptions = ref<ProjectDto[]>([]);
const projectOptions = computed(() => {
  const active = projectsData.value ?? [];
  const missing = extraProjectOptions.value.filter(
    (extra) => !active.some((p) => p.id === extra.id),
  );
  return [...active, ...missing];
});
const filterProjectOptions = computed(() => [
  { id: NONE_PROJECT_FILTER, name: t('tasksPage.projectFilterNone') },
  ...projectOptions.value,
]);

const projectFilter = ref<string | null>(null);

const {
  data: tasksData,
  pending: tasksPending,
  refresh: fetchTasks,
} = useAsyncData(
  'tasks',
  () =>
    $fetch<TaskDto[]>('/api/tasks', {
      query: projectFilter.value ? { projectId: projectFilter.value } : {},
    }),
  { server: false, watch: [projectFilter] },
);

// --- State ---
const tasks = computed(() => tasksData.value ?? []);
const dialogVisible = ref(false);
const editingTask = ref<TaskDto | null>(null);
const initialValues = ref<{ name: string; projectId: string | null }>({
  name: '',
  projectId: null,
});
const nameServerError = ref('');
const saving = ref(false);

// --- Dialog helpers ---
function openCreate() {
  editingTask.value = null;
  initialValues.value = {
    name: '',
    projectId:
      projectFilter.value && projectFilter.value !== NONE_PROJECT_FILTER
        ? projectFilter.value
        : null,
  };
  nameServerError.value = '';
  dialogVisible.value = true;
}

function openEdit(task: TaskDto) {
  editingTask.value = task;
  initialValues.value = { name: task.name, projectId: task.projectId };
  nameServerError.value = '';
  if (task.projectId && !projectOptions.value.some((p) => p.id === task.projectId)) {
    extraProjectOptions.value = [
      {
        id: task.projectId,
        name: task.projectName ?? '',
        clientId: '',
        clientName: task.clientName ?? '',
        createdAt: '',
      },
    ];
  }
  dialogVisible.value = true;
}

function closeDialog() {
  dialogVisible.value = false;
}

defineExpose({ openEdit });

// --- Save (create or update) ---
async function onSave({ valid, values }: FormSubmitEvent) {
  nameServerError.value = '';
  if (!valid) return;

  saving.value = true;
  try {
    if (editingTask.value) {
      const payload: UpdateTaskDto = { name: values.name, projectId: values.projectId };

      const updated = await $csrfFetch<TaskDto>(`/api/tasks/${editingTask.value.id}`, {
        method: 'PATCH',
        body: payload,
      });

      await fetchTasks();
      toast.add({
        severity: 'success',
        summary: t('tasksPage.toastUpdatedSummary'),
        detail: t('tasksPage.toastUpdatedDetail', { name: updated.name }),
        life: 3000,
      });
    } else {
      const payload: CreateTaskDto = { name: values.name, projectId: values.projectId };

      const created = await $csrfFetch<TaskDto>('/api/tasks', {
        method: 'POST',
        body: payload,
      });

      await fetchTasks();
      toast.add({
        severity: 'success',
        summary: t('tasksPage.toastCreatedSummary'),
        detail: t('tasksPage.toastCreatedDetail', { name: created.name }),
        life: 3000,
      });
    }
    closeDialog();
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

// --- Delete ---
function onDelete(task: Pick<TaskDto, 'id' | 'name'>) {
  confirm.require({
    header: t('tasksPage.deleteConfirmHeader'),
    message: t('tasksPage.deleteConfirmMessage', { name: task.name }),
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: t('tasksPage.deleteConfirmAccept'),
    rejectLabel: t('tasksPage.deleteConfirmReject'),
    acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        await $csrfFetch(`/api/tasks/${task.id}`, { method: 'DELETE' });
        await fetchTasks();
        toast.add({
          severity: 'success',
          summary: t('tasksPage.toastDeletedSummary'),
          detail: t('tasksPage.toastDeletedDetail'),
          life: 3000,
        });
      } catch (err: unknown) {
        const key = extractMessageKey(err, 'errors.unexpected');
        toast.add({ severity: 'error', summary: t(key), life: 4000 });
      }
    },
  });
}
</script>

<template>
  <div data-testid="tasks-page">
    <div class="tasks-filter">
      <label for="task-project-filter">{{ t('tasksPage.projectFilterLabel') }}</label>
      <Select
        id="task-project-filter"
        v-model="projectFilter"
        :options="filterProjectOptions"
        option-label="name"
        option-value="id"
        show-clear
        :placeholder="t('tasksPage.projectFilterAll')"
        :loading="projectsPending"
        data-testid="task-project-filter"
      />
    </div>

    <DataTable
      :value="tasks"
      data-key="id"
      :sort-field="'name'"
      :sort-order="1"
      :loading="tasksPending"
      data-testid="tasks-table"
    >
      <template #header>
        <TableHeader
          :title="t('tasksPage.pageTitle')"
          :new-label="t('tasksPage.newButton')"
          new-testid="new-task-button"
          @create="openCreate"
        />
      </template>

      <template #empty>
        <EmptyState
          :message="t('tasksPage.emptyState')"
          :cta-label="t('tasksPage.emptyStateCta')"
          testid="tasks-empty-state"
          @create="openCreate"
        />
      </template>

      <Column field="name" :header="t('tasksPage.columnName')" sortable />
      <Column :header="t('tasksPage.columnProject')">
        <template #body="{ data }: { data: TaskDto }">
          {{ data.projectName ?? t('tasksPage.noProject') }}
        </template>
      </Column>
      <Column :header="t('tasksPage.columnClient')">
        <template #body="{ data }: { data: TaskDto }">
          {{ data.clientName ?? '' }}
        </template>
      </Column>
      <Column :header="t('tasksPage.columnActions')" style="width: 1%; white-space: nowrap">
        <template #body="{ data }: { data: TaskDto }">
          <RowActions
            :edit-label="t('tasksPage.editButton')"
            :delete-label="t('tasksPage.deleteButton')"
            :edit-testid="`edit-task-${data.id}`"
            :delete-testid="`delete-task-${data.id}`"
            @edit="openEdit(data)"
            @delete="onDelete(data)"
          />
        </template>
      </Column>
    </DataTable>

    <Dialog
      v-model:visible="dialogVisible"
      :header="editingTask ? t('tasksPage.dialogTitleEdit') : t('tasksPage.dialogTitleCreate')"
      modal
      :closable="true"
      data-testid="task-dialog"
      @hide="closeDialog"
    >
      <Form :resolver="resolver" :initial-values="initialValues" class="task-form" @submit="onSave">
        <FormFieldWrap
          v-slot="{ field }"
          :label="t('tasksPage.nameLabel')"
          name="name"
          input-id="task-name"
          error-testid="task-name-error"
          :server-error="nameServerError"
        >
          <InputText
            id="task-name"
            :maxlength="TASK_NAME_MAX_LENGTH"
            :placeholder="t('tasksPage.namePlaceholder')"
            :aria-invalid="field?.invalid"
            :aria-describedby="field?.invalid ? 'task-name-error' : undefined"
            data-testid="task-name-input"
          />
        </FormFieldWrap>

        <label for="task-project">{{ t('tasksPage.projectLabel') }}</label>
        <Select
          id="task-project"
          name="projectId"
          :options="projectOptions"
          option-label="name"
          option-value="id"
          show-clear
          :placeholder="t('tasksPage.projectPlaceholder')"
          data-testid="task-project-select"
        />

        <FormDialogFooter
          :cancel-label="t('tasksPage.cancelButton')"
          :save-label="t('tasksPage.saveButton')"
          :saving="saving"
          @cancel="closeDialog"
        />
      </Form>
    </Dialog>
  </div>
</template>

<style scoped>
.tasks-filter {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.task-form {
  display: grid;
  gap: 0.75rem;
  min-width: 20rem;
}
</style>
