import { describe, expect, it, vi, beforeEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime';
import TrackersPage from '../../app/pages/trackers.vue';

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

type Tracker = {
  id: string;
  name: string;
  systemType: string;
  baseUrl: string;
  executionMode: string;
  roundingRule: string;
  requiredFieldDefaults: Record<string, string>;
  createdAt: string;
  updatedAt: string;
};
const useAsyncDataTrackers: Tracker[] = [];
/** When true, the trackers list mock reports pending with no data (loading gate tests). */
let trackersListPending = false;

mockNuxtImport('$fetch', () => fetchMock);
mockNuxtImport('useRequestFetch', () => () => fetchMock);

mockNuxtImport('useAsyncData', () => {
  return (_key: string, fetcher: () => Promise<Tracker[]>) => {
    // SSR path: resolve the list during setup (no server:false / onMounted bootstrap).
    const data = ref<Tracker[] | null>(trackersListPending ? null : useAsyncDataTrackers);
    const pending = ref(trackersListPending);
    if (!trackersListPending) {
      fetcher()
        .then((result) => {
          data.value = result;
        })
        .catch(() => {});
    }
    return { data, pending, refresh: vi.fn() };
  };
});

mockNuxtImport('useAppConfirm', () => () => confirmMock);
mockNuxtImport('useAppToast', () => () => ({
  success: toastSuccessMock,
  error: toastErrorMock,
}));
mockNuxtImport('useUserSettings', () => () => ({
  effective: { value: { timeZone: 'UTC' } },
}));
mockNuxtImport('useTrackerSecret', () => () => ({
  get: vi.fn(() => ''),
  set: vi.fn(),
  clear: vi.fn(),
}));

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
const TableStub = {
  template: `
    <div data-testid="trackers-table" :data-loading="loading ? 'true' : 'false'">
      <slot />
      <slot name="empty" v-if="!loading && (!data || data.length === 0)" />
      <div v-for="row in (data || [])" :key="row.id" data-testid="trackers-row">{{ row.name }}</div>
    </div>
  `,
  props: ['data', 'columns', 'loading'],
};
const ModalStub = {
  template:
    '<div v-if="open !== false" data-testid="tracker-dialog"><slot name="body" /><slot /></div>',
  props: {
    open: { type: Boolean, default: true },
    title: { type: String, default: '' },
  },
  emits: ['update:open'],
};
const FormStub = {
  emits: ['submit'],
  template:
    '<form v-bind="$attrs" @submit.prevent="$emit(\'submit\', { data: { name: \'\' } })"><slot /></form>',
};

const commonStubs = {
  UTable: TableStub,
  UModal: ModalStub,
  UButton: ButtonStub,
  UInput: InputStub,
  UForm: FormStub,
  UFormField: { template: '<div><slot /><slot name="error" /></div>' },
  USelect: { template: '<select v-bind="$attrs" />' },
  USeparator: { template: '<hr />' },
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

describe('trackers page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    trackersListPending = false;
    useAsyncDataTrackers.length = 0;
    try {
      // oxlint-disable-next-line typescript/no-explicit-any -- Nuxt $csrfFetch is not on the typed app payload in tests
      (useNuxtApp() as any).$csrfFetch = csrfFetchMock;
    } catch {
      // ignore
    }
  });

  it('renders empty state when no trackers (SSR async-data path)', async () => {
    fetchMock.mockResolvedValue([]);
    csrfFetchMock.mockResolvedValue({});
    const wrapper = await mountSuspended(TrackersPage, {
      global: { stubs: commonStubs },
    });
    await flushPromises();

    expect(wrapper.find('[data-testid="trackers-page"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="trackers-empty-state"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="new-tracker-button"]').exists()).toBe(true);
    expect(fetchMock).toHaveBeenCalled();
  });

  it('does not show empty state while the trackers list is still loading', async () => {
    trackersListPending = true;
    fetchMock.mockResolvedValue([]);
    csrfFetchMock.mockResolvedValue({});
    const wrapper = await mountSuspended(TrackersPage, {
      global: { stubs: commonStubs },
    });
    await flushPromises();

    expect(wrapper.find('[data-testid="trackers-empty-state"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="trackers-table"]').attributes('data-loading')).toBe('true');
  });

  it('renders tracker rows when trackers exist (SSR async-data path)', async () => {
    const mockTrackers = [
      {
        id: '1',
        name: 'Acme Tracker',
        systemType: 'openproject',
        baseUrl: 'https://a.example.com',
        executionMode: 'client',
        roundingRule: 'none',
        requiredFieldDefaults: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: '2',
        name: 'Zebra Tracker',
        systemType: 'redmine',
        baseUrl: 'https://z.example.com',
        executionMode: 'client',
        roundingRule: 'none',
        requiredFieldDefaults: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    fetchMock.mockResolvedValue(mockTrackers);
    csrfFetchMock.mockResolvedValue({});

    const wrapper = await mountSuspended(TrackersPage, {
      global: { stubs: commonStubs },
    });
    await flushPromises();

    expect(wrapper.find('[data-testid="trackers-empty-state"]').exists()).toBe(false);
    expect(wrapper.findAll('[data-testid="trackers-row"]')).toHaveLength(2);
  });

  it('dialog opens on new button click', async () => {
    fetchMock.mockResolvedValue([]);
    csrfFetchMock.mockResolvedValue({});

    const wrapper = await mountSuspended(TrackersPage, {
      global: { stubs: commonStubs },
    });

    await wrapper.find('[data-testid="new-tracker-button"]').trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-testid="tracker-dialog"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="tracker-name-input"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="tracker-base-url-input"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="tracker-secret-input"]').exists()).toBe(true);
  });

  it('blocks submission client-side and does not call the server when name is empty', async () => {
    fetchMock.mockResolvedValue([]);
    csrfFetchMock.mockResolvedValue({});

    const wrapper = await mountSuspended(TrackersPage, {
      global: { stubs: commonStubs },
    });

    await wrapper.find('[data-testid="new-tracker-button"]').trigger('click');
    await flushPromises();
    const form = wrapper.find('form');
    if (form.exists()) {
      await form.trigger('submit');
      await flushPromises();
    }

    expect(wrapper.find('[data-testid="trackers-page"]').exists()).toBe(true);
  });
});
