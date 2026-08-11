<script setup lang="ts">
import type { FormErrorEvent, FormSubmitEvent, TableColumn } from '@nuxt/ui';
import { useI18n } from 'vue-i18n';
import { h, resolveComponent } from 'vue';

const { t, locale } = useI18n();
const toast = useAppToast();
const confirm = useAppConfirm();
const { $csrfFetch } = useNuxtApp();
const { effective } = useUserSettings();
// Forwards the incoming request cookies during SSR so the list is authenticated.
const requestFetch = useRequestFetch();

const { get: getSecret, set: setSecret, clear: clearSecret } = useTrackerSecret();

const systemTypeItems = [
  { label: 'OpenProject', value: 'openproject' as const },
  { label: 'Redmine', value: 'redmine' as const },
];
const roundingRuleItems = computed(() =>
  TRACKER_ROUNDING_RULE_ORDER.map((value) => ({
    label: t(`trackers.roundingRule.${value}`),
    value,
  })),
);
const executionModeItems = computed(() => [
  { label: t('trackers.executionModeClient'), value: 'client' as const },
  { label: t('trackers.executionModeServer'), value: 'server' as const },
]);

const {
  data: trackersData,
  pending: trackersPending,
  refresh: fetchTrackers,
} = useAsyncData('trackers', () => requestFetch<TrackerDto[]>('/api/trackers'));

const trackers = computed(() => trackersData.value ?? []);
const dialogOpen = ref(false);
const editingTracker = ref<TrackerDto | null>(null);
const state = reactive({
  name: '',
  systemType: 'openproject' as TrackerSystemType,
  baseUrl: '',
  executionMode: 'client' as TrackerExecutionMode,
  roundingRule: 'none' as TrackerRoundingRule,
});
const secret = ref('');
const nameServerError = ref('');
const baseUrlServerError = ref('');
const systemTypeServerError = ref('');
const saving = ref(false);
const formKey = computed(() => editingTracker.value?.id ?? 'new');

function resetForm() {
  state.name = '';
  state.systemType = 'openproject';
  state.baseUrl = '';
  state.executionMode = 'client';
  state.roundingRule = 'none';
  secret.value = '';
  nameServerError.value = '';
  baseUrlServerError.value = '';
  systemTypeServerError.value = '';
}

function openCreate() {
  editingTracker.value = null;
  resetForm();
  dialogOpen.value = true;
}

function openEdit(tracker: TrackerDto) {
  editingTracker.value = tracker;
  state.name = tracker.name;
  state.systemType = tracker.systemType;
  state.baseUrl = tracker.baseUrl;
  state.executionMode = tracker.executionMode;
  state.roundingRule = tracker.roundingRule;
  secret.value = getSecret(tracker.id) ?? '';
  nameServerError.value = '';
  baseUrlServerError.value = '';
  systemTypeServerError.value = '';
  dialogOpen.value = true;
}

function closeDialog() {
  dialogOpen.value = false;
}

function onFormError(event: FormErrorEvent) {
  nameServerError.value = '';
  baseUrlServerError.value = '';
  systemTypeServerError.value = '';
  for (const err of event.errors) {
    if (typeof err.message !== 'string') continue;
    if (err.name === 'name') {
      nameServerError.value = t(err.message);
    } else if (err.name === 'baseUrl') {
      baseUrlServerError.value = t(err.message);
    } else if (err.name === 'systemType') {
      systemTypeServerError.value = t(err.message);
    }
  }
}

