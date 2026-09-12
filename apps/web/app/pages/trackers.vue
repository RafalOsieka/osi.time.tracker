<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui';

const { t, locale } = useI18n();
usePageTitle(() => t('trackers.pageTitle'));
const toast = useAppToast();
const confirm = useAppConfirm();
const { $csrfFetch } = useNuxtApp();
const { effective } = useUserSettings();
// Forwards the incoming request cookies during SSR so the list is authenticated.
const requestFetch = useRequestFetch();

const { get: getSecret, clear: clearSecret } = useTrackerSecret();
const { dropTracker } = useActiveTrackers();

// `getSecret` reads localStorage, which SSR cannot see (it always returns
// null there). Rendering the import action's disabled state from `getSecret`
// directly would disagree between the server-rendered HTML and the first
// client render (before hydration finishes), causing a hydration mismatch.
// Stay in the SSR-safe "disabled" state until mounted, then recompute once
// client-side data is actually available.
const secretsReady = ref(false);
onMounted(() => {
  secretsReady.value = true;
});

const {
  data: trackersData,
  pending: trackersPending,
  refresh: fetchTrackers,
} = useAsyncData('trackers', () => requestFetch<TrackerDto[]>('/api/trackers'));

const trackers = computed(() => trackersData.value ?? []);
const dialogOpen = ref(false);
const editingTracker = ref<TrackerDto | null>(null);
const importDialogOpen = ref(false);
const importingTracker = ref<TrackerDto | null>(null);

function openCreate() {
  editingTracker.value = null;
  dialogOpen.value = true;
}

function openEdit(tracker: TrackerDto) {
  editingTracker.value = tracker;
  dialogOpen.value = true;
}

function openImport(tracker: TrackerDto) {
  importingTracker.value = tracker;
  importDialogOpen.value = true;
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
    dropTracker(tracker.id);
    await fetchTrackers();
    toast.success(t('trackers.toastDeletedSummary'), t('trackers.toastDeletedDetail'));
  } catch (err) {
    const key = extractCaughtMessageKey(err, 'errors.unexpected');
    toast.error(t(key));
  }
}

const columns = computed<TableColumn<TrackerDto>[]>(() => {
  // Read at the top level so this computed re-evaluates (and rebuilds the
  // `actions` cell closures below) once `secretsReady` flips post-mount —
  // reading it only inside the nested `cell` callback would not register as
  // a dependency of this computed, since that callback runs later, outside
  // this function's own reactive tracking.
  const ready = secretsReady.value;

  return [
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
      cell: ({ row }) => {
        const hasSecret = ready && Boolean(getSecret(row.original.id));
        return h(resolveComponent('RowActions'), {
          editLabel: t('trackers.editButton'),
          deleteLabel: t('trackers.deleteButton'),
          editTestid: `edit-tracker-${row.original.id}`,
          deleteTestid: `delete-tracker-${row.original.id}`,
          extraIcon: 'i-lucide-history',
          extraLabel: hasSecret ? t('trackers.importButton') : t('trackers.importNoSecretHint'),
          extraTestid: `import-tracker-${row.original.id}`,
          extraDisabled: !hasSecret,
          onEdit: () => openEdit(row.original),
          onDelete: () => onDelete(row.original),
          onExtra: () => openImport(row.original),
        });
      },
    },
  ];
});
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
    <!--
      `:key` forces a fresh component instance per tracker: `v-if` alone stays
      continuously true across two different trackers (both truthy), so the
      same instance — and its `useRemoteLogImport` composable, which captures
      `tracker` once at setup — would otherwise persist stale state (and the
      wrong tracker's adapter) from one tracker into the next.
    -->
    <TrackerImportDialog
      v-if="importingTracker"
      :key="importingTracker.id"
      v-model:open="importDialogOpen"
      :tracker="importingTracker"
    />
  </div>
</template>
