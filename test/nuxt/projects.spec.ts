import { describe, expect, it, vi, beforeEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime';
import ProjectsPage from '../../app/pages/projects.vue';

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
type Project = {
  id: string;
  name: string;
  clientId: string;
  clientName: string;
  createdAt: string;
};

let mockClients: Client[] = [];
let mockProjects: Project[] = [];

mockNuxtImport('useAsyncData', () => {
  return (key: string, fetcher: () => Promise<Client[] | Project[]>) => {
    const initial = key === 'clients-for-projects' ? mockClients : mockProjects;
    const data = ref<Client[] | Project[]>(initial);
    fetcher()
      .then((result) => {
        data.value = result;
      })
      .catch(() => {});
    return { data, pending: ref(false), refresh: vi.fn().mockResolvedValue(undefined) };
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
const SelectStub = {
  template:
    '<select v-bind="$attrs" :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value)"><option v-for="opt in options" :key="opt.id" :value="opt.id">{{ opt.name }}</option></select>',
  props: [
    'modelValue',
    'options',
    'optionLabel',
    'optionValue',
    'placeholder',
    'showClear',
    'loading',
  ],
  emits: ['update:modelValue'],
};
const DataTableStub = {
  template: `
    <div data-testid="projects-table">
      <slot name="header" />
      <slot name="empty" v-if="!value || value.length === 0" />
      <div v-for="row in (value || [])" :key="row.id" data-testid="projects-row">{{ row.name }} {{ row.clientName }}</div>
    </div>
  `,
  props: ['value', 'dataKey', 'sortField', 'sortOrder'],
};
const ColumnStub = { template: '<div />', props: ['field', 'header', 'sortable'] };
const DialogStub = {
  template: '<div v-if="visible" data-testid="project-dialog"><slot /></div>',
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
  Select: SelectStub,
};

describe('projects page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClients = [];
    mockProjects = [];
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (useNuxtApp() as any).$csrfFetch = csrfFetchMock;
    } catch {
      // ignore
    }
  });

  it('4.7a renders empty state when no projects', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue([]));
    csrfFetchMock.mockResolvedValue({});

    const wrapper = await mountSuspended(ProjectsPage, {
      global: { stubs: commonStubs },
    });

    expect(wrapper.find('[data-testid="projects-page"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="projects-empty-state"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="new-project-button"]').exists()).toBe(true);
  });

  it('4.7b renders project rows when projects exist', async () => {
    mockClients = [{ id: 'c1', name: 'Acme', createdAt: new Date().toISOString() }];
    mockProjects = [
      {
        id: '1',
        name: 'Alpha',
        clientId: 'c1',
        clientName: 'Acme',
        createdAt: new Date().toISOString(),
      },
      {
        id: '2',
        name: 'Beta',
        clientId: 'c1',
        clientName: 'Acme',
        createdAt: new Date().toISOString(),
      },
    ];
    vi.stubGlobal(
      '$fetch',
      vi.fn((url: string) => Promise.resolve(url.includes('clients') ? mockClients : mockProjects)),
    );
    csrfFetchMock.mockResolvedValue({});

    const wrapper = await mountSuspended(ProjectsPage, {
      global: { stubs: commonStubs },
    });
    await flushPromises();

    expect(wrapper.find('[data-testid="projects-empty-state"]').exists()).toBe(false);
    expect(wrapper.findAll('[data-testid="projects-row"]')).toHaveLength(2);
  });

  it('4.7f shows clientName for a project whose client was soft-deleted (missing from clientOptions)', async () => {
    // clientOptions only contains active clients; the referenced client was soft-deleted
    mockClients = [];
    mockProjects = [
      {
        id: '1',
        name: 'Orphaned',
        clientId: 'deleted-client',
        clientName: 'Deleted Client',
        createdAt: new Date().toISOString(),
      },
    ];
    vi.stubGlobal(
      '$fetch',
      vi.fn((url: string) => Promise.resolve(url.includes('clients') ? mockClients : mockProjects)),
    );
    csrfFetchMock.mockResolvedValue({});

    const wrapper = await mountSuspended(ProjectsPage, {
      global: { stubs: commonStubs },
    });
    await flushPromises();

    expect(wrapper.text()).toContain('Deleted Client');
  });

  it('4.7g edit dialog seeds a missing client option for a soft-deleted client', async () => {
    // clientOptions only contains active clients; the project's client was soft-deleted
    mockClients = [];
    mockProjects = [
      {
        id: '1',
        name: 'Orphaned',
        clientId: 'deleted-client',
        clientName: 'Deleted Client',
        createdAt: new Date().toISOString(),
      },
    ];
    vi.stubGlobal(
      '$fetch',
      vi.fn((url: string) => Promise.resolve(url.includes('clients') ? mockClients : mockProjects)),
    );
    csrfFetchMock.mockResolvedValue({});

    const wrapper = await mountSuspended(ProjectsPage, {
      global: { stubs: commonStubs },
    });
    await flushPromises();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (wrapper.vm as any).openEdit(mockProjects[0]);
    await flushPromises();

    const select = wrapper.find('[data-testid="project-client-select"]');
    expect(select.exists()).toBe(true);
    const option = select.find('option[value="deleted-client"]');
    expect(option.exists()).toBe(true);
    expect(option.text()).toBe('Deleted Client');
    expect((select.element as HTMLSelectElement).value).toBe('deleted-client');
  });

  it('4.7c dialog opens on new button click', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue([]));
    csrfFetchMock.mockResolvedValue({});

    const wrapper = await mountSuspended(ProjectsPage, {
      global: { stubs: commonStubs },
    });

    expect(wrapper.find('[data-testid="project-dialog"]').exists()).toBe(false);
    await wrapper.find('[data-testid="new-project-button"]').trigger('click');
    expect(wrapper.find('[data-testid="project-dialog"]').exists()).toBe(true);
  });

  it('4.7d inline error displays on save with empty name', async () => {
    mockClients = [{ id: 'c1', name: 'Acme', createdAt: new Date().toISOString() }];
    vi.stubGlobal(
      '$fetch',
      vi.fn((url: string) => Promise.resolve(url.includes('clients') ? mockClients : [])),
    );
    csrfFetchMock.mockRejectedValue({
      data: {
        data: { messageKey: 'error.projectNameRequired' },
      },
    });

    const wrapper = await mountSuspended(ProjectsPage, {
      global: { stubs: commonStubs },
    });

    // Open dialog
    await wrapper.find('[data-testid="new-project-button"]').trigger('click');
    expect(wrapper.find('[data-testid="project-dialog"]').exists()).toBe(true);

    // Select a client so the client-required guard doesn't short-circuit the request
    const select = wrapper.find('[data-testid="project-client-select"]');
    await select.setValue('c1');

    // Submit form
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(wrapper.find('[data-testid="project-name-error"]').exists()).toBe(true);
  });

  it('4.7e client select is labelled', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue([]));
    csrfFetchMock.mockResolvedValue({});

    const wrapper = await mountSuspended(ProjectsPage, {
      global: { stubs: commonStubs },
    });

    expect(wrapper.find('label[for="project-client-filter"]').exists()).toBe(true);

    await wrapper.find('[data-testid="new-project-button"]').trigger('click');
    expect(wrapper.find('label[for="project-client"]').exists()).toBe(true);
  });
});
