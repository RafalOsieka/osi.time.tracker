import { describe, expect, it, vi, beforeEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { defineComponent, h, type PropType, type VNode } from 'vue';
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime';
import TrackersPage from '../../app/pages/trackers.vue';
import RowActions from '../../app/components/RowActions.vue';
import type { TrackerDto } from '../../shared/types/tracker';

const csrfFetchMock = vi.hoisted(() => vi.fn());
const fetchMock = vi.hoisted(() => vi.fn());
const confirmMock = vi.hoisted(() => vi.fn(async () => true));
const toastSuccessMock = vi.hoisted(() => vi.fn());
const toastErrorMock = vi.hoisted(() => vi.fn());
const getSecretMock = vi.hoisted(() => vi.fn(() => ''));
const createRemoteAdapterMock = vi.hoisted(() => vi.fn());

// oxlint-disable-next-line anti-slop/no-module-mocking -- remote client factory is not injectable here
vi.mock('../../app/utils/remote/create-remote-adapter', () => ({
  createRemoteAdapter: (
    config: { id: string; systemType: string; baseUrl: string },
    secret: string | null,
  ) => {
    createRemoteAdapterMock(config, secret);
    return {
      listProjects: vi.fn().mockResolvedValue([]),
      fetchTimeLogsInRange: vi.fn().mockResolvedValue([]),
    };
  },
}));

// oxlint-disable-next-line anti-slop/no-module-mocking -- `$fetch`/`ofetch` is a Nuxt global without a project DI port
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
  directBrowserAccess: boolean;
  roundingRule: string;
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
  get: getSecretMock,
  set: vi.fn(),
  clear: vi.fn(),
}));

