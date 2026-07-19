import { describe, expect, it, vi, beforeEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime';
import { createI18n } from 'vue-i18n';
import RemoteSyncPage from '../../app/pages/sync/[date].vue';
import type { RemoteSyncDayDto } from '../../shared/types/remote-sync-day';

const csrfFetchMock = vi.hoisted(() => vi.fn());
const dollarFetchMock = vi.hoisted(() => vi.fn());
const fetchMock = vi.fn();

vi.mock('ofetch', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ofetch')>();
  return { ...actual, $fetch: Object.assign(csrfFetchMock, { create: () => csrfFetchMock }) };
});
vi.mock('primevue/usetoast', () => ({ useToast: () => ({ add: vi.fn() }) }));

mockNuxtImport('useRoute', () => () => ({ params: { date: '2026-03-15' } }));
mockNuxtImport('$fetch', () => dollarFetchMock);

let dayData: RemoteSyncDayDto;

mockNuxtImport('useAsyncData', () => {
  return (_key: string, fetcher: () => Promise<RemoteSyncDayDto>) => {
    const data = ref<RemoteSyncDayDto | null>(null);
    const pending = ref(true);
    const error = ref<unknown>(null);
    fetcher()
      .then((result) => {
        data.value = result;
      })
      .catch((err) => {
        error.value = err;
      })
      .finally(() => {
        pending.value = false;
      });
    return { data, pending, error, refresh: vi.fn().mockResolvedValue(undefined) };
  };
});

function installFakeLocalStorage() {
  const store = new Map<string, string>();
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
      clear: () => store.clear(),
    },
  });
}

const InputTextStub = {
  template:
    '<input v-bind="$attrs" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" @blur="$emit(\'blur\', $event)" @keydown.enter="$emit(\'keydown\', $event)" />',
  props: ['modelValue'],
  emits: ['update:modelValue', 'blur', 'keydown'],
};
const SelectStub = {
  template: `
    <select v-bind="$attrs" :value="modelValue" @change="$emit('update:modelValue', $event.target.value || null)">
      <option value="">(none)</option>
      <option v-for="option in options" :key="option.id" :value="option.id">{{ option.name }}</option>
    </select>
  `,
  props: ['modelValue', 'options', 'optionLabel', 'optionValue', 'showClear', 'placeholder'],
  emits: ['update:modelValue'],
};
const RemoteIssuePickerStub = {
  template:
    "<button data-testid=\"picker-stub\" @click=\"$emit('link', { remoteIssueId: '9', cachedTitle: 'Stub Issue' })\" />",
  props: ['config'],
  emits: ['link'],
};

const stubs = {
  InputText: InputTextStub,
  Select: SelectStub,
  RemoteIssuePicker: RemoteIssuePickerStub,
};

function testI18n() {
  return createI18n({
    legacy: false,
    locale: 'en',
    messages: { en: {}, pl: {} },
    missingWarn: false,
    fallbackWarn: false,
  });
}

const baseConfig = {
  id: 'config-1',
  systemType: 'openproject' as const,
  baseUrl: 'https://op.example.com',
  transportMode: 'direct' as const,
  roundingRule: 'up_15m' as const,
  requiredFieldDefaults: {},
};

function makeDay(overrides: Partial<RemoteSyncDayDto> = {}): RemoteSyncDayDto {
  return {
    date: '2026-03-15',
    rows: [],
    untitledTotalSeconds: 0,
    ...overrides,
  };
}

async function mount() {
  const wrapper = await mountSuspended(RemoteSyncPage, {
    global: { plugins: [testI18n()], stubs },
  });
  await flushPromises();
  await flushPromises();
  return wrapper;
}

