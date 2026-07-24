<script setup lang="ts">
import type { FormSubmitEvent, TableColumn } from '@nuxt/ui';
import { useI18n } from 'vue-i18n';
import { h, resolveComponent } from 'vue';

const { t, locale } = useI18n();
const toast = useAppToast();
const confirm = useAppConfirm();
const { $csrfFetch } = useNuxtApp();
const { effective } = useUserSettings();

const { get: getSecret, set: setSecret, clear: clearSecret } = useRemoteConfigSecret();

const systemTypeItems = [
  { label: 'OpenProject', value: 'openproject' as const },
  { label: 'Redmine', value: 'redmine' as const },
];
const roundingRuleItems = computed(() => [
  { label: t('clients.remoteConfig.roundingNone'), value: 'none' as const },
  { label: t('clients.remoteConfig.rounding15m'), value: 'up_15m' as const },
  { label: t('clients.remoteConfig.rounding30m'), value: 'up_30m' as const },
  { label: t('clients.remoteConfig.rounding1h'), value: 'up_1h' as const },
]);
const executionModeItems = computed(() => [
  { label: t('clients.remoteConfig.executionModeClient'), value: 'client' as const },
  { label: t('clients.remoteConfig.executionModeServer'), value: 'server' as const },
]);

const {
  data: clientsData,
  pending: clientsPending,
  refresh: fetchClients,
} = useAsyncData('clients', () => $fetch<ClientDto[]>('/api/clients'), {
  server: false,
  immediate: false,
});
onMounted(() => {
  void fetchClients();
});

const clients = computed(() => clientsData.value ?? []);
const dialogOpen = ref(false);
const editingClient = ref<ClientDto | null>(null);
const state = reactive({ name: '' });
const nameServerError = ref('');
const saving = ref(false);

const remoteConfig = ref<RemoteSystemConfigDto | null>(null);
const remoteConfigLoading = ref(false);
const remoteConfigState = reactive<{
  systemType: RemoteSystemType;
  baseUrl: string;
  executionMode: RemoteExecutionMode;
  roundingRule: RemoteRoundingRule;
}>({
  systemType: 'openproject',
  baseUrl: '',
  executionMode: 'client',
  roundingRule: 'none',
});
const remoteConfigSecret = ref('');
const remoteConfigFormKey = computed(() => editingClient.value?.id ?? 'new');
const baseUrlServerError = ref('');
const systemTypeServerError = ref('');
const remoteConfigSaving = ref(false);

function openCreate() {
  editingClient.value = null;
  state.name = '';
  nameServerError.value = '';
  dialogOpen.value = true;
}

async function openEdit(client: ClientDto) {
  editingClient.value = client;
  state.name = client.name;
  nameServerError.value = '';
  dialogOpen.value = true;

  remoteConfig.value = null;
  remoteConfigSecret.value = '';
  baseUrlServerError.value = '';
  systemTypeServerError.value = '';
  Object.assign(remoteConfigState, {
    systemType: 'openproject',
    baseUrl: '',
    executionMode: 'client',
    roundingRule: 'none',
  });
  remoteConfigLoading.value = true;
  try {
    const config = await $fetch<RemoteSystemConfigDto>(`/api/clients/${client.id}/remote-config`);
    remoteConfig.value = config;
    Object.assign(remoteConfigState, {
      systemType: config.systemType,
      baseUrl: config.baseUrl,
      executionMode: config.executionMode,
      roundingRule: config.roundingRule,
    });
    remoteConfigSecret.value = getSecret(config.id) ?? '';
  } catch {
    // No config yet for this client; keep defaults.
  } finally {
    remoteConfigLoading.value = false;
  }
}

function closeDialog() {
  dialogOpen.value = false;
}

async function onSaveRemoteConfig(event: FormSubmitEvent<typeof remoteConfigState>) {
  baseUrlServerError.value = '';
  systemTypeServerError.value = '';
  if (!editingClient.value) return;

  remoteConfigSaving.value = true;
  try {
    const payload: CreateRemoteSystemConfigDto = {
      systemType: event.data.systemType,
      baseUrl: event.data.baseUrl,
      executionMode: event.data.executionMode,
      roundingRule: event.data.roundingRule,
    };
    const saved = await $csrfFetch<RemoteSystemConfigDto>(
      `/api/clients/${editingClient.value.id}/remote-config`,
      { method: 'PUT', body: payload },
    );
    remoteConfig.value = saved;
    if (remoteConfigSecret.value) {
      setSecret(saved.id, remoteConfigSecret.value);
    }
    toast.success(t('clients.remoteConfig.toastSavedSummary'));
  } catch (err: unknown) {
    const key = extractMessageKey(err, 'errors.unexpected');
    if (key === 'error.remoteConfigBaseUrlRequired' || key === 'error.remoteConfigBaseUrlInvalid') {
      baseUrlServerError.value = t(key);
    } else if (key === 'error.remoteConfigSystemTypeRequired') {
      systemTypeServerError.value = t(key);
    } else {
      toast.error(t(key));
    }
  } finally {
    remoteConfigSaving.value = false;
  }
}

