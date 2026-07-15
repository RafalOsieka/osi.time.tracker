<script setup lang="ts">
import { Form } from '@primevue/forms';
import { zodResolver } from '@primevue/forms/resolvers/zod';
import type { FormSubmitEvent } from '@primevue/forms';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import { useI18n } from 'vue-i18n';

const { t, locale } = useI18n();
const confirm = useConfirm();
const toast = useToast();
const { $csrfFetch } = useNuxtApp();

const resolver = zodResolver(createProjectSchema);

// --- Data fetching ---
// `immediate: false` + fetching in `onMounted` keeps `pending` at `false` during
// hydration (matching the server-rendered markup) instead of flipping to `true`
// synchronously during setup, which caused a DataTable/Select loading hydration
// mismatch.
const {
  data: clientsData,
  pending: clientsPending,
  refresh: fetchClientOptions,
} = useAsyncData('clients-for-projects', () => $fetch<ClientDto[]>('/api/clients'), {
  server: false,
  immediate: false,
});
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
  { server: false, immediate: false, watch: [clientFilter] },
);
onMounted(() => {
  void fetchClientOptions();
  void fetchProjects();
});

// --- State ---
const projects = computed(() => projectsData.value ?? []);
const dialogVisible = ref(false);
const editingProject = ref<ProjectDto | null>(null);
const initialValues = ref<{ name: string; clientId: string | null }>({ name: '', clientId: null });
const nameServerError = ref('');
const clientServerError = ref('');
const saving = ref(false);

// --- Dialog helpers ---
function openCreate() {
  editingProject.value = null;
  initialValues.value = { name: '', clientId: clientFilter.value };
  nameServerError.value = '';
  clientServerError.value = '';
  dialogVisible.value = true;
}

function openEdit(project: ProjectDto) {
  editingProject.value = project;
  initialValues.value = { name: project.name, clientId: project.clientId };
  nameServerError.value = '';
  clientServerError.value = '';
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
async function onSave({ valid, values }: FormSubmitEvent) {
  nameServerError.value = '';
  clientServerError.value = '';
  if (!valid) return;

  saving.value = true;
  try {
    if (editingProject.value) {
      const payload: UpdateProjectDto = { name: values.name, clientId: values.clientId };

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
      const payload: CreateProjectDto = { name: values.name, clientId: values.clientId };

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
      nameServerError.value = t(key);
    } else if (key === 'error.projectClientRequired') {
      clientServerError.value = t(key);
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
        <TableHeader
          :title="t('projects.pageTitle')"
          :new-label="t('projects.newButton')"
          new-testid="new-project-button"
          @create="openCreate"
        />
      </template>

      <template #empty>
        <EmptyState
          :message="t('projects.emptyState')"
          :cta-label="t('projects.emptyStateCta')"
          testid="projects-empty-state"
          @create="openCreate"
        />
      </template>

      <Column field="name" :header="t('projects.columnName')" sortable />
      <Column :header="t('projects.columnClient')">
        <template #body="{ data }: { data: ProjectDto }">
          {{ data.clientName }}
        </template>
      </Column>
      <Column field="createdAt" :header="t('projects.columnCreated')" sortable>
        <template #body="{ data }: { data: ProjectDto }">
          {{ formatDate(data.createdAt, locale) }}
        </template>
      </Column>
      <Column :header="t('projects.columnActions')" style="width: 1%; white-space: nowrap">
        <template #body="{ data }: { data: ProjectDto }">
          <RowActions
            :edit-label="t('projects.editButton')"
            :delete-label="t('projects.deleteButton')"
            :edit-testid="`edit-project-${data.id}`"
            :delete-testid="`delete-project-${data.id}`"
            @edit="openEdit(data)"
            @delete="onDelete(data)"
          />
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
      <Form
        :resolver="resolver"
        :initial-values="initialValues"
        class="project-form"
        @submit="onSave"
      >
        <FormFieldWrap
          v-slot="{ field }"
          :label="t('projects.nameLabel')"
          name="name"
          input-id="project-name"
          error-testid="project-name-error"
          :server-error="nameServerError"
        >
          <InputText
            id="project-name"
            :maxlength="PROJECT_NAME_MAX_LENGTH"
            :placeholder="t('projects.namePlaceholder')"
            :aria-invalid="field?.invalid"
            :aria-describedby="field?.invalid ? 'project-name-error' : undefined"
            data-testid="project-name-input"
          />
        </FormFieldWrap>

        <FormFieldWrap
          v-slot="{ field }"
          :label="t('projects.clientLabel')"
          name="clientId"
          input-id="project-client"
          error-testid="project-client-error"
          :server-error="clientServerError"
        >
          <Select
            id="project-client"
            :options="clientOptions"
            option-label="name"
            option-value="id"
            :placeholder="t('projects.clientPlaceholder')"
            :aria-invalid="field?.invalid"
            :aria-describedby="field?.invalid ? 'project-client-error' : undefined"
            data-testid="project-client-select"
          />
        </FormFieldWrap>

        <FormDialogFooter
          :cancel-label="t('projects.cancelButton')"
          :save-label="t('projects.saveButton')"
          :saving="saving"
          @cancel="closeDialog"
        />
      </Form>
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

.project-form {
  display: grid;
  gap: 0.75rem;
  min-width: 20rem;
}
</style>