describe('RemoteSync page', () => {
  beforeEach(() => {
    csrfFetchMock.mockReset();
    dollarFetchMock.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    installFakeLocalStorage();
  });

  it('renders a read-only row with its reason for a task with no client', async () => {
    dayData = makeDay({
      rows: [
        {
          taskId: 'task-1',
          taskName: 'Orphan Task',
          projectName: null,
          clientName: null,
          totalSeconds: 600,
          config: null,
          issueRef: null,
        },
      ],
    });
    dollarFetchMock.mockResolvedValue(dayData);

    const wrapper = await mount();
    expect(wrapper.find('[data-testid="remote-sync-state-task-1"]').text()).toBe(
      'remoteSync.state.noClient',
    );
    expect(wrapper.find('[data-testid="remote-sync-original-duration-task-1"]').exists()).toBe(
      true,
    );
    expect(wrapper.find('[data-testid="remote-sync-rounded-duration-task-1"]').exists()).toBe(
      false,
    );
  });

  it('pre-fills the rounded duration once from the shared rounding utility and shows the excluded hint at 0', async () => {
    dayData = makeDay({
      rows: [
        {
          taskId: 'task-2',
          taskName: 'Manageable Task',
          projectName: 'Project',
          clientName: 'Client',
          totalSeconds: 50 * 60,
          config: baseConfig,
          issueRef: { remoteIssueId: '42', cachedTitle: 'Fix bug' },
        },
      ],
    });
    dollarFetchMock.mockResolvedValue(dayData);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        _embedded: { schema: { activity: { _embedded: { allowedValues: [] } } } },
      }),
    });

    const wrapper = await mount();
    const roundedInput = wrapper.find('[data-testid="remote-sync-rounded-duration-task-2"]');
    expect((roundedInput.element as HTMLInputElement).value).toBe('01:00:00');

    await roundedInput.setValue('bad value');
    await roundedInput.trigger('blur');
    await flushPromises();
    expect((roundedInput.element as HTMLInputElement).value).toBe('01:00:00');

    await roundedInput.setValue('0');
    await roundedInput.trigger('blur');
    await flushPromises();
    expect(wrapper.find('[data-testid="remote-sync-excluded-hint-task-2"]').exists()).toBe(true);
  });

  it('pre-selects the activity matching requiredFieldDefaults and shows an error state on fetch failure', async () => {
    dayData = makeDay({
      rows: [
        {
          taskId: 'task-3',
          taskName: 'With Default Activity',
          projectName: 'Project',
          clientName: 'Client',
          totalSeconds: 3600,
          config: { ...baseConfig, id: 'config-3', requiredFieldDefaults: { activity: '2' } },
          issueRef: { remoteIssueId: '1', cachedTitle: 'Issue' },
        },
      ],
    });
    dollarFetchMock.mockResolvedValue(dayData);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        _embedded: {
          schema: {
            activity: {
              _embedded: {
                allowedValues: [
                  { id: 1, name: 'Development' },
                  { id: 2, name: 'Management' },
                ],
              },
            },
          },
        },
      }),
    });

    const wrapper = await mount();
    const select = wrapper.find('[data-testid="remote-sync-activity-select-task-3"]');
    expect((select.element as HTMLSelectElement).value).toBe('2');
  });

  it('fetches activities once for rows sharing the same resolved config and work package', async () => {
    dayData = makeDay({
      rows: [
        {
          taskId: 'task-6a',
          taskName: 'Shared Scope A',
          projectName: 'Project',
          clientName: 'Client',
          totalSeconds: 1800,
          config: { ...baseConfig, id: 'config-6' },
          issueRef: { remoteIssueId: '7', cachedTitle: 'Shared Issue' },
        },
        {
          taskId: 'task-6b',
          taskName: 'Shared Scope B',
          projectName: 'Project',
          clientName: 'Client',
          totalSeconds: 900,
          config: { ...baseConfig, id: 'config-6' },
          issueRef: { remoteIssueId: '7', cachedTitle: 'Shared Issue' },
        },
      ],
    });
    dollarFetchMock.mockResolvedValue(dayData);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        _embedded: {
          schema: { activity: { _embedded: { allowedValues: [{ id: 1, name: 'Dev' }] } } },
        },
      }),
    });

    await mount();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('shows a translated error when the activities fetch fails', async () => {
    dayData = makeDay({
      rows: [
        {
          taskId: 'task-4',
          taskName: 'Fetch Fails',
          projectName: 'Project',
          clientName: 'Client',
          totalSeconds: 3600,
          config: { ...baseConfig, id: 'config-4' },
          issueRef: { remoteIssueId: '1', cachedTitle: 'Issue' },
        },
      ],
    });
    dollarFetchMock.mockResolvedValue(dayData);
    fetchMock.mockResolvedValue({ ok: false, status: 500 });

    const wrapper = await mount();
    expect(wrapper.find('[data-testid="remote-sync-activity-error-task-4"]').exists()).toBe(true);
  });

  it('links an unlinked row inline and flips it to manageable in place', async () => {
    dayData = makeDay({
      rows: [
        {
          taskId: 'task-5',
          taskName: 'Unlinked Task',
          projectName: 'Project',
          clientName: 'Client',
          totalSeconds: 1200,
          config: { ...baseConfig, id: 'config-5' },
          issueRef: null,
        },
      ],
    });
    dollarFetchMock.mockResolvedValue(dayData);
    csrfFetchMock.mockResolvedValue({});

    const wrapper = await mount();
    expect(wrapper.find('[data-testid="remote-sync-state-task-5"]').text()).toBe(
      'remoteSync.state.unlinked',
    );
    await wrapper.find('[data-testid="remote-sync-link-task-5"]').trigger('click');
    await flushPromises();

    expect(csrfFetchMock).toHaveBeenCalledWith('/api/tasks/task-5/remote-issue-ref', {
      method: 'POST',
      body: { remoteIssueId: '9', cachedTitle: 'Stub Issue' },
    });
    expect(wrapper.find('[data-testid="remote-sync-state-task-5"]').text()).toBe(
      'remoteSync.state.manageable',
    );
  });

  it('renders the empty state when there are no entries for the day', async () => {
    dayData = makeDay();
    dollarFetchMock.mockResolvedValue(dayData);

    const wrapper = await mount();
    expect(wrapper.find('[data-testid="remote-sync-empty-state"]').exists()).toBe(true);
  });

  it('renders the read-only untitled bucket separately from task rows', async () => {
    dayData = makeDay({ untitledTotalSeconds: 900 });
    dollarFetchMock.mockResolvedValue(dayData);

    const wrapper = await mount();
    expect(wrapper.find('[data-testid="remote-sync-untitled-row"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="remote-sync-untitled-duration"]').text()).toContain(
      '00:15:00',
    );
  });
});
