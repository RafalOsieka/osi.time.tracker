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

// --- Dialog helpers ---
function openCreate() {
  editingClient.value = null;
  initialValues.value = { name: '' };
  nameServerError.value = '';
  dialogVisible.value = true;
}

function openEdit(client: ClientDto) {
  editingClient.value = client;
  initialValues.value = { name: client.name };
  nameServerError.value = '';
  dialogVisible.value = true;
}

function closeDialog() {
  dialogVisible.value = false;
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
    </Dialog>
  </div>
</template>

<style scoped>
.client-form {
  display: grid;
  gap: 0.75rem;
  min-width: 20rem;
}
</style>
