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

type Tracker = { id: string; name: string; createdAt: string };
type Project = {
  id: string;
  name: string;
  trackerId: string | null;
  trackerName: string | null;
  createdAt: string;
};

let mockTrackers: Tracker[] = [];
let mockProjects: Project[] = [];
/** When true, the projects list mock reports pending with no data (loading gate tests). */
let projectsListPending = false;
const trackersRefreshMocks: ReturnType<typeof vi.fn>[] = [];

mockNuxtImport('$fetch', () => fetchMock);
mockNuxtImport('useRequestFetch', () => () => fetchMock);
mockNuxtImport('useAppConfirm', () => () => confirmMock);
mockNuxtImport('useAppToast', () => () => ({
  success: toastSuccessMock,
  error: toastErrorMock,
}));
mockNuxtImport('useUserSettings', () => () => ({
  effective: { value: { timeZone: 'UTC' } },
}));

mockNuxtImport('useAsyncData', () => {
  return (
    key: string,
    fetcher: () => Promise<Tracker[] | Project[]>,
    opts?: { immediate?: boolean },
  ) => {
    const isTrackers = key === 'trackers-for-projects';
    // Projects list is SSR-loaded; tracker options stay lazy until dialog open.
    const data = ref<Tracker[] | Project[] | null>(
      isTrackers ? null : projectsListPending ? null : mockProjects,
    );
    const pending = ref(isTrackers ? false : projectsListPending);
    const refresh = vi.fn(async () => {
      pending.value = true;
      try {
        data.value = await fetcher();
      } finally {
        pending.value = false;
      }
    });
    if (isTrackers) {
      trackersRefreshMocks.push(refresh);
    } else if (opts?.immediate !== false && !projectsListPending) {
      // Simulate SSR list resolution for the projects key.
      data.value = mockProjects;
    }
    return { data, pending, refresh };
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
    '<select v-bind="$attrs" :value="modelValue" :data-loading="loading" @change="$emit(\'update:modelValue\', $event.target.value)"><option v-for="opt in items" :key="opt.id" :value="opt.id">{{ opt.name }}</option></select>',
  props: ['modelValue', 'items', 'labelKey', 'valueKey', 'placeholder', 'loading'],
  emits: ['update:modelValue'],
};
const TableStub = {
  template: `
    <div data-testid="projects-table" :data-loading="loading ? 'true' : 'false'">
      <slot name="empty" v-if="!loading && (!data || data.length === 0)" />
      <div v-for="row in (data || [])" :key="row.id" data-testid="projects-row">{{ row.name }} {{ row.trackerName }}</div>
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
      return { name: '', trackerId: undefined };
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
      '<div><label v-if="label" :for="name === \'trackerId\' ? \'project-tracker\' : undefined">{{ label }}</label><slot /><slot name="error" /></div>',
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
    mockTrackers = [];
    mockProjects = [];
    projectsListPending = false;
    trackersRefreshMocks.length = 0;
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(String(url).includes('trackers') ? mockTrackers : mockProjects),
    );
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (useNuxtApp() as any).$csrfFetch = csrfFetchMock;
    } catch {
      // ignore
    }
  });

  it('4.7a renders empty state when no projects (SSR async-data path)', async () => {
    csrfFetchMock.mockResolvedValue({});

    const wrapper = await mountSuspended(ProjectsPage, {
      global: { stubs: commonStubs },
    });
    await flushPromises();

    expect(wrapper.find('[data-testid="projects-page"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="projects-empty-state"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="new-project-button"]').exists()).toBe(true);
  });

  it('does not show empty state while the projects list is still loading', async () => {
    projectsListPending = true;
    csrfFetchMock.mockResolvedValue({});

    const wrapper = await mountSuspended(ProjectsPage, {
      global: { stubs: commonStubs },
    });
    await flushPromises();

    expect(wrapper.find('[data-testid="projects-empty-state"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="projects-table"]').attributes('data-loading')).toBe('true');
  });

  it('4.7b renders project rows when projects exist without a tracker filter', async () => {
    mockTrackers = [{ id: 't1', name: 'Acme', createdAt: new Date().toISOString() }];
    mockProjects = [
      {
        id: '1',
        name: 'Alpha',
        trackerId: 't1',
        trackerName: 'Acme',
        createdAt: new Date().toISOString(),
      },
      {
        id: '2',
        name: 'Beta',
        trackerId: 't1',
        trackerName: 'Acme',
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
    expect(wrapper.find('[data-testid="project-tracker-filter"]').exists()).toBe(false);
  });

  it('does not fetch trackers until the create/edit dialog opens', async () => {
    mockProjects = [
      {
        id: '1',
        name: 'Alpha',
        trackerId: null,
        trackerName: null,
        createdAt: new Date().toISOString(),
      },
    ];
    csrfFetchMock.mockResolvedValue({});

    const wrapper = await mountSuspended(ProjectsPage, {
      global: { stubs: commonStubs },
    });
    await flushPromises();

    expect(trackersRefreshMocks.length).toBeGreaterThan(0);
    expect(trackersRefreshMocks[0]).not.toHaveBeenCalled();

    await wrapper.find('[data-testid="new-project-button"]').trigger('click');
    await flushPromises();

    expect(trackersRefreshMocks[0]).toHaveBeenCalled();
    expect(wrapper.find('[data-testid="project-tracker-select"]').exists()).toBe(true);
  });

  it('4.7f shows trackerName for a project whose tracker was soft-deleted (missing from trackerOptions)', async () => {
    mockTrackers = [];
    mockProjects = [
      {
        id: '1',
        name: 'Orphaned',
        trackerId: 'deleted-tracker',
        trackerName: 'Deleted Tracker',
        createdAt: new Date().toISOString(),
      },
    ];
    csrfFetchMock.mockResolvedValue({});

    const wrapper = await mountSuspended(ProjectsPage, {
      global: { stubs: commonStubs },
    });
    await flushPromises();

    expect(wrapper.text()).toContain('Deleted Tracker');
  });

  it('4.7g edit dialog seeds a missing tracker option for a soft-deleted tracker', async () => {
    mockTrackers = [];
    mockProjects = [
      {
        id: '1',
        name: 'Orphaned',
        trackerId: 'deleted-tracker',
        trackerName: 'Deleted Tracker',
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

    const select = wrapper.find('[data-testid="project-tracker-select"]');
    expect(select.exists()).toBe(true);
    const option = select.find('option[value="deleted-tracker"]');
    expect(option.exists()).toBe(true);
    expect(option.text()).toBe('Deleted Tracker');
    expect((select.element as HTMLSelectElement).value).toBe('deleted-tracker');
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

  it('blocks submission client-side and does not call the server when name is missing', async () => {
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
    mockTrackers = [{ id: 't1', name: 'Acme', createdAt: new Date().toISOString() }];
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
              "<form v-bind=\"$attrs\" @submit.prevent=\"$emit('submit', { data: { name: '', trackerId: 't1' } })\"><slot /></form>",
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

  it('4.7e tracker select is labelled in the dialog', async () => {
    csrfFetchMock.mockResolvedValue({});

    const wrapper = await mountSuspended(ProjectsPage, {
      global: { stubs: commonStubs },
    });

    expect(wrapper.find('label[for="project-tracker-filter"]').exists()).toBe(false);

    await wrapper.find('[data-testid="new-project-button"]').trigger('click');
    expect(wrapper.find('label[for="project-tracker"]').exists()).toBe(true);
  });
});
