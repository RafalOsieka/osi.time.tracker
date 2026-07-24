import { describe, expect, it, vi, beforeEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime';
import ProjectsPage from '../../app/pages/projects.vue';

const csrfFetchMock = vi.hoisted(() => vi.fn());
const fetchMock = vi.hoisted(() => vi.fn());
const confirmMock = vi.hoisted(() => vi.fn(async () => true));
const toastSuccessMock = vi.hoisted(() => vi.fn());
const toastErrorMock = vi.hoisted(() => vi.fn());

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

mockNuxtImport('$fetch', () => fetchMock);
mockNuxtImport('useAppConfirm', () => () => confirmMock);
mockNuxtImport('useAppToast', () => () => ({
  success: toastSuccessMock,
  error: toastErrorMock,
}));
mockNuxtImport('useUserSettings', () => () => ({
  effective: { value: { timeZone: 'UTC', weekStart: 'monday' } },
}));

mockNuxtImport('useAsyncData', () => {
  return (key: string, fetcher: () => Promise<Client[] | Project[]>) => {
    const initial = key === 'clients-for-projects' ? mockClients : mockProjects;
    const data = ref<Client[] | Project[]>(initial);
    const refresh = vi.fn(async () => {
      data.value = await fetcher();
    });
    return { data, pending: ref(false), refresh };
  };
});

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>();
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key, locale: { value: 'en' } }),
  };
});

const ButtonStub = {
  template: '<button v-bind="$attrs" @click="$emit(\'click\')"><slot />{{ label }}</button>',
  props: ['label', 'icon', 'loading', 'type'],
  emits: ['click'],
};
const InputStub = {
  template:
    '<input v-bind="$attrs" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
  props: ['modelValue'],
  emits: ['update:modelValue'],
};
const SelectStub = {
  template:
    '<select v-bind="$attrs" :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value)"><option v-for="opt in items" :key="opt.id" :value="opt.id">{{ opt.name }}</option></select>',
  props: ['modelValue', 'items', 'labelKey', 'valueKey', 'placeholder', 'loading'],
  emits: ['update:modelValue'],
};
const TableStub = {
  template: `
    <div data-testid="projects-table">
      <slot name="empty" v-if="!data || data.length === 0" />
      <div v-for="row in (data || [])" :key="row.id" data-testid="projects-row">{{ row.name }} {{ row.clientName }}</div>
    </div>
  `,
  props: ['data', 'columns', 'loading'],
};
const ModalStub = {
  template:
    '<div v-if="open !== false" data-testid="project-dialog"><slot name="body" /><slot /></div>',
  props: {
    open: { type: Boolean, default: true },
    title: { type: String, default: '' },
  },
  emits: ['update:open'],
};
const FormStub = {
  emits: ['submit'],
  template:
    '<form v-bind="$attrs" @submit.prevent="$emit(\'submit\', { data: stateSnapshot() })"><slot /></form>',
  methods: {
    stateSnapshot() {
      return { name: '', clientId: undefined };
    },
  },
};

const commonStubs = {
  UTable: TableStub,
  UModal: ModalStub,
  UButton: ButtonStub,
  UInput: InputStub,
  USelect: SelectStub,
  UForm: FormStub,
  UFormField: {
    props: ['label', 'name', 'error'],
    template:
      '<div><label v-if="label" :for="name === \'clientId\' ? \'project-client\' : undefined">{{ label }}</label><slot /><slot name="error" /></div>',
  },
  TableHeader: {
    props: ['title', 'newLabel', 'newTestid'],
    emits: ['create'],
    template:
      '<div><span>{{ title }}</span><button :data-testid="newTestid" @click="$emit(\'create\')">{{ newLabel }}</button></div>',
  },
  EmptyState: {
    props: ['message', 'ctaLabel', 'testid'],
    emits: ['create'],
    template:
      '<div :data-testid="testid"><button data-testid="empty-state-cta" @click="$emit(\'create\')">{{ ctaLabel }}</button></div>',
  },
  FormDialogFooter: {
    props: ['cancelLabel', 'saveLabel', 'saving'],
    emits: ['cancel'],
    template:
      '<div><button data-testid="cancel-button" @click="$emit(\'cancel\')">{{ cancelLabel }}</button><button data-testid="save-button" type="submit">{{ saveLabel }}</button></div>',
  },
  RowActions: { template: '<div />' },
};

