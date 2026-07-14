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

const resolver = zodResolver(createClientSchema);
// executionMode currently only supports 'client' and is set automatically on save,
// so it is not part of the on-screen form and is omitted from its resolver.
const remoteConfigResolver = zodResolver(
  createRemoteSystemConfigSchema.omit({ executionMode: true }),
);
const { get: getSecret, set: setSecret, clear: clearSecret } = useRemoteConfigSecret();

const systemTypeOptions = [
  { label: 'Redmine', value: 'redmine' },
  { label: 'OpenProject', value: 'openproject' },
];
const roundingRuleOptions = [
  { label: t('clients.remoteConfig.roundingNone'), value: 'none' },
  { label: t('clients.remoteConfig.rounding15m'), value: 'up_15m' },
  { label: t('clients.remoteConfig.rounding30m'), value: 'up_30m' },
  { label: t('clients.remoteConfig.rounding1h'), value: 'up_1h' },
];

// --- Data fetching ---
const {
  data: clientsData,
  pending: clientsPending,
  refresh: fetchClients,
} = useAsyncData('clients', () => $fetch<ClientDto[]>('/api/clients'), { server: false });

// --- State ---
const clients = computed(() => clientsData.value ?? []);
const dialogVisible = ref(false);
const editingClient = ref<ClientDto | null>(null);
const initialValues = ref({ name: '' });
const nameServerError = ref('');
const saving = ref(false);

// --- Remote config state ---
const remoteConfig = ref<RemoteSystemConfigDto | null>(null);
const remoteConfigLoading = ref(false);
const remoteConfigInitialValues = ref<{
  systemType: RemoteSystemType;
  baseUrl: string;
  roundingRule: RemoteRoundingRule;
}>({
  systemType: 'redmine',
  baseUrl: '',
  roundingRule: 'none',
});
const remoteConfigSecret = ref('');
const baseUrlServerError = ref('');
const systemTypeServerError = ref('');
const remoteConfigSaving = ref(false);

// --- Dialog helpers ---
function openCreate() {
  editingClient.value = null;
  initialValues.value = { name: '' };
  nameServerError.value = '';
  dialogVisible.value = true;
}

async function openEdit(client: ClientDto) {
  editingClient.value = client;
  initialValues.value = { name: client.name };
  nameServerError.value = '';
  dialogVisible.value = true;

  remoteConfig.value = null;
  remoteConfigSecret.value = '';
  baseUrlServerError.value = '';
  systemTypeServerError.value = '';
  remoteConfigInitialValues.value = { systemType: 'redmine', baseUrl: '', roundingRule: 'none' };
  remoteConfigLoading.value = true;
  try {
    const config = await $fetch<RemoteSystemConfigDto>(`/api/clients/${client.id}/remote-config`);
    remoteConfig.value = config;
    remoteConfigInitialValues.value = {
      systemType: config.systemType,
      baseUrl: config.baseUrl,
      roundingRule: config.roundingRule,
    };
    remoteConfigSecret.value = getSecret(config.id) ?? '';
  } catch {
    // No config yet for this client; keep defaults.
  } finally {
    remoteConfigLoading.value = false;
  }
}

function closeDialog() {
  dialogVisible.value = false;
}

// --- Remote config save/remove ---
async function onSaveRemoteConfig({ valid, values }: FormSubmitEvent) {
  baseUrlServerError.value = '';
  systemTypeServerError.value = '';
  if (!valid || !editingClient.value) return;

  remoteConfigSaving.value = true;
  try {
    const payload: CreateRemoteSystemConfigDto = {
      systemType: values.systemType,
      baseUrl: values.baseUrl,
      executionMode: 'client',
      roundingRule: values.roundingRule,
    };
    const saved = await $csrfFetch<RemoteSystemConfigDto>(
      `/api/clients/${editingClient.value.id}/remote-config`,
      { method: 'PUT', body: payload },
    );
    remoteConfig.value = saved;
    if (remoteConfigSecret.value) {
      setSecret(saved.id, remoteConfigSecret.value);
    }
    toast.add({
      severity: 'success',
      summary: t('clients.remoteConfig.toastSavedSummary'),
      life: 3000,
    });
  } catch (err: unknown) {
    const key = extractMessageKey(err, 'errors.unexpected');
    if (key === 'error.remoteConfigBaseUrlRequired' || key === 'error.remoteConfigBaseUrlInvalid') {
      baseUrlServerError.value = t(key);
    } else if (key === 'error.remoteConfigSystemTypeRequired') {
      systemTypeServerError.value = t(key);
    } else {
      toast.add({ severity: 'error', summary: t(key), life: 4000 });
    }
  } finally {
    remoteConfigSaving.value = false;
  }
}

