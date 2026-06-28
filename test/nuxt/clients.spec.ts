import { describe, expect, it, vi, beforeEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime';
import ClientsPage from '../../app/pages/clients.vue';

const csrfFetchMock = vi.fn();

vi.mock('ofetch', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ofetch')>();
  return {
    ...actual,
    $fetch: Object.assign(csrfFetchMock, {
      create: () => csrfFetchMock,
      raw: csrfFetchMock,
      native: csrfFetchMock,
    }),
  };
});

type Client = { id: string; name: string; createdAt: string };
const useAsyncDataClients: Client[] = [];

mockNuxtImport('useAsyncData', () => {
  return (_key: string, fetcher: () => Promise<Client[]>) => {
    const data = ref<Client[]>(useAsyncDataClients);
    fetcher()
      .then((result) => {
        data.value = result;
      })
      .catch(() => {});
    return { data, refresh: vi.fn() };
  };
});

// Mock vue-i18n
vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>();
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key }),
  };
});

// Mock PrimeVue composables
const confirmRequireMock = vi.fn();
vi.mock('primevue/useconfirm', () => ({
  useConfirm: () => ({ require: confirmRequireMock }),
}));

const toastAddMock = vi.fn();
vi.mock('primevue/usetoast', () => ({
  useToast: () => ({ add: toastAddMock }),
}));

// Stubs for PrimeVue components
const ButtonStub = {
  template:
    '<button v-bind="$attrs" :data-testid="$attrs[\'data-testid\']" @click="$emit(\'click\')"><slot />{{ label }}</button>',
  props: ['label', 'icon', 'loading', 'text', 'rounded', 'severity', 'type'],
  emits: ['click'],
};
const InputTextStub = {
  template:
    '<input v-bind="$attrs" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
  props: ['modelValue', 'placeholder', 'ariaInvalid', 'ariaDescribedby'],
  emits: ['update:modelValue'],
};
const DataTableStub = {
  template: `
    <div data-testid="clients-table">
      <slot name="header" />
      <slot name="empty" v-if="!value || value.length === 0" />
      <div v-for="row in (value || [])" :key="row.id" data-testid="clients-row">{{ row.name }}</div>
    </div>
  `,
  props: ['value', 'dataKey', 'sortField', 'sortOrder'],
};
const ColumnStub = { template: '<div />', props: ['field', 'header', 'sortable'] };
const DialogStub = {
  template: '<div v-if="visible" data-testid="client-dialog"><slot /></div>',
  props: ['visible', 'header', 'modal', 'closable'],
  emits: ['update:visible', 'hide'],
};
const ConfirmDialogStub = { template: '<div />' };

const commonStubs = {
  DataTable: DataTableStub,
  Column: ColumnStub,
  Dialog: DialogStub,
  ConfirmDialog: ConfirmDialogStub,
  Button: ButtonStub,
  InputText: InputTextStub,
};

describe('clients page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('4.6a renders empty state when no clients', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue([]));

    csrfFetchMock.mockResolvedValue({});
    const wrapper = await mountSuspended(ClientsPage, {
      global: { stubs: commonStubs },
    });

    expect(wrapper.find('[data-testid="clients-page"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="clients-empty-state"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="new-client-button"]').exists()).toBe(true);
  });

  it('4.6b renders client rows when clients exist', async () => {
    const mockClients = [
      { id: '1', name: 'Acme Inc', createdAt: new Date().toISOString() },
      { id: '2', name: 'Zebra Corp', createdAt: new Date().toISOString() },
    ];
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue(mockClients));
    csrfFetchMock.mockResolvedValue({});

    const wrapper = await mountSuspended(ClientsPage, {
      global: { stubs: commonStubs },
    });

    expect(wrapper.find('[data-testid="clients-empty-state"]').exists()).toBe(false);
    expect(wrapper.findAll('[data-testid="clients-row"]')).toHaveLength(2);
  });

  it('4.6c dialog opens on new button click', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue([]));
    csrfFetchMock.mockResolvedValue({});

    const wrapper = await mountSuspended(ClientsPage, {
      global: { stubs: commonStubs },
    });

    expect(wrapper.find('[data-testid="client-dialog"]').exists()).toBe(false);
    await wrapper.find('[data-testid="new-client-button"]').trigger('click');
    expect(wrapper.find('[data-testid="client-dialog"]').exists()).toBe(true);
  });

  it('4.6d inline error displays on save with empty name', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue([]));
    csrfFetchMock.mockRejectedValue({
      data: { messageKey: 'error.clientNameRequired' },
    });

    const wrapper = await mountSuspended(ClientsPage, {
      global: { stubs: commonStubs },
    });

    // Open dialog
    await wrapper.find('[data-testid="new-client-button"]').trigger('click');
    expect(wrapper.find('[data-testid="client-dialog"]').exists()).toBe(true);

    // Submit form
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(wrapper.find('[data-testid="client-name-error"]').exists()).toBe(true);
  });
});
