<script setup lang="ts">
import type { FormSubmitEvent, TableColumn } from '@nuxt/ui';
import { useI18n } from 'vue-i18n';
import { h, resolveComponent } from 'vue';

const { t, locale } = useI18n();
const toast = useAppToast();
const confirm = useAppConfirm();
const { $csrfFetch } = useNuxtApp();
const { effective } = useUserSettings();

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

const clientFilter = ref<string | undefined>(undefined);

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

const projects = computed(() => projectsData.value ?? []);
const dialogOpen = ref(false);
const editingProject = ref<ProjectDto | null>(null);
const state = reactive<{ name: string; clientId: string | undefined }>({
  name: '',
  clientId: undefined,
});
const nameServerError = ref('');
const clientServerError = ref('');
const saving = ref(false);

function openCreate() {
  editingProject.value = null;
  state.name = '';
  state.clientId = clientFilter.value;
  nameServerError.value = '';
  clientServerError.value = '';
  dialogOpen.value = true;
}

function openEdit(project: ProjectDto) {
  editingProject.value = project;
  state.name = project.name;
  state.clientId = project.clientId;
  nameServerError.value = '';
  clientServerError.value = '';
  if (!clientOptions.value.some((c) => c.id === project.clientId)) {
    extraClientOptions.value = [{ id: project.clientId, name: project.clientName, createdAt: '' }];
  }
  dialogOpen.value = true;
}

function closeDialog() {
  dialogOpen.value = false;
}

defineExpose({ openEdit });

async function onSave(event: FormSubmitEvent<typeof state>) {
  nameServerError.value = '';
  clientServerError.value = '';
  saving.value = true;
  try {
    if (editingProject.value) {
      const payload: UpdateProjectDto = {
        name: event.data.name,
        clientId: event.data.clientId as string,
      };
      const updated = await $csrfFetch<ProjectDto>(`/api/projects/${editingProject.value.id}`, {
        method: 'PATCH',
        body: payload,
      });
      await fetchProjects();
      toast.success(
        t('projects.toastUpdatedSummary'),
        t('projects.toastUpdatedDetail', { name: updated.name }),
      );
    } else {
      const payload: CreateProjectDto = {
        name: event.data.name,
        clientId: event.data.clientId as string,
      };
      const created = await $csrfFetch<ProjectDto>('/api/projects', {
        method: 'POST',
        body: payload,
      });
      await fetchProjects();
      toast.success(
        t('projects.toastCreatedSummary'),
        t('projects.toastCreatedDetail', { name: created.name }),
      );
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
      toast.error(t(key));
    }
  } finally {
    saving.value = false;
  }
}

async function onDelete(project: Pick<ProjectDto, 'id' | 'name'>) {
  const accepted = await confirm({
    title: t('projects.deleteConfirmHeader'),
    description: t('projects.deleteConfirmMessage', { name: project.name }),
    confirmLabel: t('projects.deleteConfirmAccept'),
    cancelLabel: t('projects.deleteConfirmReject'),
  });
  if (!accepted) return;

  try {
    await $csrfFetch(`/api/projects/${project.id}`, { method: 'DELETE' });
    await fetchProjects();
    toast.success(t('projects.toastDeletedSummary'), t('projects.toastDeletedDetail'));
  } catch (err: unknown) {
    const key = extractMessageKey(err, 'errors.unexpected');
    toast.error(t(key));
  }
}

const columns = computed<TableColumn<ProjectDto>[]>(() => [
  {
    accessorKey: 'name',
    header: t('projects.columnName'),
  },
  {
    id: 'client',
    header: t('projects.columnClient'),
    cell: ({ row }) => row.original.clientName,
  },
  {
    accessorKey: 'createdAt',
    header: t('projects.columnCreated'),
    cell: ({ row }) => formatDate(row.original.createdAt, locale.value, effective.value.timeZone),
  },
  {
    id: 'actions',
    header: t('projects.columnActions'),
    cell: ({ row }) =>
      h(resolveComponent('RowActions'), {
        editLabel: t('projects.editButton'),
        deleteLabel: t('projects.deleteButton'),
        editTestid: `edit-project-${row.original.id}`,
        deleteTestid: `delete-project-${row.original.id}`,
        onEdit: () => openEdit(row.original),
        onDelete: () => onDelete(row.original),
      }),
  },
]);
</script>

<template>
  <div data-testid="projects-page" class="space-y-4">
    <div class="flex items-center gap-2">
      <label for="project-client-filter" class="text-sm">
        {{ t('projects.clientFilterLabel') }}
      </label>
      <USelect
        id="project-client-filter"
        v-model="clientFilter"
        :items="clientOptions"
        value-key="id"
        label-key="name"
        :placeholder="t('projects.clientFilterAll')"
        :loading="clientsPending"
        clearable
        class="min-w-48"
        data-testid="project-client-filter"
      />
    </div>

    <TableHeader
      :title="t('projects.pageTitle')"
      :new-label="t('projects.newButton')"
      new-testid="new-project-button"
      @create="openCreate"
    />

    <UTable
      :data="projects"
      :columns="columns"
      :loading="projectsPending"
      data-testid="projects-table"
      class="w-full"
    >
      <template #empty>
        <EmptyState
          :message="t('projects.emptyState')"
          :cta-label="t('projects.emptyStateCta')"
          testid="projects-empty-state"
          @create="openCreate"
        />
      </template>
    </UTable>

    <UModal
      v-model:open="dialogOpen"
      :title="editingProject ? t('projects.dialogTitleEdit') : t('projects.dialogTitleCreate')"
      @update:open="(value: boolean) => !value && closeDialog()"
    >
      <template #body>
        <div data-testid="project-dialog">
          <UForm
            :schema="createProjectSchema"
            :state="state"
            class="grid min-w-80 gap-3"
            @submit="onSave"
          >
            <UFormField
              :label="t('projects.nameLabel')"
              name="name"
              :error="nameServerError || undefined"
            >
              <UInput
                id="project-name"
                v-model="state.name"
                :maxlength="PROJECT_NAME_MAX_LENGTH"
                :placeholder="t('projects.namePlaceholder')"
                data-testid="project-name-input"
              />
              <template v-if="nameServerError" #error>
                <span id="project-name-error" data-testid="project-name-error" role="alert">
                  {{ nameServerError }}
                </span>
              </template>
            </UFormField>

            <UFormField
              :label="t('projects.clientLabel')"
              name="clientId"
              :error="clientServerError || undefined"
            >
              <USelect
                id="project-client"
                v-model="state.clientId"
                :items="clientOptions"
                value-key="id"
                label-key="name"
                :placeholder="t('projects.clientPlaceholder')"
                class="w-full"
                data-testid="project-client-select"
              />
              <template v-if="clientServerError" #error>
                <span id="project-client-error" data-testid="project-client-error" role="alert">
                  {{ clientServerError }}
                </span>
              </template>
            </UFormField>

            <FormDialogFooter
              :cancel-label="t('projects.cancelButton')"
              :save-label="t('projects.saveButton')"
              :saving="saving"
              @cancel="closeDialog"
            />
          </UForm>
        </div>
      </template>
    </UModal>
  </div>
</template>
