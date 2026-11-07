<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui';

const { t, locale } = useI18n();
usePageTitle(() => t('projects.pageTitle'));
const toast = useAppToast();
const confirm = useAppConfirm();
const { $csrfFetch } = useNuxtApp();
const { effective } = useProfile();
// Forwards the incoming request cookies during SSR so the list is authenticated.
const requestFetch = useRequestFetch();

const {
  data: projectsData,
  pending: projectsPending,
  refresh: fetchProjects,
} = useAsyncData('projects', () => requestFetch<ProjectDto[]>('/api/projects'));

const projects = computed(() => projectsData.value ?? []);
const dialogOpen = ref(false);
const editingProject = ref<ProjectDto | null>(null);

function openCreate() {
  editingProject.value = null;
  dialogOpen.value = true;
}

function openEdit(project: ProjectDto) {
  editingProject.value = project;
  dialogOpen.value = true;
}

defineExpose({ openEdit });

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
  } catch (err) {
    const key = extractCaughtMessageKey(err, 'errors.unexpected');
    toast.error(t(key));
  }
}

const columns = computed<TableColumn<ProjectDto>[]>(() => [
  {
    accessorKey: 'name',
    header: t('projects.columnName'),
    cell: ({ row }) => h('span', { class: 'font-medium text-highlighted' }, row.original.name),
    meta: { class: { th: 'w-[34%]', td: 'truncate' } },
  },
  {
    id: 'tracker',
    header: t('projects.columnTracker'),
    cell: ({ row }) => {
      const { trackerName, remoteProjectTitle } = row.original;
      // Local Projects get their own icon in the same slot, so every label starts on one edge.
      // Shows the project's remote project scope alongside the tracker name (REQ-325).
      const label = !trackerName
        ? t('projects.localTrackerLabel')
        : remoteProjectTitle
          ? `${trackerName} · ${remoteProjectTitle}`
          : trackerName;
      return h(
        'span',
        { class: ['flex min-w-0 items-center gap-2', trackerName ? 'text-default' : 'text-muted'] },
        [
          h(resolveComponent('UIcon'), {
            name: trackerName ? 'i-lucide-cable' : 'i-lucide-hard-drive',
            class: 'size-4 shrink-0 text-dimmed',
            'aria-hidden': 'true',
          }),
          h('span', { class: 'truncate' }, label),
        ],
      );
    },
  },
  {
    accessorKey: 'createdAt',
    header: t('projects.columnCreated'),
    cell: ({ row }) => formatDate(row.original.createdAt, locale.value, effective.value.timeZone),
    meta: { class: { th: 'w-40', td: 'tabular-nums text-muted' } },
  },
  {
    id: 'actions',
    // Empty header: buttons already expose accessible names; keeps the column tight.
    header: '',
    enableSorting: false,
    meta: {
      class: {
        // Fixed widths (the table is fixed-layout), so columns never shift between languages.
        th: 'w-28 text-end',
        td: 'whitespace-nowrap py-1.5 text-end',
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
      :ui="{ base: 'min-w-full table-fixed' }"
    >
      <template #empty>
        <!-- Avoid empty-state flash while the initial list request is in flight. -->
        <EmptyState
          v-if="!projectsPending"
          :message="t('projects.emptyState')"
          :cta-label="t('projects.emptyStateCta')"
          testid="projects-empty-state"
          @create="openCreate"
        />
      </template>
    </UTable>

    <ProjectFormDialog v-model:open="dialogOpen" :project="editingProject" @saved="fetchProjects" />
  </div>
</template>