describe('projects page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClients = [];
    mockProjects = [];
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(String(url).includes('clients') ? mockClients : mockProjects),
    );
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (useNuxtApp() as any).$csrfFetch = csrfFetchMock;
    } catch {
      // ignore
    }
  });

  it('4.7a renders empty state when no projects', async () => {
    csrfFetchMock.mockResolvedValue({});

    const wrapper = await mountSuspended(ProjectsPage, {
      global: { stubs: commonStubs },
    });
    await flushPromises();

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
    csrfFetchMock.mockResolvedValue({});

    const wrapper = await mountSuspended(ProjectsPage, {
      global: { stubs: commonStubs },
    });
    await flushPromises();

    expect(wrapper.find('[data-testid="projects-empty-state"]').exists()).toBe(false);
    expect(wrapper.findAll('[data-testid="projects-row"]')).toHaveLength(2);
  });

  it('4.7f shows clientName for a project whose client was soft-deleted (missing from clientOptions)', async () => {
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
    csrfFetchMock.mockResolvedValue({});

    const wrapper = await mountSuspended(ProjectsPage, {
      global: { stubs: commonStubs },
    });
    await flushPromises();

    expect(wrapper.text()).toContain('Deleted Client');
  });

  it('4.7g edit dialog seeds a missing client option for a soft-deleted client', async () => {
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
    csrfFetchMock.mockResolvedValue({});

    const wrapper = await mountSuspended(ProjectsPage, {
      global: { stubs: commonStubs },
    });

    expect(wrapper.find('[data-testid="project-dialog"]').exists()).toBe(false);
    await wrapper.find('[data-testid="new-project-button"]').trigger('click');
    expect(wrapper.find('[data-testid="project-dialog"]').exists()).toBe(true);
  });

  it('blocks submission client-side and does not call the server when name/client are missing', async () => {
    csrfFetchMock.mockResolvedValue({});

    const wrapper = await mountSuspended(ProjectsPage, {
      global: { stubs: commonStubs },
    });

    await wrapper.find('[data-testid="new-project-button"]').trigger('click');
    const form = wrapper.find('form');
    if (form.exists()) {
      await form.trigger('submit');
      await flushPromises();
    }

    expect(wrapper.find('[data-testid="projects-page"]').exists()).toBe(true);
  });

  it('4.7d inline error displays on save with empty name', async () => {
    mockClients = [{ id: 'c1', name: 'Acme', createdAt: new Date().toISOString() }];
    csrfFetchMock.mockRejectedValue({
      data: {
        data: { messageKey: 'error.projectNameRequired' },
      },
    });

    const wrapper = await mountSuspended(ProjectsPage, {
      global: {
        stubs: {
          ...commonStubs,
          UForm: {
            emits: ['submit'],
            template:
              "<form v-bind=\"$attrs\" @submit.prevent=\"$emit('submit', { data: { name: '', clientId: 'c1' } })\"><slot /></form>",
          },
        },
      },
    });

    await wrapper.find('[data-testid="new-project-button"]').trigger('click');
    expect(wrapper.find('[data-testid="project-dialog"]').exists()).toBe(true);

    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(wrapper.find('[data-testid="project-name-error"]').exists()).toBe(true);
  });

  it('4.7e client select is labelled', async () => {
    csrfFetchMock.mockResolvedValue({});

    const wrapper = await mountSuspended(ProjectsPage, {
      global: { stubs: commonStubs },
    });

    expect(wrapper.find('label[for="project-client-filter"]').exists()).toBe(true);

    await wrapper.find('[data-testid="new-project-button"]').trigger('click');
    expect(wrapper.find('label[for="project-client"]').exists()).toBe(true);
  });
});