async function onSave(event: FormSubmitEvent<CreateTrackerDto>) {
  nameServerError.value = '';
  baseUrlServerError.value = '';
  systemTypeServerError.value = '';
  saving.value = true;
  try {
    const payload: CreateTrackerDto = {
      name: event.data.name,
      systemType: event.data.systemType,
      baseUrl: event.data.baseUrl,
      executionMode: event.data.executionMode,
      roundingRule: event.data.roundingRule,
    };
    if (editingTracker.value) {
      const updated = await $csrfFetch<TrackerDto>(`/api/trackers/${editingTracker.value.id}`, {
        method: 'PATCH',
        body: payload,
      });
      if (secret.value) {
        setSecret(updated.id, secret.value);
      }
      await fetchTrackers();
      toast.success(
        t('trackers.toastUpdatedSummary'),
        t('trackers.toastUpdatedDetail', { name: updated.name }),
      );
    } else {
      const created = await $csrfFetch<TrackerDto>('/api/trackers', {
        method: 'POST',
        body: payload,
      });
      if (secret.value) {
        setSecret(created.id, secret.value);
      }
      await fetchTrackers();
      toast.success(
        t('trackers.toastCreatedSummary'),
        t('trackers.toastCreatedDetail', { name: created.name }),
      );
    }
    closeDialog();
  } catch (err: unknown) {
    const key = extractMessageKey(err, 'errors.unexpected');
    if (
      key === 'error.trackerNameRequired' ||
      key === 'error.trackerNameDuplicate' ||
      key === 'error.trackerNameTooLong'
    ) {
      nameServerError.value = t(key);
    } else if (key === 'error.trackerBaseUrlRequired' || key === 'error.trackerBaseUrlInvalid') {
      baseUrlServerError.value = t(key);
    } else if (key === 'error.trackerSystemTypeRequired') {
      systemTypeServerError.value = t(key);
    } else {
      toast.error(t(key));
    }
  } finally {
    saving.value = false;
  }
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
  } catch (err: unknown) {
    const key = extractMessageKey(err, 'errors.unexpected');
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
        <EmptyState
          :message="t('trackers.emptyState')"
          :cta-label="t('trackers.emptyStateCta')"
          testid="trackers-empty-state"
          @create="openCreate"
        />
      </template>
    </UTable>

    <UModal
      v-model:open="dialogOpen"
      :title="editingTracker ? t('trackers.dialogTitleEdit') : t('trackers.dialogTitleCreate')"
      :ui="{ content: 'sm:max-w-lg' }"
      @update:open="(value: boolean) => !value && closeDialog()"
    >
      <template #body>
        <div data-testid="tracker-dialog" class="grid gap-3">
          <UForm
            :key="formKey"
            :schema="createTrackerSchema"
            :state="state"
            class="grid gap-3"
            @submit="onSave"
            @error="onFormError"
          >
            <UFormField
              :label="t('trackers.nameLabel')"
              name="name"
              :error="nameServerError || undefined"
            >
              <UInput
                id="tracker-name"
                v-model="state.name"
                :maxlength="TRACKER_NAME_MAX_LENGTH"
                :placeholder="t('trackers.namePlaceholder')"
                data-testid="tracker-name-input"
              />
              <template v-if="nameServerError" #error>
                <span id="tracker-name-error" data-testid="tracker-name-error" role="alert">
                  {{ nameServerError }}
                </span>
              </template>
            </UFormField>

            <UFormField
              :label="t('trackers.systemTypeLabel')"
              name="systemType"
              :error="systemTypeServerError || undefined"
            >
              <USelect
                id="tracker-system-type"
                v-model="state.systemType"
                :items="systemTypeItems"
                value-key="value"
                label-key="label"
                class="w-full"
                data-testid="tracker-system-type-select"
              />
              <template v-if="systemTypeServerError" #error>
                <span
                  id="tracker-system-type-error"
                  data-testid="tracker-system-type-error"
                  role="alert"
                >
                  {{ systemTypeServerError }}
                </span>
              </template>
            </UFormField>

            <UFormField
              :label="t('trackers.baseUrlLabel')"
              name="baseUrl"
              :error="baseUrlServerError || undefined"
            >
              <UInput
                id="tracker-base-url"
                v-model="state.baseUrl"
                :placeholder="t('trackers.baseUrlPlaceholder')"
                data-testid="tracker-base-url-input"
              />
              <template v-if="baseUrlServerError" #error>
                <span id="tracker-base-url-error" data-testid="tracker-base-url-error" role="alert">
                  {{ baseUrlServerError }}
                </span>
              </template>
            </UFormField>

            <UFormField :label="t('trackers.executionModeLabel')" name="executionMode">
              <USelect
                id="tracker-execution-mode"
                v-model="state.executionMode"
                :items="executionModeItems"
                value-key="value"
                label-key="label"
                class="w-full"
                data-testid="tracker-execution-mode-select"
              />
            </UFormField>

            <UFormField :label="t('trackers.roundingRuleLabel')" name="roundingRule">
              <USelect
                id="tracker-rounding-rule"
                v-model="state.roundingRule"
                :items="roundingRuleItems"
                value-key="value"
                label-key="label"
                class="w-full"
                data-testid="tracker-rounding-rule-select"
              />
            </UFormField>

            <UFormField :label="t('trackers.secretLabel')" name="secret">
              <UInput
                id="tracker-secret"
                v-model="secret"
                type="password"
                :placeholder="t('trackers.secretPlaceholder')"
                data-testid="tracker-secret-input"
              />
            </UFormField>

            <FormDialogFooter
              :cancel-label="t('trackers.cancelButton')"
              :save-label="t('trackers.saveButton')"
              :saving="saving"
              @cancel="closeDialog"
            />
          </UForm>
        </div>
      </template>
    </UModal>
  </div>
</template>
