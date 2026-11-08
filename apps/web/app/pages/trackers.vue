<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui';
import { TRACKER_SYSTEM_TYPE_LABELS } from '@osi/time-tracker-remote-trackers/contracts';

const { t } = useI18n();
usePageTitle(() => t('trackers.pageTitle'));
const toast = useAppToast();
const confirm = useAppConfirm();
const { $csrfFetch } = useNuxtApp();
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
// Only once the list has loaded, so the empty state never flashes while it is in flight.
const isEmpty = computed(() => !trackersPending.value && trackers.value.length === 0);
const dialogOpen = ref(false);
const editingTracker = ref<TrackerDto | null>(null);
const importDialogOpen = ref(false);
const importingTracker = ref<TrackerDto | null>(null);
/** The row tile whose dialog is open, so it shows as pressed behind the scrim. */
const pressedAction = ref<{ id: string; action: 'extra' | 'edit' | 'delete' } | null>(null);

function openCreate() {
  editingTracker.value = null;
  dialogOpen.value = true;
}

function openEdit(tracker: TrackerDto) {
  editingTracker.value = tracker;
  pressedAction.value = { id: tracker.id, action: 'edit' };
  dialogOpen.value = true;
}

function openImport(tracker: TrackerDto) {
  importingTracker.value = tracker;
  pressedAction.value = { id: tracker.id, action: 'extra' };
  importDialogOpen.value = true;
}

watch([dialogOpen, importDialogOpen], ([editOpen, importOpen]) => {
  if (!editOpen && !importOpen) pressedAction.value = null;
});

async function onDelete(tracker: Pick<TrackerDto, 'id' | 'name'>) {
  pressedAction.value = { id: tracker.id, action: 'delete' };
  const accepted = await confirm({
    title: t('trackers.deleteConfirmHeader'),
    description: t('trackers.deleteConfirmMessage', { name: tracker.name }),
    emphasis: tracker.name,
    icon: 'i-lucide-trash-2',
    confirmLabel: t('trackers.deleteConfirmAccept'),
    cancelLabel: t('trackers.deleteConfirmReject'),
  }).finally(() => {
    pressedAction.value = null;
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
  // `actions` cell closures below) once `secretsReady` flips post-mount -
  // reading it only inside the nested `cell` callback would not register as
  // a dependency of this computed, since that callback runs later, outside
  // this function's own reactive tracking.
  const ready = secretsReady.value;
  const pressed = pressedAction.value;

  return [
    {
      accessorKey: 'name',
      header: t('trackers.columnName'),
      cell: ({ row }) => h('span', { class: 'font-medium text-highlighted' }, row.original.name),
      meta: { class: { th: 'w-[22%]', td: 'truncate' } },
    },
    {
      accessorKey: 'systemType',
      header: t('trackers.columnSystemType'),
      // The type's name alone: a mark here would only repeat it (Projects keeps the marks).
      cell: ({ row }) =>
        h('span', { class: 'truncate' }, TRACKER_SYSTEM_TYPE_LABELS[row.original.systemType]),
      meta: { class: { th: 'w-36', td: 'truncate' } },
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
          color: 'neutral',
          label: row.original.baseUrl.replace(/^https?:\/\//, ''),
          trailingIcon: 'i-lucide-arrow-up-right',
          class: 'max-w-full px-0 py-0 font-normal text-muted hover:text-highlighted',
          ui: { label: 'truncate', trailingIcon: 'size-3.5 text-dimmed' },
          'data-testid': `tracker-base-url-${row.original.id}`,
        }),
    },
    {
      // How the browser reaches the tracker: directly, or through the OSI extension.
      accessorKey: 'directBrowserAccess',
      header: t('trackers.columnConnection'),
      cell: ({ row }) => {
        const direct = row.original.directBrowserAccess;
        return h('span', { class: 'flex min-w-0 items-center gap-2' }, [
          h(resolveComponent('UIcon'), {
            name: direct ? 'i-lucide-globe' : 'i-lucide-puzzle',
            class: 'size-4 shrink-0 text-dimmed',
            'aria-hidden': 'true',
          }),
          h(
            'span',
            { class: 'truncate' },
            direct ? t('trackers.connectionDirect') : t('trackers.connectionExtension'),
          ),
        ]);
      },
      // As wide as its longest label ("Przez rozszerzenie"), so no dead band opens before the tiles.
      meta: { class: { th: 'w-44' } },
    },
    {
      id: 'actions',
      // Empty header: buttons already expose accessible names; keeps the column tight.
      header: '',
      enableSorting: false,
      meta: {
        class: {
          // Fixed widths (the table is fixed-layout): three 32px tiles plus the cell padding.
          th: 'w-36 text-end',
          td: 'whitespace-nowrap py-1.5 text-end',
        },
      },
      cell: ({ row }) => {
        const hasSecret = ready && Boolean(getSecret(row.original.id));
        return h(resolveComponent('RowActions'), {
          editLabel: t('trackers.editButton'),
          deleteLabel: t('trackers.deleteButton'),
          editTestid: `edit-tracker-${row.original.id}`,
          deleteTestid: `delete-tracker-${row.original.id}`,
          pressed: pressed?.id === row.original.id ? pressed.action : undefined,
          extraIcon: 'i-lucide-import',
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
  <div data-testid="trackers-page" class="grid gap-6">
    <!--
      In the empty state the card's call to action is the page's one primary button; it names the
      action exactly as the quiet header button does. The chip reuses the navigation's glyph.
    -->
    <TableHeader
      :title="t('trackers.pageTitle')"
      :new-label="t('trackers.newButton')"
      new-testid="new-tracker-button"
      :quiet="isEmpty"
      :pressed="dialogOpen && !editingTracker"
      @create="openCreate"
    />

    <EmptyState
      v-if="isEmpty"
      icon="i-lucide-cable"
      :title="t('trackers.emptyStateTitle')"
      :message="t('trackers.emptyState')"
      :cta-label="t('trackers.newButton')"
      testid="trackers-empty-state"
      @create="openCreate"
    />

    <UTable
      v-else
      :data="trackers"
      :columns="columns"
      :loading="trackersPending"
      data-testid="trackers-table"
      class="w-full"
      :ui="{
        root: 'rounded-xl bg-default ring ring-default dark:bg-muted',
        base: 'w-full table-fixed',
      }"
    >
      <!-- While the list loads it shows no "no data" text; the empty state replaces the table. -->
      <template #empty><span /></template>
    </UTable>

    <TrackerFormDialog v-model:open="dialogOpen" :tracker="editingTracker" @saved="fetchTrackers" />
    <!--
      `:key` forces a fresh component instance per tracker: `v-if` alone stays
      continuously true across two different trackers (both truthy), so the
      same instance - and its `useRemoteLogImport` composable, which captures
      `tracker` once at setup - would otherwise persist stale state (and the
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