async function onRemoveRemoteConfig() {
  if (!editingClient.value || !remoteConfig.value) return;
  const clientId = editingClient.value.id;
  const configId = remoteConfig.value.id;

  const accepted = await confirm({
    title: t('clients.remoteConfig.deleteConfirmHeader'),
    description: t('clients.remoteConfig.deleteConfirmMessage'),
    confirmLabel: t('clients.deleteConfirmAccept'),
    cancelLabel: t('clients.deleteConfirmReject'),
  });
  if (!accepted) return;

  try {
    await $csrfFetch(`/api/clients/${clientId}/remote-config`, { method: 'DELETE' });
    clearSecret(configId);
    remoteConfig.value = null;
    remoteConfigSecret.value = '';
    Object.assign(remoteConfigState, {
      systemType: 'openproject',
      baseUrl: '',
      executionMode: 'client',
      roundingRule: 'none',
    });
    toast.success(t('clients.remoteConfig.toastRemovedSummary'));
  } catch (err: unknown) {
    const key = extractMessageKey(err, 'errors.unexpected');
    toast.error(t(key));
  }
}

async function onSave(event: FormSubmitEvent<typeof state>) {
  nameServerError.value = '';
  saving.value = true;
  try {
    if (editingClient.value) {
      const payload: UpdateClientDto = { name: event.data.name };
      const updated = await $csrfFetch<ClientDto>(`/api/clients/${editingClient.value.id}`, {
        method: 'PATCH',
        body: payload,
      });
      await fetchClients();
      toast.success(
        t('clients.toastUpdatedSummary'),
        t('clients.toastUpdatedDetail', { name: updated.name }),
      );
    } else {
      const payload: CreateClientDto = { name: event.data.name };
      const created = await $csrfFetch<ClientDto>('/api/clients', {
        method: 'POST',
        body: payload,
      });
      await fetchClients();
      toast.success(
        t('clients.toastCreatedSummary'),
        t('clients.toastCreatedDetail', { name: created.name }),
      );
    }
    closeDialog();
  } catch (err: unknown) {
    const key = extractMessageKey(err, 'errors.unexpected');
    if (
      key === 'error.clientNameRequired' ||
      key === 'error.clientNameDuplicate' ||
      key === 'error.clientNameTooLong'
    ) {
      nameServerError.value = t(key);
    } else {
      toast.error(t(key));
    }
  } finally {
    saving.value = false;
  }
}

async function onDelete(client: Pick<ClientDto, 'id' | 'name'>) {
  const accepted = await confirm({
    title: t('clients.deleteConfirmHeader'),
    description: t('clients.deleteConfirmMessage', { name: client.name }),
    confirmLabel: t('clients.deleteConfirmAccept'),
    cancelLabel: t('clients.deleteConfirmReject'),
  });
  if (!accepted) return;

  try {
    await $csrfFetch(`/api/clients/${client.id}`, { method: 'DELETE' });
    await fetchClients();
    toast.success(t('clients.toastDeletedSummary'), t('clients.toastDeletedDetail'));
  } catch (err: unknown) {
    const key = extractMessageKey(err, 'errors.unexpected');
    toast.error(t(key));
  }
}

const columns = computed<TableColumn<ClientDto>[]>(() => [
  {
    accessorKey: 'name',
    header: t('clients.columnName'),
  },
  {
    accessorKey: 'createdAt',
    header: t('clients.columnCreated'),
    cell: ({ row }) => formatDate(row.original.createdAt, locale.value, effective.value.timeZone),
  },
  {
    id: 'actions',
    header: t('clients.columnActions'),
    cell: ({ row }) =>
      h(resolveComponent('RowActions'), {
        editLabel: t('clients.editButton'),
        deleteLabel: t('clients.deleteButton'),
        editTestid: `edit-client-${row.original.id}`,
        deleteTestid: `delete-client-${row.original.id}`,
        onEdit: () => openEdit(row.original),
        onDelete: () => onDelete(row.original),
      }),
  },
]);
</script>