function onRemoveRemoteConfig() {
  if (!editingClient.value || !remoteConfig.value) return;
  const clientId = editingClient.value.id;
  const configId = remoteConfig.value.id;

  confirm.require({
    header: t('clients.remoteConfig.deleteConfirmHeader'),
    message: t('clients.remoteConfig.deleteConfirmMessage'),
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: t('clients.deleteConfirmAccept'),
    rejectLabel: t('clients.deleteConfirmReject'),
    acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        await $csrfFetch(`/api/clients/${clientId}/remote-config`, { method: 'DELETE' });
        clearSecret(configId);
        remoteConfig.value = null;
        remoteConfigSecret.value = '';
        remoteConfigInitialValues.value = {
          systemType: 'redmine',
          baseUrl: '',
          roundingRule: 'none',
        };
        toast.add({
          severity: 'success',
          summary: t('clients.remoteConfig.toastRemovedSummary'),
          life: 3000,
        });
      } catch (err: unknown) {
        const key = extractMessageKey(err, 'errors.unexpected');
        toast.add({ severity: 'error', summary: t(key), life: 4000 });
      }
    },
  });
}

// --- Save (create or update) ---
async function onSave({ valid, values }: FormSubmitEvent) {
  nameServerError.value = '';
  if (!valid) return;

  saving.value = true;
  try {
    if (editingClient.value) {
      const payload: UpdateClientDto = { name: values.name };

      const updated = await $csrfFetch<ClientDto>(`/api/clients/${editingClient.value.id}`, {
        method: 'PATCH',
        body: payload,
      });

      await fetchClients();
      toast.add({
        severity: 'success',
        summary: t('clients.toastUpdatedSummary'),
        detail: t('clients.toastUpdatedDetail', { name: updated.name }),
        life: 3000,
      });
    } else {
      const payload: CreateClientDto = { name: values.name };

      const created = await $csrfFetch<ClientDto>('/api/clients', {
        method: 'POST',
        body: payload,
      });

      await fetchClients();
      toast.add({
        severity: 'success',
        summary: t('clients.toastCreatedSummary'),
        detail: t('clients.toastCreatedDetail', { name: created.name }),
        life: 3000,
      });
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
      toast.add({ severity: 'error', summary: t(key), life: 4000 });
    }
  } finally {
    saving.value = false;
  }
}

