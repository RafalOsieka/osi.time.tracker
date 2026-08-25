<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui';
import { useI18n } from 'vue-i18n';
import { h, resolveComponent } from 'vue';

const { t, locale } = useI18n();
const toast = useAppToast();
const confirm = useAppConfirm();
const { $csrfFetch } = useNuxtApp();
const { effective } = useUserSettings();
// Forwards the incoming request cookies during SSR so the list is authenticated.
const requestFetch = useRequestFetch();

const { clear: clearSecret } = useTrackerSecret();

const {
  data: trackersData,
  pending: trackersPending,
  refresh: fetchTrackers,
} = useAsyncData('trackers', () => requestFetch<TrackerDto[]>('/api/trackers'));

const trackers = computed(() => trackersData.value ?? []);
const dialogOpen = ref(false);
const editingTracker = ref<TrackerDto | null>(null);

function openCreate() {
  editingTracker.value = null;
  dialogOpen.value = true;
}

function openEdit(tracker: TrackerDto) {
  editingTracker.value = tracker;
  dialogOpen.value = true;
}

async function onDelete(tracker: Pick<TrackerDto, 'id' | 'name'>) {
  const accepted = await confirm({
    title: t('trackers.deleteConfirmHeader'),
    description: t('trackers.deleteConfirmMessage', { name: tracker.name }),
    confirmLabel: t('trackers.deleteConfirmAccept'),
    cancelLabel: t('trackers.deleteConfirmReject'),
  });
  if (!accepted) return;

  try {
    await $csrfFetch(`/api/trackers/${tracker.id}`, { method: 'DELETE' });
    clearSecret(tracker.id);
    await fetchTrackers();
    toast.success(t('trackers.toastDeletedSummary'), t('trackers.toastDeletedDetail'));
  } catch (err) {
    const key = extractCaughtMessageKey(err, 'errors.unexpected');
    toast.error(t(key));
  }
}

const columns = computed<TableColumn<TrackerDto>[]>(() => [
  {
    accessorKey: 'name',
    header: t('trackers.columnName'),
  },
  {
    accessorKey: 'systemType',
    header: t('trackers.columnSystemType'),
  },
  {
    accessorKey: 'baseUrl',
    header: t('trackers.columnBaseUrl'),
    cell: ({ row }) =>
      h(resolveComponent('UButton'), {
        to: row.original.baseUrl,
        target: '_blank',
        external: true,
        variant: 'link',
        label: row.original.baseUrl,
        class: 'px-0',
        'data-testid': `tracker-base-url-${row.original.id}`,
      }),
  },
  {
    accessorKey: 'createdAt',
    header: t('trackers.columnCreated'),
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
        editLabel: t('trackers.editButton'),
        deleteLabel: t('trackers.deleteButton'),
        editTestid: `edit-tracker-${row.original.id}`,
        deleteTestid: `delete-tracker-${row.original.id}`,
        onEdit: () => openEdit(row.original),
        onDelete: () => onDelete(row.original),
      }),
  },
]);
</script>

<template>
  <div data-testid="trackers-page" class="space-y-4">
    <TableHeader
      :title="t('trackers.pageTitle')"
      :new-label="t('trackers.newButton')"
      new-testid="new-tracker-button"
      @create="openCreate"
    />

    <UTable
      :data="trackers"
      :columns="columns"
      :loading="trackersPending"
      data-testid="trackers-table"
      class="w-full"
    >
      <template #empty>
        <!-- Avoid empty-state flash while the initial list request is in flight. -->
        <EmptyState
          v-if="!trackersPending"
          :message="t('trackers.emptyState')"
          :cta-label="t('trackers.emptyStateCta')"
          testid="trackers-empty-state"
          @create="openCreate"
        />
      </template>
    </UTable>

    <TrackerFormDialog v-model:open="dialogOpen" :tracker="editingTracker" @saved="fetchTrackers" />
  </div>
</template>