<template>
  <div data-testid="clients-page" class="space-y-4">
    <TableHeader
      :title="t('clients.pageTitle')"
      :new-label="t('clients.newButton')"
      new-testid="new-client-button"
      @create="openCreate"
    />

    <UTable
      :data="clients"
      :columns="columns"
      :loading="clientsPending"
      data-testid="clients-table"
      class="w-full"
    >
      <template #empty>
        <EmptyState
          :message="t('clients.emptyState')"
          :cta-label="t('clients.emptyStateCta')"
          testid="clients-empty-state"
          @create="openCreate"
        />
      </template>
    </UTable>

    <UModal
      v-model:open="dialogOpen"
      :title="editingClient ? t('clients.dialogTitleEdit') : t('clients.dialogTitleCreate')"
      :ui="{ content: 'sm:max-w-lg' }"
      @update:open="(value: boolean) => !value && closeDialog()"
    >
      <template #body>
        <div data-testid="client-dialog" class="grid gap-3">
          <UForm :schema="createClientSchema" :state="state" class="grid gap-3" @submit="onSave">
            <UFormField
              :label="t('clients.nameLabel')"
              name="name"
              :error="nameServerError || undefined"
            >
              <UInput
                id="client-name"
                v-model="state.name"
                :maxlength="CLIENT_NAME_MAX_LENGTH"
                :placeholder="t('clients.namePlaceholder')"
                data-testid="client-name-input"
              />
              <template v-if="nameServerError" #error>
                <span id="client-name-error" data-testid="client-name-error" role="alert">
                  {{ nameServerError }}
                </span>
              </template>
            </UFormField>

            <FormDialogFooter
              :cancel-label="t('clients.cancelButton')"
              :save-label="t('clients.saveButton')"
              :saving="saving"
              @cancel="closeDialog"
            />
          </UForm>

          <template v-if="editingClient">
            <USeparator class="my-4" />
            <h3 class="mb-3 text-base font-semibold">{{ t('clients.remoteConfig.heading') }}</h3>

            <p
              v-if="remoteConfigLoading"
              class="text-muted m-0"
              data-testid="remote-config-loading"
            >
              {{ t('clients.remoteConfig.loading') }}
            </p>

            <UForm
              v-else
              :key="remoteConfigFormKey"
              :schema="createRemoteSystemConfigSchema"
              :state="remoteConfigState"
              class="grid gap-3"
              data-testid="remote-config-form"
              @submit="onSaveRemoteConfig"
            >
              <UFormField
                :label="t('clients.remoteConfig.systemTypeLabel')"
                name="systemType"
                :error="systemTypeServerError || undefined"
              >
                <USelect
                  id="remote-config-system-type"
                  v-model="remoteConfigState.systemType"
                  :items="systemTypeItems"
                  value-key="value"
                  label-key="label"
                  class="w-full"
                  data-testid="remote-config-system-type-select"
                />
                <template v-if="systemTypeServerError" #error>
                  <span
                    id="remote-config-system-type-error"
                    data-testid="remote-config-system-type-error"
                    role="alert"
                  >
                    {{ systemTypeServerError }}
                  </span>
                </template>
              </UFormField>

              <UFormField
                :label="t('clients.remoteConfig.baseUrlLabel')"
                name="baseUrl"
                :error="baseUrlServerError || undefined"
              >
                <UInput
                  id="remote-config-base-url"
                  v-model="remoteConfigState.baseUrl"
                  :placeholder="t('clients.remoteConfig.baseUrlPlaceholder')"
                  data-testid="remote-config-base-url-input"
                />
                <template v-if="baseUrlServerError" #error>
                  <span
                    id="remote-config-base-url-error"
                    data-testid="remote-config-base-url-error"
                    role="alert"
                  >
                    {{ baseUrlServerError }}
                  </span>
                </template>
              </UFormField>

              <UFormField
                :label="t('clients.remoteConfig.executionModeLabel')"
                name="executionMode"
              >
                <USelect
                  id="remote-config-execution-mode"
                  v-model="remoteConfigState.executionMode"
                  :items="executionModeItems"
                  value-key="value"
                  label-key="label"
                  class="w-full"
                  data-testid="remote-config-execution-mode-select"
                />
              </UFormField>

              <UFormField :label="t('clients.remoteConfig.roundingRuleLabel')" name="roundingRule">
                <USelect
                  id="remote-config-rounding-rule"
                  v-model="remoteConfigState.roundingRule"
                  :items="roundingRuleItems"
                  value-key="value"
                  label-key="label"
                  class="w-full"
                  data-testid="remote-config-rounding-rule-select"
                />
              </UFormField>

              <UFormField :label="t('clients.remoteConfig.secretLabel')" name="secret">
                <UInput
                  id="remote-config-secret"
                  v-model="remoteConfigSecret"
                  type="password"
                  :placeholder="t('clients.remoteConfig.secretPlaceholder')"
                  data-testid="remote-config-secret-input"
                />
              </UFormField>

              <div class="flex justify-end gap-2">
                <UButton
                  type="submit"
                  :label="t('clients.remoteConfig.saveButton')"
                  :loading="remoteConfigSaving"
                  data-testid="remote-config-save-button"
                />
                <UButton
                  v-if="remoteConfig"
                  type="button"
                  color="error"
                  variant="ghost"
                  :label="t('clients.remoteConfig.removeButton')"
                  data-testid="remote-config-remove-button"
                  @click="onRemoveRemoteConfig"
                />
              </div>
            </UForm>
          </template>
        </div>
      </template>
    </UModal>
  </div>
</template>
