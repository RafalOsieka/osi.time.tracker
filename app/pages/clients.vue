<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import { extractMessageKey } from '~/utils/extractMessageKey';

const { t } = useI18n();
const confirm = useConfirm();
const toast = useToast();
const { $csrfFetch } = useNuxtApp();

// --- Data fetching ---
type Client = { id: string; name: string; createdAt: string };

const {
  data: clientsData,
  pending: clientsPending,
  refresh: fetchClients,
} = useAsyncData('clients', () => $fetch<Client[]>('/api/clients'), { server: false });

// --- State ---
const clients = computed(() => clientsData.value ?? []);
const dialogVisible = ref(false);
const editingClient = ref<Client | null>(null);
const nameValue = ref('');
const nameError = ref('');
const saving = ref(false);

// --- Dialog helpers ---
function openCreate() {
  editingClient.value = null;
  nameValue.value = '';
  nameError.value = '';
  dialogVisible.value = true;
}

function openEdit(client: { id: string; name: string }) {
  editingClient.value = client;
  nameValue.value = client.name;
  nameError.value = '';
  dialogVisible.value = true;
}

function closeDialog() {
  dialogVisible.value = false;
}

// --- Save (create or update) ---
async function onSave() {
  nameError.value = '';
  saving.value = true;
  try {
    if (editingClient.value) {
      const updated = await $csrfFetch<{ id: string; name: string; createdAt: string }>(
        `/api/clients/${editingClient.value.id}`,
        { method: 'PATCH', body: { name: nameValue.value } },
      );
      const idx = clients.value.findIndex((c) => c.id === updated.id);
      if (idx !== -1) {
        const next = [...clients.value];
        next[idx] = updated;
        clientsData.value = next;
      }
      toast.add({
        severity: 'success',
        summary: t('clients.toastUpdatedSummary'),
        detail: t('clients.toastUpdatedDetail', { name: updated.name }),
        life: 3000,
      });
    } else {
      const created = await $csrfFetch<{ id: string; name: string; createdAt: string }>(
        '/api/clients',
        { method: 'POST', body: { name: nameValue.value } },
      );
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
      nameError.value = t(key);
    } else {
      toast.add({ severity: 'error', summary: t(key), life: 4000 });
    }
  } finally {
    saving.value = false;
  }
}

// --- Delete ---
function onDelete(client: { id: string; name: string }) {
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
        clientsData.value = clients.value.filter((c) => c.id !== client.id);
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
    <ConfirmDialog />
    <DataTable
      :value="clients"
      data-key="id"
      :sort-field="'name'"
      :sort-order="1"
      :loading="clientsPending"
      data-testid="clients-table"
    >
      <template #header>
        <div class="clients-header">
          <span class="clients-title">{{ t('clients.pageTitle') }}</span>
          <Button
            :label="t('clients.newButton')"
            icon="pi pi-plus"
            data-testid="new-client-button"
            @click="openCreate"
          />
        </div>
      </template>

      <template #empty>
        <div class="clients-empty" data-testid="clients-empty-state">
          <p>{{ t('clients.emptyState') }}</p>
          <Button
            :label="t('clients.emptyStateCta')"
            icon="pi pi-plus"
            data-testid="empty-state-cta"
            @click="openCreate"
          />
        </div>
      </template>

      <Column field="name" :header="t('clients.columnName')" sortable />
      <Column field="createdAt" :header="t('clients.columnCreated')" sortable>
        <template #body="{ data }">
          {{ new Date(data.createdAt).toLocaleDateString() }}
        </template>
      </Column>
      <Column :header="t('clients.columnActions')" style="width: 1%; white-space: nowrap">
        <template #body="{ data }">
          <div class="clients-actions">
            <Button
              icon="pi pi-pencil"
              text
              rounded
              :aria-label="t('clients.editButton')"
              :data-testid="`edit-client-${data.id}`"
              @click="openEdit(data)"
            />
            <Button
              icon="pi pi-trash"
              text
              rounded
              severity="danger"
              :aria-label="t('clients.deleteButton')"
              :data-testid="`delete-client-${data.id}`"
              @click="onDelete(data)"
            />
          </div>
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
      <form class="client-form" @submit.prevent="onSave">
        <label for="client-name">{{ t('clients.nameLabel') }}</label>
        <InputText
          id="client-name"
          v-model="nameValue"
          :placeholder="t('clients.namePlaceholder')"
          :aria-invalid="!!nameError"
          :aria-describedby="nameError ? 'client-name-error' : undefined"
          data-testid="client-name-input"
        />
        <small
          v-if="nameError"
          id="client-name-error"
          role="alert"
          class="client-name-error"
          data-testid="client-name-error"
        >
          {{ nameError }}
        </small>
        <div class="client-form-actions">
          <Button
            type="button"
            :label="t('clients.cancelButton')"
            text
            data-testid="cancel-button"
            @click="closeDialog"
          />
          <Button
            type="submit"
            :label="t('clients.saveButton')"
            :loading="saving"
            data-testid="save-button"
          />
        </div>
      </form>
    </Dialog>
  </div>
</template>

<style scoped>
.clients-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.clients-title {
  font-size: 1.25rem;
  font-weight: 600;
}

.clients-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 2rem;
}

.clients-actions {
  display: flex;
  gap: 0.25rem;
}

.client-form {
  display: grid;
  gap: 0.75rem;
  min-width: 20rem;
}

.client-form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.client-name-error {
  color: var(--p-form-field-invalid-color);
}
</style>
