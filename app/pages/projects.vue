<script setup lang="ts">
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const confirm = useConfirm();
const toast = useToast();
const { $csrfFetch } = useNuxtApp();

// --- Data fetching ---
const { data: clientsData, pending: clientsPending } = useAsyncData(
  'clients-for-projects',
  () => $fetch<ClientDto[]>('/api/clients'),
  { server: false },
);
const extraClientOptions = ref<ClientDto[]>([]);
const clientOptions = computed(() => {
  const active = clientsData.value ?? [];
  const missing = extraClientOptions.value.filter(
    (extra) => !active.some((c) => c.id === extra.id),
  );
  return [...active, ...missing];
});

const clientFilter = ref<string | null>(null);

const {
  data: projectsData,
  pending: projectsPending,
  refresh: fetchProjects,
} = useAsyncData(
  'projects',
  () =>
    $fetch<ProjectDto[]>('/api/projects', {
      query: clientFilter.value ? { clientId: clientFilter.value } : {},
    }),
  { server: false, watch: [clientFilter] },
);

// --- State ---
const projects = computed(() => projectsData.value ?? []);
const dialogVisible = ref(false);
const editingProject = ref<ProjectDto | null>(null);
const nameValue = ref('');
const nameError = ref('');
const clientValue = ref<string | null>(null);
const clientError = ref('');
const saving = ref(false);

// --- Dialog helpers ---
function openCreate() {
  editingProject.value = null;
  nameValue.value = '';
  nameError.value = '';
  clientValue.value = clientFilter.value;
  clientError.value = '';
  dialogVisible.value = true;
}

