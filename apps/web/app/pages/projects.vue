<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui';

const { t } = useI18n();
usePageTitle(() => t('projects.pageTitle'));
const toast = useAppToast();
const confirm = useAppConfirm();
const { $csrfFetch } = useNuxtApp();
// Forwards the incoming request cookies during SSR so the list is authenticated.
const requestFetch = useRequestFetch();

const {
  data: projectsData,
  pending: projectsPending,
  refresh: fetchProjects,
} = useAsyncData('projects', () => requestFetch<ProjectDto[]>('/api/projects'));

const projects = computed(() => projectsData.value ?? []);
// Only once the list has loaded, so the empty state never flashes while it is in flight.
const isEmpty = computed(() => !projectsPending.value && projects.value.length === 0);
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
      const { trackerName, trackerSystemType, remoteProjectTitle } = row.original;
      // Local Projects get their own icon in the mark's slot, so every label starts on one edge.
      if (!trackerName || !trackerSystemType) {
        return h('span', { class: 'flex min-w-0 items-center gap-2 text-muted' }, [
          h('span', { class: 'inline-flex w-7 shrink-0 justify-center', 'aria-hidden': 'true' }, [
            h(resolveComponent('UIcon'), { name: 'i-lucide-hard-drive', class: 'size-4' }),
          ]),
          h('span', { class: 'truncate' }, t('projects.localTrackerLabel')),
        ]);
      }
      // The Tracker's type mark, as on Trackers, then its remote scope (REQ-325) in a quieter
      // tone, or "whole tracker" when unscoped, so a missing scope never looks like missing data.
      return h('span', { class: 'flex min-w-0 items-center gap-2' }, [
        h(resolveComponent('TrackerTypeMark'), { systemType: trackerSystemType }),
        h('span', { class: 'truncate', 'data-testid': `project-tracker-${row.original.id}` }, [
          trackerName,
          h(
            'span',
            { class: 'text-muted' },
            ` · ${remoteProjectTitle ?? t('projects.remoteProjectPlaceholder')}`,
          ),
        ]),
      ]);
    },
  },
  {
    // Time tracked in the last 30 days (REQ-371), so Projects in use stand out from idle ones.
    accessorKey: 'recentTrackedSeconds',
    header: t('projects.columnRecent'),
    cell: ({ row }) => {
      const seconds = row.original.recentTrackedSeconds;
      return h(
        'span',
        { class: seconds > 0 ? 'text-default' : 'text-dimmed' },
        formatReportDuration(seconds),
      );
    },
    meta: { class: { th: 'w-36 text-end', td: 'text-end font-mono tabular-nums' } },
  },
  {
    id: 'actions',
    // Empty header: buttons already expose accessible names; keeps the column tight.
    header: '',
    enableSorting: false,
    meta: {
      class: {
        // Fixed widths (the table is fixed-layout): two 32px tiles plus the cell padding.
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
  <div data-testid="projects-page" class="grid gap-6">
    <!--
      In the empty state the card's call to action is the page's one primary button; it names the
      action exactly as the quiet header button does. The chip reuses the navigation's glyph.
    -->
    <TableHeader
      :title="t('projects.pageTitle')"
      :new-label="t('projects.newButton')"
      new-testid="new-project-button"
      :quiet="isEmpty"
      @create="openCreate"
    />

    <EmptyState
      v-if="isEmpty"
      icon="i-lucide-briefcase"
      :title="t('projects.emptyStateTitle')"
      :message="t('projects.emptyState')"
      :cta-label="t('projects.newButton')"
      testid="projects-empty-state"
      @create="openCreate"
    />

    <UTable
      v-else
      :data="projects"
      :columns="columns"
      :loading="projectsPending"
      data-testid="projects-table"
      class="w-full"
      :ui="{
        root: 'rounded-xl bg-default ring ring-default dark:bg-muted',
        base: 'w-full table-fixed',
      }"
    >
      <!-- While the list loads it shows no "no data" text; the empty state replaces the table. -->
      <template #empty><span /></template>
    </UTable>

    <ProjectFormDialog v-model:open="dialogOpen" :project="editingProject" @saved="fetchProjects" />
  </div>
</template>
