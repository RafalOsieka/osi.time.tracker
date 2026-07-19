import { describe, expect, it, vi, beforeEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime';
import { createI18n } from 'vue-i18n';
import RemoteSyncPage from '../../app/pages/sync/[date].vue';
import type { RemoteSyncDayDto, RemoteSyncDayEntryDto } from '../../shared/types/remote-sync-day';

const csrfFetchMock = vi.hoisted(() => vi.fn());
const dollarFetchMock = vi.hoisted(() => vi.fn());
const fetchMock = vi.fn();
const confirmRequireMock = vi.hoisted(() => vi.fn());
const createTimeEntryMock = vi.hoisted(() => vi.fn().mockResolvedValue({ remoteLogId: '9001' }));

vi.mock('ofetch', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ofetch')>();
  return { ...actual, $fetch: Object.assign(csrfFetchMock, { create: () => csrfFetchMock }) };
});
vi.mock('primevue/usetoast', () => ({ useToast: () => ({ add: vi.fn() }) }));
vi.mock('primevue/useconfirm', () => ({
  useConfirm: () => ({ require: confirmRequireMock }),
}));
vi.mock('../../app/composables/useOpenProjectClient', () => ({
  useOpenProjectClient: () => ({
    resolveAccount: vi.fn().mockResolvedValue({ id: '7', name: 'Ada' }),
    fetchTimeLogs: vi.fn().mockResolvedValue([]),
    createTimeEntry: createTimeEntryMock,
    invalidateCaches: vi.fn(),
  }),
  mapOpenProjectClientError: (err: unknown, fallback: string) => fallback,
}));

mockNuxtImport('useRoute', () => () => ({ params: { date: '2026-03-15' } }));
mockNuxtImport('$fetch', () => dollarFetchMock);

let dayData: RemoteSyncDayDto;