function openEdit(project: ProjectDto) {
  editingProject.value = project;
  nameValue.value = project.name;
  nameError.value = '';
  clientValue.value = project.clientId;
  clientError.value = '';
  if (!clientOptions.value.some((c) => c.id === project.clientId)) {
    extraClientOptions.value = [{ id: project.clientId, name: project.clientName, createdAt: '' }];
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
  clientError.value = '';

  if (!clientValue.value) {
    clientError.value = t('error.projectClientRequired');
    return;
  }

  saving.value = true;
  try {
    if (editingProject.value) {
      const payload: UpdateProjectDto = { name: nameValue.value, clientId: clientValue.value };

      const updated = await $csrfFetch<ProjectDto>(`/api/projects/${editingProject.value.id}`, {
        method: 'PATCH',
        body: payload,
      });

      await fetchProjects();
      toast.add({
        severity: 'success',
        summary: t('projects.toastUpdatedSummary'),
        detail: t('projects.toastUpdatedDetail', { name: updated.name }),
        life: 3000,
      });
    } else {
      const payload: CreateProjectDto = { name: nameValue.value, clientId: clientValue.value };

      const created = await $csrfFetch<ProjectDto>('/api/projects', {
        method: 'POST',
        body: payload,
      });

      await fetchProjects();
      toast.add({
        severity: 'success',
        summary: t('projects.toastCreatedSummary'),
        detail: t('projects.toastCreatedDetail', { name: created.name }),
        life: 3000,
      });
    }
    closeDialog();
  } catch (err: unknown) {
    const key = extractMessageKey(err, 'errors.unexpected');
    if (
      key === 'error.projectNameRequired' ||
      key === 'error.projectNameDuplicate' ||
      key === 'error.projectNameTooLong'
    ) {
      nameError.value = t(key);
    } else if (key === 'error.projectClientRequired') {
      clientError.value = t(key);
    } else {
      toast.add({ severity: 'error', summary: t(key), life: 4000 });
    }
  } finally {
    saving.value = false;
  }
}

// --- Delete ---
function onDelete(project: Pick<ProjectDto, 'id' | 'name'>) {
  confirm.require({
    header: t('projects.deleteConfirmHeader'),
    message: t('projects.deleteConfirmMessage', { name: project.name }),
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: t('projects.deleteConfirmAccept'),
    rejectLabel: t('projects.deleteConfirmReject'),
    acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        await $csrfFetch(`/api/projects/${project.id}`, { method: 'DELETE' });
        await fetchProjects();
        toast.add({
          severity: 'success',
          summary: t('projects.toastDeletedSummary'),
          detail: t('projects.toastDeletedDetail'),
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
  <div data-testid="projects-page">
    <ConfirmDialog />

    <div class="projects-filter">
      <label for="project-client-filter">{{ t('projects.clientFilterLabel') }}</label>
      <Select
        id="project-client-filter"
        v-model="clientFilter"
        :options="clientOptions"
        option-label="name"
        option-value="id"
        show-clear
        :placeholder="t('projects.clientFilterAll')"
        :loading="clientsPending"
        data-testid="project-client-filter"
      />
    </div>

    <DataTable
      :value="projects"
      data-key="id"
      :sort-field="'name'"
      :sort-order="1"
      :loading="projectsPending"
      data-testid="projects-table"
    >
      <template #header>
        <div class="projects-header">
          <span class="projects-title">{{ t('projects.pageTitle') }}</span>
          <Button
            :label="t('projects.newButton')"
            icon="pi pi-plus"
            data-testid="new-project-button"
            @click="openCreate"
          />
        </div>
      </template>

      <template #empty>
        <div class="projects-empty" data-testid="projects-empty-state">
          <p>{{ t('projects.emptyState') }}</p>
          <Button
            :label="t('projects.emptyStateCta')"
            icon="pi pi-plus"
            data-testid="empty-state-cta"
            @click="openCreate"
          />
        </div>
      </template>

      <Column field="name" :header="t('projects.columnName')" sortable />
      <Column :header="t('projects.columnClient')">
        <template #body="{ data }: { data: ProjectDto }">
          {{ data.clientName }}
        </template>
      </Column>
      <Column field="createdAt" :header="t('projects.columnCreated')" sortable>
        <template #body="{ data }: { data: ProjectDto }">
          {{ new Date(data.createdAt).toLocaleDateString() }}
        </template>
      </Column>
      <Column :header="t('projects.columnActions')" style="width: 1%; white-space: nowrap">
        <template #body="{ data }: { data: ProjectDto }">
          <div class="projects-actions">
            <Button
              icon="pi pi-pencil"
              text
              rounded
              :aria-label="t('projects.editButton')"
              :data-testid="`edit-project-${data.id}`"
              @click="openEdit(data)"
            />
            <Button
              icon="pi pi-trash"
              text
              rounded
              severity="danger"
              :aria-label="t('projects.deleteButton')"
              :data-testid="`delete-project-${data.id}`"
              @click="onDelete(data)"
            />
          </div>
        </template>
      </Column>
    </DataTable>

    <Dialog
      v-model:visible="dialogVisible"
      :header="editingProject ? t('projects.dialogTitleEdit') : t('projects.dialogTitleCreate')"
      modal
      :closable="true"
      data-testid="project-dialog"
      @hide="closeDialog"
    >
      <form class="project-form" @submit.prevent="onSave">
        <label for="project-name">{{ t('projects.nameLabel') }}</label>
        <InputText
          id="project-name"
          v-model="nameValue"
          required
          :maxlength="PROJECT_NAME_MAX_LENGTH"
          :placeholder="t('projects.namePlaceholder')"
          :aria-invalid="!!nameError"
          :aria-describedby="nameError ? 'project-name-error' : undefined"
          data-testid="project-name-input"
        />
        <small
          v-if="nameError"
          id="project-name-error"
          role="alert"
          class="project-field-error"
          data-testid="project-name-error"
        >
          {{ nameError }}
        </small>

        <label for="project-client">{{ t('projects.clientLabel') }}</label>
        <Select
          id="project-client"
          v-model="clientValue"
          :options="clientOptions"
          option-label="name"
          option-value="id"
          :placeholder="t('projects.clientPlaceholder')"
          :aria-invalid="!!clientError"
          :aria-describedby="clientError ? 'project-client-error' : undefined"
          data-testid="project-client-select"
        />
        <small
          v-if="clientError"
          id="project-client-error"
          role="alert"
          class="project-field-error"
          data-testid="project-client-error"
        >
          {{ clientError }}
        </small>

        <div class="project-form-actions">
          <Button
            type="button"
            :label="t('projects.cancelButton')"
            text
            data-testid="cancel-button"
            @click="closeDialog"
          />
          <Button
            type="submit"
            :label="t('projects.saveButton')"
            :loading="saving"
            data-testid="save-button"
          />
        </div>
      </form>
    </Dialog>
  </div>
</template>

<style scoped>
.projects-filter {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.projects-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.projects-title {
  font-size: 1.25rem;
  font-weight: 600;
}

.projects-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 2rem;
}

.projects-actions {
  display: flex;
  gap: 0.25rem;
}

.project-form {
  display: grid;
  gap: 0.75rem;
  min-width: 20rem;
}

.project-form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.project-field-error {
  color: var(--p-form-field-invalid-color);
}
</style>
