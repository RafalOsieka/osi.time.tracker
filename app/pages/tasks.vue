<script setup lang="ts">
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const confirm = useConfirm();
const toast = useToast();
const { $csrfFetch } = useNuxtApp();

const NONE_PROJECT_FILTER = 'none';

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
const nameValue = ref('');
const nameError = ref('');
const projectValue = ref<string | null>(null);
const saving = ref(false);

// --- Dialog helpers ---
function openCreate() {
  editingTask.value = null;
  nameValue.value = '';
  nameError.value = '';
  projectValue.value =
    projectFilter.value && projectFilter.value !== NONE_PROJECT_FILTER ? projectFilter.value : null;
  dialogVisible.value = true;
}

function openEdit(task: TaskDto) {
  editingTask.value = task;
  nameValue.value = task.name;
  nameError.value = '';
  projectValue.value = task.projectId;
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
async function onSave() {
  nameError.value = '';

  saving.value = true;
  try {
    if (editingTask.value) {
      const payload: UpdateTaskDto = { name: nameValue.value, projectId: projectValue.value };

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
      const payload: CreateTaskDto = { name: nameValue.value, projectId: projectValue.value };

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
      nameError.value = t(key);
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
    <ConfirmDialog />

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
      :sort-field="'number'"
      :sort-order="1"
      :loading="tasksPending"
      data-testid="tasks-table"
    >
      <template #header>
        <div class="tasks-header">
          <span class="tasks-title">{{ t('tasksPage.pageTitle') }}</span>
          <Button
            :label="t('tasksPage.newButton')"
            icon="pi pi-plus"
            data-testid="new-task-button"
            @click="openCreate"
          />
        </div>
      </template>

      <template #empty>
        <div class="tasks-empty" data-testid="tasks-empty-state">
          <p>{{ t('tasksPage.emptyState') }}</p>
          <Button
            :label="t('tasksPage.emptyStateCta')"
            icon="pi pi-plus"
            data-testid="empty-state-cta"
            @click="openCreate"
          />
        </div>
      </template>

      <Column field="number" :header="t('tasksPage.columnNumber')" sortable>
        <template #body="{ data }: { data: TaskDto }">#{{ data.number }}</template>
      </Column>
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
          <div class="tasks-actions">
            <Button
              icon="pi pi-pencil"
              text
              rounded
              :aria-label="t('tasksPage.editButton')"
              :data-testid="`edit-task-${data.id}`"
              @click="openEdit(data)"
            />
            <Button
              icon="pi pi-trash"
              text
              rounded
              severity="danger"
              :aria-label="t('tasksPage.deleteButton')"
              :data-testid="`delete-task-${data.id}`"
              @click="onDelete(data)"
            />
          </div>
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
      <form class="task-form" @submit.prevent="onSave">
        <label for="task-name">{{ t('tasksPage.nameLabel') }}</label>
        <InputText
          id="task-name"
          v-model="nameValue"
          required
          :maxlength="TASK_NAME_MAX_LENGTH"
          :placeholder="t('tasksPage.namePlaceholder')"
          :aria-invalid="!!nameError"
          :aria-describedby="nameError ? 'task-name-error' : undefined"
          data-testid="task-name-input"
        />
        <small
          v-if="nameError"
          id="task-name-error"
          role="alert"
          class="task-field-error"
          data-testid="task-name-error"
        >
          {{ nameError }}
        </small>

        <label for="task-project">{{ t('tasksPage.projectLabel') }}</label>
        <Select
          id="task-project"
          v-model="projectValue"
          :options="projectOptions"
          option-label="name"
          option-value="id"
          show-clear
          :placeholder="t('tasksPage.projectPlaceholder')"
          data-testid="task-project-select"
        />

        <div class="task-form-actions">
          <Button
            type="button"
            :label="t('tasksPage.cancelButton')"
            text
            data-testid="cancel-button"
            @click="closeDialog"
          />
          <Button
            type="submit"
            :label="t('tasksPage.saveButton')"
            :loading="saving"
            data-testid="save-button"
          />
        </div>
      </form>
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

.tasks-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.tasks-title {
  font-size: 1.25rem;
  font-weight: 600;
}

.tasks-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 2rem;
}

.tasks-actions {
  display: flex;
  gap: 0.25rem;
}

.task-form {
  display: grid;
  gap: 0.75rem;
  min-width: 20rem;
}

.task-form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.task-field-error {
  color: var(--p-form-field-invalid-color);
}
</style>