mockNuxtImport('useAsyncData', () => {
  return (_key: string, fetcher: () => Promise<RemoteSyncDayDto>) => {
    const data = ref<RemoteSyncDayDto | null>(null);
    const pending = ref(true);
    const error = ref<unknown>(null);
    const refresh = vi.fn(async () => {
      data.value = await fetcher();
    });
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
    return { data, pending, error, refresh };
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
const CheckboxStub = {
  template:
    '<input type="checkbox" v-bind="$attrs" :checked="modelValue" @change="$emit(\'update:modelValue\', $event.target.checked)" />',
  props: ['modelValue', 'binary'],
  emits: ['update:modelValue'],
};
const ButtonStub = {
  template:
    '<button v-bind="$attrs" :disabled="disabled" @click="$emit(\'click\')"><slot />{{ label }}</button>',
  props: ['label', 'disabled', 'text', 'size'],
  emits: ['click'],
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
  Checkbox: CheckboxStub,
  Button: ButtonStub,
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

function entry(partial: Partial<RemoteSyncDayEntryDto> & { id: string }): RemoteSyncDayEntryDto {
  return {
    startedAt: '2026-03-15T10:00:00.000Z',
    stoppedAt: '2026-03-15T10:50:00.000Z',
    durationSeconds: 50 * 60,
    previouslyExported: false,
    ...partial,
  };
}

function makeDay(overrides: Partial<RemoteSyncDayDto> = {}): RemoteSyncDayDto {
  return {
    date: '2026-03-15',
    rows: [],
    untitledTotalSeconds: 0,
    ...overrides,
  };
}

function activitiesPayload(
  options: Array<{ id: number; name: string }> = [{ id: 1, name: 'Dev' }],
) {
  return {
    ok: true,
    json: async () => ({
      _embedded: {
        schema: {
          activity: {
            _embedded: { allowedValues: options },
          },
        },
      },
    }),
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
    confirmRequireMock.mockReset();
    createTimeEntryMock.mockReset();
    createTimeEntryMock.mockResolvedValue({ remoteLogId: '9001' });
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
          entries: [],
          exports: [],
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

  it('defaults eligible entries selected, rounds from selected total, and shows excluded hint at 0', async () => {
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
          entries: [entry({ id: 'entry-2' })],
          exports: [],
        },
      ],
    });
    dollarFetchMock.mockResolvedValue(dayData);
    fetchMock.mockResolvedValue(activitiesPayload([{ id: 1, name: 'Dev' }]));

    const wrapper = await mount();
    expect(
      (wrapper.find('[data-testid="remote-sync-entry-check-entry-2"]').element as HTMLInputElement)
        .checked,
    ).toBe(true);
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

  it('pre-selects the activity matching requiredFieldDefaults', async () => {
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
          entries: [entry({ id: 'entry-3', durationSeconds: 3600 })],
          exports: [],
        },
      ],
    });
    dollarFetchMock.mockResolvedValue(dayData);
    fetchMock.mockResolvedValue(
      activitiesPayload([
        { id: 1, name: 'Development' },
        { id: 2, name: 'Management' },
      ]),
    );

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
          entries: [entry({ id: 'e6a', durationSeconds: 1800 })],
          exports: [],
        },
        {
          taskId: 'task-6b',
          taskName: 'Shared Scope B',
          projectName: 'Project',
          clientName: 'Client',
          totalSeconds: 900,
          config: { ...baseConfig, id: 'config-6' },
          issueRef: { remoteIssueId: '7', cachedTitle: 'Shared Issue' },
          entries: [entry({ id: 'e6b', durationSeconds: 900 })],
          exports: [],
        },
      ],
    });
    dollarFetchMock.mockResolvedValue(dayData);
    fetchMock.mockResolvedValue(activitiesPayload());

    await mount();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('shows a translated error and retry control when the activities fetch fails', async () => {
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
          entries: [entry({ id: 'entry-4', durationSeconds: 3600 })],
          exports: [],
        },
      ],
    });
    dollarFetchMock.mockResolvedValue(dayData);
    fetchMock.mockResolvedValue({ ok: false, status: 500 });

    const wrapper = await mount();
    expect(wrapper.find('[data-testid="remote-sync-activity-error-task-4"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="remote-sync-activity-retry-task-4"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="remote-sync-state-task-4"]').text()).toBe(
      'remoteSync.state.activityError',
    );
  });

  it('renders no-activity stated reason for a successful empty activity response', async () => {
    dayData = makeDay({
      rows: [
        {
          taskId: 'task-empty',
          taskName: 'No Activity',
          projectName: 'Project',
          clientName: 'Client',
          totalSeconds: 600,
          config: { ...baseConfig, id: 'config-empty' },
          issueRef: { remoteIssueId: '1', cachedTitle: 'Issue' },
          entries: [entry({ id: 'entry-empty', durationSeconds: 600 })],
          exports: [],
        },
      ],
    });
    dollarFetchMock.mockResolvedValue(dayData);
    fetchMock.mockResolvedValue(activitiesPayload([]));

    const wrapper = await mount();
    expect(wrapper.find('[data-testid="remote-sync-no-activity-task-empty"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="remote-sync-state-task-empty"]').text()).toBe(
      'remoteSync.state.noActivity',
    );
  });

  it('links an unlinked row inline and flips it toward manageable after activities load', async () => {
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
          entries: [entry({ id: 'entry-5', durationSeconds: 1200 })],
          exports: [],
        },
      ],
    });
    dollarFetchMock.mockResolvedValue(dayData);
    csrfFetchMock.mockResolvedValue({});
    fetchMock.mockResolvedValue(activitiesPayload());

    const wrapper = await mount();
    expect(wrapper.find('[data-testid="remote-sync-state-task-5"]').text()).toBe(
      'remoteSync.state.unlinked',
    );
    await wrapper.find('[data-testid="remote-sync-link-task-5"]').trigger('click');
    await flushPromises();
    await flushPromises();

    expect(csrfFetchMock).toHaveBeenCalledWith('/api/tasks/task-5/remote-issue-ref', {
      method: 'POST',
      body: { remoteIssueId: '9', cachedTitle: 'Stub Issue' },
    });
    expect(wrapper.find('[data-testid="remote-sync-state-task-5"]').text()).toBe(
      'remoteSync.state.manageable',
    );
  });

  it('exports with the local task title as the OpenProject comment', async () => {
    dayData = makeDay({
      rows: [
        {
          taskId: 'task-export',
          taskName: 'Ship feature X',
          projectName: 'Project',
          clientName: 'Client',
          totalSeconds: 3600,
          config: {
            ...baseConfig,
            id: 'config-export',
            requiredFieldDefaults: { activity: '1' },
          },
          issueRef: { remoteIssueId: '42', cachedTitle: 'Remote issue' },
          entries: [entry({ id: 'entry-export', durationSeconds: 3600 })],
          exports: [],
        },
      ],
    });
    dollarFetchMock.mockResolvedValue(dayData);
    csrfFetchMock.mockResolvedValue({
      exportId: 'exp-1',
      remoteLogId: '9001',
      taskId: 'task-export',
      localDate: '2026-03-15',
    });
    fetchMock.mockResolvedValue(activitiesPayload([{ id: 1, name: 'Dev' }]));

    const wrapper = await mount();
    await wrapper.find('[data-testid="remote-sync-export-button"]').trigger('click');
    await flushPromises();

    expect(createTimeEntryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        remoteIssueId: '42',
        spentOn: '2026-03-15',
        activityId: '1',
        comment: 'Ship feature X',
      }),
    );
    expect(csrfFetchMock).toHaveBeenCalledWith(
      '/api/sync/export',
      expect.objectContaining({
        method: 'POST',
        body: expect.objectContaining({
          taskId: 'task-export',
          remoteLogId: '9001',
          entryIds: ['entry-export'],
        }),
      }),
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
