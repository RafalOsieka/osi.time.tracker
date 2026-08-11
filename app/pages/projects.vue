<script setup lang="ts">
import type { FormSubmitEvent, TableColumn } from '@nuxt/ui';
import { useI18n } from 'vue-i18n';
import { h, resolveComponent } from 'vue';

const { t, locale } = useI18n();
const toast = useAppToast();
const confirm = useAppConfirm();
const { $csrfFetch } = useNuxtApp();
const { effective } = useUserSettings();
// Forwards the incoming request cookies during SSR so the list is authenticated.
const requestFetch = useRequestFetch();

const {
  data: trackersData,
  pending: trackersPending,
  refresh: fetchTrackerOptions,
} = useAsyncData('trackers-for-projects', () => requestFetch<TrackerDto[]>('/api/trackers'), {
  server: false,
  immediate: false,
});
const extraTrackerOptions = ref<{ id: string; name: string }[]>([]);
const trackerOptions = computed(() => {
  const active = trackersData.value ?? [];
  const missing = extraTrackerOptions.value.filter(
    (extra) => !active.some((tracker) => tracker.id === extra.id),
  );
  return [...active, ...missing];
});

const {
  data: projectsData,
  pending: projectsPending,
  refresh: fetchProjects,
} = useAsyncData('projects', () => requestFetch<ProjectDto[]>('/api/projects'));

const projects = computed(() => projectsData.value ?? []);
const dialogOpen = ref(false);
const editingProject = ref<ProjectDto | null>(null);
/** UI uses undefined for empty/local; API null is mapped at open/submit boundaries. */
type ProjectFormState = {
  name: string;
  trackerId?: string;
};
const state = reactive<ProjectFormState>({
  name: '',
  trackerId: undefined,
});
const nameServerError = ref('');
const trackerServerError = ref('');
const saving = ref(false);

function openCreate() {
  editingProject.value = null;
  state.name = '';
  state.trackerId = undefined;
  nameServerError.value = '';
  trackerServerError.value = '';
  dialogOpen.value = true;
  void fetchTrackerOptions();
}

function openEdit(project: ProjectDto) {
  editingProject.value = project;
  state.name = project.name;
  state.trackerId = project.trackerId ?? undefined;
  nameServerError.value = '';
  trackerServerError.value = '';
  if (
    project.trackerId &&
    !trackerOptions.value.some((tracker) => tracker.id === project.trackerId)
  ) {
    extraTrackerOptions.value = [
      {
        id: project.trackerId,
        name: project.trackerName ?? project.trackerId,
      },
    ];
  }
  dialogOpen.value = true;
  void fetchTrackerOptions();
}

function closeDialog() {
  dialogOpen.value = false;
}

defineExpose({ openEdit });

async function onSave(event: FormSubmitEvent<CreateProjectDto>) {
  nameServerError.value = '';
  trackerServerError.value = '';

  const nextTrackerId = event.data.trackerId ?? null;
  const previousTrackerId = editingProject.value?.trackerId ?? null;
  if (editingProject.value && previousTrackerId && nextTrackerId !== previousTrackerId) {
    const accepted = await confirm({
      title: t('projects.detachConfirmHeader'),
      description: t('projects.detachConfirmMessage'),
      confirmLabel: t('projects.detachConfirmAccept'),
      cancelLabel: t('projects.detachConfirmReject'),
    });
    if (!accepted) return;
  }

  saving.value = true;
  try {
    const payload: CreateProjectDto = {
      name: event.data.name,
      trackerId: nextTrackerId,
    };
    if (editingProject.value) {
      const updated = await $csrfFetch<ProjectDto>(`/api/projects/${editingProject.value.id}`, {
        method: 'PATCH',
        body: payload satisfies UpdateProjectDto,
      });
      await fetchProjects();
      toast.success(
        t('projects.toastUpdatedSummary'),
        t('projects.toastUpdatedDetail', { name: updated.name }),
      );
    } else {
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
    } else if (key === 'error.projectTrackerInvalid') {
      trackerServerError.value = t(key);
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
    id: 'tracker',
    header: t('projects.columnTracker'),
    cell: ({ row }) => row.original.trackerName ?? t('projects.localTrackerLabel'),
  },
  {
    accessorKey: 'createdAt',
    header: t('projects.columnCreated'),
    cell: ({ row }) => formatDate(row.original.createdAt, locale.value, effective.value.timeZone),
  },
  {
    id: 'actions',
    // Empty header: buttons already expose accessible names; keeps the column tight.
    header: '',
    enableSorting: false,
    meta: {
      class: {
        // w-0 + whitespace-nowrap shrinks the column to its content and pins it right.
        th: 'w-0 whitespace-nowrap text-end',
        td: 'w-0 whitespace-nowrap text-end',
      },
    },
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
              :label="t('projects.trackerLabel')"
              name="trackerId"
              :error="trackerServerError || undefined"
            >
              <USelect
                id="project-tracker"
                v-model="state.trackerId"
                :items="trackerOptions"
                value-key="id"
                label-key="name"
                :placeholder="t('projects.trackerPlaceholder')"
                :loading="trackersPending"
                clearable
                class="w-full"
                data-testid="project-tracker-select"
              />
              <template v-if="trackerServerError" #error>
                <span id="project-tracker-error" data-testid="project-tracker-error" role="alert">
                  {{ trackerServerError }}
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