// --- Delete ---
function onDelete(client: Pick<ClientDto, 'id' | 'name'>) {
  confirm.require({
    header: t('clients.deleteConfirmHeader'),
    message: t('clients.deleteConfirmMessage', { name: client.name }),
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: t('clients.deleteConfirmAccept'),
    rejectLabel: t('clients.deleteConfirmReject'),
    acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        await $csrfFetch(`/api/clients/${client.id}`, { method: 'DELETE' });
        await fetchClients();
        toast.add({
          severity: 'success',
          summary: t('clients.toastDeletedSummary'),
          detail: t('clients.toastDeletedDetail'),
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
  <div data-testid="clients-page">
    <DataTable
      :value="clients"
      data-key="id"
      :sort-field="'name'"
      :sort-order="1"
      :loading="clientsPending"
      data-testid="clients-table"
    >
      <template #header>
        <TableHeader
          :title="t('clients.pageTitle')"
          :new-label="t('clients.newButton')"
          new-testid="new-client-button"
          @create="openCreate"
        />
      </template>

      <template #empty>
        <EmptyState
          :message="t('clients.emptyState')"
          :cta-label="t('clients.emptyStateCta')"
          testid="clients-empty-state"
          @create="openCreate"
        />
      </template>

      <Column field="name" :header="t('clients.columnName')" sortable />
      <Column field="createdAt" :header="t('clients.columnCreated')" sortable>
        <template #body="{ data }: { data: ClientDto }">
          {{ formatDate(data.createdAt, locale) }}
        </template>
      </Column>
      <Column :header="t('clients.columnActions')" style="width: 1%; white-space: nowrap">
        <template #body="{ data }: { data: ClientDto }">
          <RowActions
            :edit-label="t('clients.editButton')"
            :delete-label="t('clients.deleteButton')"
            :edit-testid="`edit-client-${data.id}`"
            :delete-testid="`delete-client-${data.id}`"
            @edit="openEdit(data)"
            @delete="onDelete(data)"
          />
        </template>
      </Column>
    </DataTable>

    <Dialog
      v-model:visible="dialogVisible"
      :header="editingClient ? t('clients.dialogTitleEdit') : t('clients.dialogTitleCreate')"
      modal
      :closable="true"
      style="width: 32rem"
      data-testid="client-dialog"
      @hide="closeDialog"
    >
      <Form
        :resolver="resolver"
        :initial-values="initialValues"
        class="client-form"
        @submit="onSave"
      >
        <FormFieldWrap
          v-slot="{ field }"
          :label="t('clients.nameLabel')"
          name="name"
          input-id="client-name"
          error-testid="client-name-error"
          :server-error="nameServerError"
        >
          <InputText
            id="client-name"
            :maxlength="CLIENT_NAME_MAX_LENGTH"
            :placeholder="t('clients.namePlaceholder')"
            :aria-invalid="field?.invalid"
            :aria-describedby="field?.invalid ? 'client-name-error' : undefined"
            data-testid="client-name-input"
          />
        </FormFieldWrap>

        <FormDialogFooter
          :cancel-label="t('clients.cancelButton')"
          :save-label="t('clients.saveButton')"
          :saving="saving"
          @cancel="closeDialog"
        />
      </Form>

      <template v-if="editingClient">
        <Divider />
        <h3 class="remote-config-heading">{{ t('clients.remoteConfig.heading') }}</h3>

        <Form
          :resolver="remoteConfigResolver"
          :initial-values="remoteConfigInitialValues"
          class="remote-config-form"
          @submit="onSaveRemoteConfig"
        >
          <FormFieldWrap
            v-slot="{ field }"
            :label="t('clients.remoteConfig.systemTypeLabel')"
            name="systemType"
            input-id="remote-config-system-type"
            error-testid="remote-config-system-type-error"
            :server-error="systemTypeServerError"
          >
            <Select
              id="remote-config-system-type"
              :options="systemTypeOptions"
              option-label="label"
              option-value="value"
              :aria-invalid="field?.invalid"
              :aria-describedby="field?.invalid ? 'remote-config-system-type-error' : undefined"
              data-testid="remote-config-system-type-select"
            />
          </FormFieldWrap>

          <FormFieldWrap
            v-slot="{ field }"
            :label="t('clients.remoteConfig.baseUrlLabel')"
            name="baseUrl"
            input-id="remote-config-base-url"
            error-testid="remote-config-base-url-error"
            :server-error="baseUrlServerError"
          >
            <InputText
              id="remote-config-base-url"
              :placeholder="t('clients.remoteConfig.baseUrlPlaceholder')"
              :aria-invalid="field?.invalid"
              :aria-describedby="field?.invalid ? 'remote-config-base-url-error' : undefined"
              data-testid="remote-config-base-url-input"
            />
          </FormFieldWrap>

          <FormFieldWrap
            v-slot="{ field }"
            :label="t('clients.remoteConfig.roundingRuleLabel')"
            name="roundingRule"
            input-id="remote-config-rounding-rule"
            error-testid="remote-config-rounding-rule-error"
          >
            <Select
              id="remote-config-rounding-rule"
              :options="roundingRuleOptions"
              option-label="label"
              option-value="value"
              :aria-invalid="field?.invalid"
              data-testid="remote-config-rounding-rule-select"
            />
          </FormFieldWrap>

          <FormFieldWrap
            :label="t('clients.remoteConfig.secretLabel')"
            name="secret"
            input-id="remote-config-secret"
            error-testid="remote-config-secret-error"
          >
            <Password
              id="remote-config-secret"
              v-model="remoteConfigSecret"
              :feedback="false"
              :placeholder="t('clients.remoteConfig.secretPlaceholder')"
              toggle-mask
              data-testid="remote-config-secret-input"
            />
          </FormFieldWrap>

          <div class="remote-config-actions">
            <Button
              type="submit"
              :label="t('clients.remoteConfig.saveButton')"
              :loading="remoteConfigSaving"
              data-testid="remote-config-save-button"
            />
            <Button
              v-if="remoteConfig"
              type="button"
              severity="danger"
              text
              :label="t('clients.remoteConfig.removeButton')"
              data-testid="remote-config-remove-button"
              @click="onRemoveRemoteConfig"
            />
          </div>
        </Form>
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.client-form {
  display: grid;
  gap: 0.75rem;
  min-width: 20rem;
}

.remote-config-heading {
  margin: 0.5rem 0;
  font-size: 1rem;
}

.remote-config-form {
  display: grid;
  gap: 0.75rem;
  min-width: 20rem;
}

.remote-config-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}
</style>