// oxlint-disable-next-line anti-slop/no-module-mocking -- Nuxt i18n is not injectable in this nuxt test
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
  // `data-testid="tracker-dialog"` here is only a fallback: usages that pass
  // their own `data-testid` (e.g. TrackerImportDialog) override it via
  // attribute fallthrough. `#footer` is rendered too — TrackerImportDialog's
  // phase-specific action buttons live there, not in the default slot.
  template:
    '<div v-if="open !== false" data-testid="tracker-dialog"><slot name="body" /><slot /><slot name="footer" /></div>',
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
  UCheckbox: {
    props: ['modelValue', 'label'],
    template:
      '<label><input type="checkbox" v-bind="$attrs" :checked="modelValue" />{{ label }}</label>',
  },
  UTooltip: {
    props: ['text'],
    template: '<span :data-tooltip-text="text"><slot /></span>',
  },
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
    getSecretMock.mockReturnValue('');
    try {
      Object.assign(useNuxtApp(), { $csrfFetch: csrfFetchMock });
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
        directBrowserAccess: true,
        roundingRule: 'none',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: '2',
        name: 'Zebra Tracker',
        systemType: 'redmine',
        baseUrl: 'https://z.example.com',
        directBrowserAccess: true,
        roundingRule: 'none',
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

describe('trackers page import action', () => {
  // Renders the real RowActions via the actions column's `cell` function
  // (commonStubs' TableStub above never invokes `cell`), so the secret-gated
  // import action is exercised end to end rather than just the page shell.
  // The page's `actions` column always defines `cell` as a plain render
  // function of `{ row: { original } }` (never a component/string, and never
  // reading the other `CellContext` fields), so this narrow prop typing matches
  // how the stub is actually driven below.
  type ActionsCellRenderer = (context: { row: { original: TrackerDto } }) => VNode;
  const TableWithActionsStub = defineComponent({
    props: {
      // SAFETY: Vue's `PropType` cast is the documented way to type a plain-object
      // prop; the runtime `type: Array` check is unaffected by the cast.
      data: { type: Array as PropType<TrackerDto[]>, default: () => [] },
      columns: {
        // SAFETY: same `PropType` cast pattern as `data` above.
        type: Array as PropType<{ id?: string; cell?: ActionsCellRenderer }[]>,
        default: () => [],
      },
      loading: { type: Boolean, default: false },
    },
    setup(props) {
      return () =>
        h(
          'div',
          { 'data-testid': 'trackers-table' },
          props.data.map((row) => {
            const actionsColumn = props.columns.find((column) => column.id === 'actions');
            const cellVNode = actionsColumn?.cell?.({ row: { original: row } });
            return h(
              'div',
              { key: row.id, 'data-testid': `trackers-row-${row.id}` },
              cellVNode ? [cellVNode] : [],
            );
          }),
        );
    },
  });

  const stubsWithActions = { ...commonStubs, UTable: TableWithActionsStub, RowActions };

  const tracker = {
    id: 'tracker-1',
    name: 'Acme Tracker',
    systemType: 'openproject',
    baseUrl: 'https://a.example.com',
    directBrowserAccess: true,
    roundingRule: 'none',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const trackerB = {
    id: 'tracker-2',
    name: 'Beta Tracker',
    systemType: 'redmine',
    baseUrl: 'https://b.example.com',
    directBrowserAccess: true,
    roundingRule: 'none',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    trackersListPending = false;
    useAsyncDataTrackers.length = 0;
    getSecretMock.mockReturnValue('');
    fetchMock.mockResolvedValue([tracker]);
    csrfFetchMock.mockResolvedValue({});
    try {
      Object.assign(useNuxtApp(), { $csrfFetch: csrfFetchMock });
    } catch {
      // ignore
    }
  });

  it('enables the import action when a secret is stored', async () => {
    getSecretMock.mockReturnValue('secret');
    const wrapper = await mountSuspended(TrackersPage, { global: { stubs: stubsWithActions } });
    await flushPromises();

    const importButton = wrapper.find(`[data-testid="import-tracker-${tracker.id}"]`);
    expect(importButton.exists()).toBe(true);
    expect(importButton.attributes('disabled')).toBeUndefined();
    expect(importButton.attributes('aria-label')).toBe('trackers.importButton');
  });

  it('disables the import action with a hint when no secret is stored', async () => {
    getSecretMock.mockReturnValue('');
    const wrapper = await mountSuspended(TrackersPage, { global: { stubs: stubsWithActions } });
    await flushPromises();

    const importButton = wrapper.find(`[data-testid="import-tracker-${tracker.id}"]`);
    expect(importButton.attributes('disabled')).toBeDefined();
    expect(importButton.attributes('aria-label')).toBe('trackers.importNoSecretHint');
  });

  it('keeps import, edit, and delete as sibling buttons with none nested', async () => {
    getSecretMock.mockReturnValue('secret');
    const wrapper = await mountSuspended(TrackersPage, { global: { stubs: stubsWithActions } });
    await flushPromises();

    const row = wrapper.find(`[data-testid="trackers-row-${tracker.id}"]`);
    const buttons = row.findAll('button');
    expect(buttons.length).toBeGreaterThanOrEqual(3);
    for (const button of buttons) {
      expect(button.element.querySelector('button')).toBeNull();
    }
  });

  it('opens the import dialog when the action is activated', async () => {
    getSecretMock.mockReturnValue('secret');
    const wrapper = await mountSuspended(TrackersPage, { global: { stubs: stubsWithActions } });
    await flushPromises();

    await wrapper.find(`[data-testid="import-tracker-${tracker.id}"]`).trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-testid="tracker-import-dialog"]').exists()).toBe(true);
  });

  it("scans with the correct tracker's adapter after switching trackers, not a stale reused instance", async () => {
    // Regression: the dialog used to stay mounted across tracker switches
    // (`v-if` alone never toggles false->true between two truthy trackers),
    // so `useRemoteLogImport`'s `config` — captured once at setup — stayed
    // frozen to whichever tracker was opened first. Fixed with `:key` on the
    // dialog usage in pages/trackers.vue, forcing a fresh instance per tracker.
    getSecretMock.mockReturnValue('secret');
    fetchMock.mockResolvedValue([tracker, trackerB]);
    const wrapper = await mountSuspended(TrackersPage, { global: { stubs: stubsWithActions } });
    await flushPromises();

    await wrapper.find(`[data-testid="import-tracker-${tracker.id}"]`).trigger('click');
    await flushPromises();
    await wrapper.find('[data-testid="tracker-import-scan"]').trigger('click');
    await flushPromises();
    expect(createRemoteAdapterMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: tracker.id, systemType: 'openproject' }),
      'secret',
    );

    await wrapper.find(`[data-testid="import-tracker-${trackerB.id}"]`).trigger('click');
    await flushPromises();
    await wrapper.find('[data-testid="tracker-import-scan"]').trigger('click');
    await flushPromises();
    expect(createRemoteAdapterMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: trackerB.id, systemType: 'redmine' }),
      'secret',
    );
  });
});
