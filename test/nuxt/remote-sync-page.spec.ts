import { describe, expect, it, vi, beforeEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime';
import { createI18n } from 'vue-i18n';
import RemoteSyncPage from '../../app/pages/sync/[date].vue';
import type {
  RemoteSyncDayDto,
  RemoteSyncDayEntryDto,
  RemoteSyncExportProvenanceDto,
} from '../../shared/types/remote-sync-day';

const csrfFetchMock = vi.hoisted(() => vi.fn());
const dollarFetchMock = vi.hoisted(() => vi.fn());
const fetchMock = vi.fn();
const confirmMock = vi.hoisted(() => vi.fn(async () => true));
const toastSuccessMock = vi.hoisted(() => vi.fn());
const toastErrorMock = vi.hoisted(() => vi.fn());
const createTimeEntryMock = vi.hoisted(() => vi.fn().mockResolvedValue({ remoteLogId: '9001' }));
const fetchTimeLogsMock = vi.hoisted(() => vi.fn().mockResolvedValue([]));
const invalidateCachesMock = vi.hoisted(() => vi.fn());

// oxlint-disable-next-line anti-slop/no-module-mocking -- `$fetch`/`ofetch` is a Nuxt global without a project DI port
vi.mock('ofetch', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ofetch')>();
  return { ...actual, $fetch: Object.assign(csrfFetchMock, { create: () => csrfFetchMock }) };
});
// oxlint-disable-next-line anti-slop/no-module-mocking -- remote client factory is not injectable here
vi.mock('../../app/composables/use-remote-sync-client', () => ({
  useRemoteSyncClient: () => ({
    resolveAccount: vi.fn().mockResolvedValue({ id: '7', name: 'Ada' }),
    fetchTimeLogs: fetchTimeLogsMock,
    fetchTimeLogsInRange: vi.fn().mockResolvedValue([]),
    createTimeEntry: createTimeEntryMock,
    invalidateCaches: invalidateCachesMock,
  }),
  mapRemoteSyncClientError: (_err: Error, fallback: string) => fallback,
}));

mockNuxtImport('useRoute', () => () => ({ params: { date: '2026-03-15' } }));
mockNuxtImport('$fetch', () => dollarFetchMock);
mockNuxtImport('useAppConfirm', () => () => confirmMock);
mockNuxtImport('useAppToast', () => () => ({
  success: toastSuccessMock,
  error: toastErrorMock,
}));
mockNuxtImport('useUserSettings', () => () => ({
  effective: { value: { timeZone: 'UTC' } },
}));

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
    '<input v-bind="$attrs" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" @blur="$emit(\'blur\', $event)" @keydown="$emit(\'keydown\', $event)" />',
  props: ['modelValue'],
  emits: ['update:modelValue', 'blur', 'keydown'],
};
const SelectStub = {
  template: `
    <select v-bind="$attrs" :value="modelValue ?? ''" @change="$emit('update:modelValue', $event.target.value || null)">
      <option value="">(none)</option>
      <option v-for="option in items || []" :key="option.id" :value="option.id">{{ option.name }}</option>
    </select>
  `,
  props: ['modelValue', 'items', 'labelKey', 'valueKey', 'placeholder'],
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
    "<button v-bind=\"$attrs\" @click=\"$emit('link', { remoteIssueId: '9', cachedTitle: 'Stub Issue' })\" />",
  props: ['config'],
  emits: ['link'],
  inheritAttrs: false,
};
const BadgeStub = {
  template: '<span v-bind="$attrs">{{ label }}<slot /></span>',
  props: ['label', 'color', 'variant', 'icon'],
};
const TooltipStub = {
  name: 'UTooltip',
  template: '<div v-bind="$attrs" :data-tooltip-text="text"><slot /></div>',
  props: ['text', 'content', 'ui', 'arrow', 'portal'],
};
const PopoverStub = {
  template: '<div><slot /><slot name="content" /></div>',
};
const IconStub = {
  template: '<span v-bind="$attrs" />',
  props: ['name'],
};
const ModalStub = {
  template:
    '<div v-if="open" v-bind="$attrs"><slot /><slot name="body" /><slot name="footer" /></div>',
  props: ['open', 'title', 'dismissible', 'close', 'ui'],
  emits: ['update:open'],
};

const AlertStub = {
  template: '<div v-bind="$attrs"><slot /><slot name="close" /></div>',
  props: ['title', 'color', 'variant', 'icon', 'close'],
  emits: ['update:open'],
};

const stubs = {
  UInput: InputTextStub,
  USelect: SelectStub,
  UCheckbox: CheckboxStub,
  UButton: ButtonStub,
  UBadge: BadgeStub,
  UTooltip: TooltipStub,
  UPopover: PopoverStub,
  UIcon: IconStub,
  UModal: ModalStub,
  UAlert: AlertStub,
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
  executionMode: 'client' as const,
  roundingRule: 'up_15m' as const,
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

function priorExport(
  activityId: string,
  overrides: Partial<RemoteSyncExportProvenanceDto> = {},
): RemoteSyncExportProvenanceDto {
  return {
    exportId: 'exp-prior',
    remoteLogId: '8000',
    remoteIssueId: '42',
    exportDurationSeconds: 3600,
    requiredFieldValues: { activity: activityId },
    entryIds: [],
    createdAt: '2026-03-14T12:00:00.000Z',
    ...overrides,
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

async function expandRow(wrapper: Awaited<ReturnType<typeof mount>>, taskId: string) {
  const toggle = wrapper.find(`[data-testid="remote-sync-expand-${taskId}"]`);
  expect(toggle.exists()).toBe(true);
  await toggle.trigger('click');
  await flushPromises();
}

describe('RemoteSync page', () => {
  beforeEach(() => {
    csrfFetchMock.mockReset();
    dollarFetchMock.mockReset();
    fetchMock.mockReset();
    confirmMock.mockReset();
    confirmMock.mockResolvedValue(true);
    createTimeEntryMock.mockReset();
    createTimeEntryMock.mockResolvedValue({ remoteLogId: '9001' });
    fetchTimeLogsMock.mockReset();
    fetchTimeLogsMock.mockResolvedValue([]);
    invalidateCachesMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    installFakeLocalStorage();
    try {
      Object.assign(useNuxtApp(), { $csrfFetch: csrfFetchMock });
    } catch {
      // ignore
    }
  });

  it('renders a read-only row with its reason for a task with no tracker', async () => {
    dayData = makeDay({
      rows: [
        {
          taskId: 'task-1',
          taskName: 'Local Project Task',
          projectName: 'Local Project',
          trackerName: null,
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
    expect(
      wrapper
        .find('[data-testid="remote-sync-prev-day"]')
        .element.closest('[data-tooltip-text]')
        ?.getAttribute('data-tooltip-text'),
    ).toBe('remoteSync.prevDay');
    expect(
      wrapper
        .find('[data-testid="remote-sync-next-day"]')
        .element.closest('[data-tooltip-text]')
        ?.getAttribute('data-tooltip-text'),
    ).toBe('remoteSync.nextDay');
    expect(wrapper.find('[data-testid="remote-sync-heading"]').text()).toBe('remoteSync.pageTitle');
    expect(wrapper.find('[data-testid="remote-sync-date-label"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="remote-sync-today"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="remote-sync-pick-date"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="remote-sync-include-all"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="remote-sync-exclude-all"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="remote-sync-export-button"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="remote-sync-calendar"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="remote-sync-table"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="remote-sync-include-task-1"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="remote-sync-state-task-1"]').text()).toBe(
      'remoteSync.kind.blocked',
    );
    expect(
      wrapper
        .find('[data-testid="remote-sync-expand-task-1"]')
        .element.closest('[data-tooltip-text]')
        ?.getAttribute('data-tooltip-text'),
    ).toBe('remoteSync.expandRow');
    await expandRow(wrapper, 'task-1');
    expect(wrapper.find('[data-testid="remote-sync-detail-task-1"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="remote-sync-rounded-duration-task-1"]').exists()).toBe(
      false,
    );
    expect(wrapper.find('[data-testid="remote-sync-entry-check-entry-1"]').exists()).toBe(false);
  });

  it('shows tracked and rounded to-send on the collapsed Ready row', async () => {
    dayData = makeDay({
      rows: [
        {
          taskId: 'task-2',
          taskName: 'Manageable Task',
          projectName: 'Project',
          trackerName: 'Client',
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
    expect(wrapper.find('[data-testid="remote-sync-tracked-task-2"]').text()).toContain('00:50:00');
    expect(
      wrapper.find<HTMLInputElement>('[data-testid="remote-sync-to-send-task-2"]').element.value,
    ).toContain('01:00:00');
    expect(wrapper.find('[data-testid="remote-sync-include-task-2"]').exists()).toBe(false);
    await expandRow(wrapper, 'task-2');
    expect(wrapper.find('[data-testid="remote-sync-entry-check-entry-2"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="remote-sync-comment-task-2"]').exists()).toBe(false);
  });

  it('lets manageable rows edit to-send inline without expanding', async () => {
    dayData = makeDay({
      rows: [
        {
          taskId: 'task-inline',
          taskName: 'Inline Edit Task',
          projectName: 'Project',
          trackerName: 'Client',
          totalSeconds: 50 * 60,
          config: { ...baseConfig },
          issueRef: { remoteIssueId: '42', cachedTitle: 'Fix bug' },
          entries: [entry({ id: 'entry-inline' })],
          exports: [],
        },
      ],
    });
    dollarFetchMock.mockResolvedValue(dayData);
    fetchMock.mockResolvedValue(activitiesPayload([{ id: 1, name: 'Dev' }]));

    const wrapper = await mount();
    const activity = wrapper.find<HTMLSelectElement>(
      '[data-testid="remote-sync-activity-select-task-inline"]',
    );
    await activity.setValue('1');
    await flushPromises();
    const toSendButton = wrapper.find('[data-testid="remote-sync-to-send-task-inline"]');
    expect(toSendButton.exists()).toBe(true);
    expect(toSendButton.element).toHaveProperty('value');
    expect(
      wrapper.find<HTMLInputElement>('[data-testid="remote-sync-to-send-task-inline"]').element
        .value,
    ).toContain('01:00:00');
    expect(wrapper.find('[data-testid="remote-sync-tracked-task-inline"]').text()).toContain(
      '00:50:00',
    );

    await toSendButton.trigger('click');
    await flushPromises();
    const inlineInput = wrapper.find<HTMLInputElement>(
      '[data-testid="remote-sync-to-send-input-task-inline"]',
    );
    expect(inlineInput.exists()).toBe(true);
    expect(inlineInput.element.value).toBe('01:00:00');

    await inlineInput.setValue('00:45:00');
    await inlineInput.trigger('blur');
    await flushPromises();
    expect(wrapper.find('[data-testid="remote-sync-to-send-input-task-inline"]').exists()).toBe(
      false,
    );
    expect(
      wrapper.find<HTMLInputElement>('[data-testid="remote-sync-to-send-task-inline"]').element
        .value,
    ).toContain('00:45:00');
    expect(wrapper.find('[data-testid="remote-sync-total-to-send"]').text()).toContain('00:45:00');
  });

  it('shows a Sent row as read-only and keeps extra local time unsent', async () => {
    dayData = makeDay({
      rows: [
        {
          taskId: 'task-3',
          taskName: 'Already Sent',
          projectName: 'Project',
          trackerName: 'Client',
          totalSeconds: 5400,
          config: { ...baseConfig, id: 'config-3' },
          issueRef: { remoteIssueId: '1', cachedTitle: 'Issue' },
          entries: [entry({ id: 'entry-3', durationSeconds: 5400 })],
          exports: [priorExport('2', { exportDurationSeconds: 3600 })],
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
    expect(wrapper.find('[data-testid="remote-sync-state-task-3"]').text()).toBe(
      'remoteSync.kind.sent',
    );
    expect(wrapper.find('[data-testid="remote-sync-to-send-input-task-3"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="remote-sync-to-send-task-3"]').text()).toContain('01:00:00');
    expect(wrapper.find('[data-testid="remote-sync-tracked-task-3"]').text()).toContain('01:30:00');
    expect(
      wrapper.find('[data-testid="remote-sync-export-button"]').attributes('disabled'),
    ).toBeDefined();
  });

  it('leaves the activity unselected when there is no last-export match', async () => {
    dayData = makeDay({
      rows: [
        {
          taskId: 'task-3b',
          taskName: 'No Provenance Activity',
          projectName: 'Project',
          trackerName: 'Client',
          totalSeconds: 3600,
          config: { ...baseConfig, id: 'config-3b' },
          issueRef: { remoteIssueId: '1', cachedTitle: 'Issue' },
          entries: [entry({ id: 'entry-3b', durationSeconds: 3600 })],
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
    const select = wrapper.find<HTMLSelectElement>(
      '[data-testid="remote-sync-activity-select-task-3b"]',
    );
    expect(select.element.value).toBe('');
  });

  it('routes activities/account fetches through the server for a server-execution-mode config', async () => {
    window.localStorage.setItem('rsc:config-server', 'secret-value');
    dayData = makeDay({
      rows: [
        {
          taskId: 'task-server',
          taskName: 'Server Routed Task',
          projectName: 'Project',
          trackerName: 'Client',
          totalSeconds: 3600,
          config: { ...baseConfig, id: 'config-server', executionMode: 'server' },
          issueRef: { remoteIssueId: '1', cachedTitle: 'Issue' },
          entries: [entry({ id: 'entry-server', durationSeconds: 3600 })],
          exports: [],
        },
      ],
    });
    dollarFetchMock.mockResolvedValue(dayData);
    csrfFetchMock.mockResolvedValue({ options: [{ id: '1', name: 'Dev' }] });

    await mount();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(csrfFetchMock).toHaveBeenCalledWith(
      '/api/remote/activities',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('fetches activities once for rows sharing the same resolved config and work package', async () => {
    dayData = makeDay({
      rows: [
        {
          taskId: 'task-6a',
          taskName: 'Shared Scope A',
          projectName: 'Project',
          trackerName: 'Client',
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
          trackerName: 'Client',
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
          trackerName: 'Client',
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
      'remoteSync.kind.blocked',
    );
  });

  it('renders no-activity stated reason for a successful empty activity response', async () => {
    dayData = makeDay({
      rows: [
        {
          taskId: 'task-empty',
          taskName: 'No Activity',
          projectName: 'Project',
          trackerName: 'Client',
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
      'remoteSync.kind.blocked',
    );
  });

  it('links an unlinked row inline and flips it toward manageable after activities load', async () => {
    dayData = makeDay({
      rows: [
        {
          taskId: 'task-5',
          taskName: 'Unlinked Task',
          projectName: 'Project',
          trackerName: 'Client',
          totalSeconds: 1200,
          config: { ...baseConfig, id: 'config-5' },
          issueRef: null,
          entries: [entry({ id: 'entry-5', durationSeconds: 1200 })],
          exports: [],
        },
      ],
    });
    dollarFetchMock.mockImplementation(async () => dayData);
    csrfFetchMock.mockImplementation(async (path: string) => {
      if (path === '/api/time-entries/reassign') {
        dayData = makeDay({
          rows: [
            {
              taskId: 'task-5-linked',
              taskName: 'Unlinked Task',
              projectName: 'Project',
              trackerName: 'Client',
              totalSeconds: 1200,
              config: { ...baseConfig, id: 'config-5' },
              issueRef: { remoteIssueId: '9', cachedTitle: 'Stub Issue' },
              entries: [entry({ id: 'entry-5', durationSeconds: 1200 })],
              exports: [],
            },
          ],
        });
        return [
          {
            id: 'entry-5',
            taskId: 'task-5-linked',
            remoteIssueRef: {
              remoteIssueId: '9',
              cachedTitle: 'Stub Issue',
            },
          },
        ];
      }
      return {};
    });
    fetchMock.mockResolvedValue(activitiesPayload());

    const wrapper = await mount();
    expect(wrapper.find('[data-testid="remote-sync-state-task-5"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="remote-sync-link-task-5"]').exists()).toBe(true);
    await wrapper.find('[data-testid="remote-sync-link-task-5"]').trigger('click');
    await flushPromises();
    await flushPromises();

    expect(csrfFetchMock).toHaveBeenCalledWith('/api/time-entries/reassign', {
      method: 'POST',
      body: {
        ids: ['entry-5'],
        remoteIssueId: '9',
        cachedTitle: 'Stub Issue',
      },
    });
    expect(wrapper.find('[data-testid="remote-sync-state-task-5-linked"]').text()).toBe(
      'remoteSync.kind.ready',
    );
  });

  it('fetches same-day remote logs for a linked Redmine row', async () => {
    dayData = makeDay({
      rows: [
        {
          taskId: 'task-redmine-logs',
          taskName: 'Redmine Task',
          projectName: 'Project',
          trackerName: 'Client',
          totalSeconds: 3600,
          config: {
            ...baseConfig,
            id: 'config-redmine',
            systemType: 'redmine',
            baseUrl: 'https://rm.example.com',
            executionMode: 'server',
          },
          issueRef: { remoteIssueId: '42', cachedTitle: 'Remote issue' },
          entries: [entry({ id: 'entry-redmine', durationSeconds: 3600 })],
          exports: [],
        },
      ],
    });
    dollarFetchMock.mockResolvedValue(dayData);
    fetchTimeLogsMock.mockResolvedValue([
      {
        remoteLogId: '11',
        remoteIssueId: '42',
        spentOn: '2026-03-15',
        durationSeconds: 3600,
        activityId: '9',
        activityName: 'Development',
        comment: 'Redmine Task',
        remoteUserId: '7',
      },
    ]);
    fetchMock.mockResolvedValue(activitiesPayload([{ id: 9, name: 'Development' }]));

    const wrapper = await mount();
    await expandRow(wrapper, 'task-redmine-logs');

    expect(fetchTimeLogsMock).toHaveBeenCalledWith({
      spentOn: '2026-03-15',
      workPackageIds: ['42'],
    });
    expect(wrapper.find('[data-testid="remote-sync-remote-logs-task-redmine-logs"]').exists()).toBe(
      true,
    );
    expect(
      wrapper.find('[data-testid="remote-sync-remote-logs-empty-task-redmine-logs"]').exists(),
    ).toBe(false);
    const comment = wrapper.find('[data-testid="remote-sync-remote-log-comment-11"]');
    expect(comment.text()).toContain('Redmine Task');
    expect(comment.attributes('title')).toBeUndefined();
    expect(comment.element.closest('[data-overflow-tooltip]')).not.toBeNull();
    expect(
      wrapper.find('[data-testid="remote-sync-duplicate-warning-task-redmine-logs"]').exists(),
    ).toBe(true);
  });

  it('exports with the local task title as the OpenProject comment', async () => {
    dayData = makeDay({
      rows: [
        {
          taskId: 'task-export',
          taskName: 'Ship feature X',
          projectName: 'Project',
          trackerName: 'Client',
          totalSeconds: 3600,
          config: {
            ...baseConfig,
            id: 'config-export',
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
    const activity = wrapper.find<HTMLSelectElement>(
      '[data-testid="remote-sync-activity-select-task-export"]',
    );
    await activity.setValue('1');
    await flushPromises();
    await wrapper.find('[data-testid="remote-sync-export-button"]').trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-testid="remote-sync-export-dialog"]').exists()).toBe(true);
    expect(createTimeEntryMock).not.toHaveBeenCalled();
    await wrapper.find('[data-testid="remote-sync-export-confirm"]').trigger('click');
    await flushPromises();
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

  it('does not reassign the local task when title-to-send is edited', async () => {
    dayData = makeDay({
      rows: [
        {
          taskId: 'task-title',
          taskName: 'Original name',
          projectName: 'Project',
          trackerName: 'Client',
          totalSeconds: 3600,
          config: { ...baseConfig, id: 'config-title' },
          issueRef: { remoteIssueId: '42', cachedTitle: 'Issue' },
          entries: [entry({ id: 'entry-title', durationSeconds: 3600 })],
          exports: [],
        },
      ],
    });
    dollarFetchMock.mockResolvedValue(dayData);
    fetchMock.mockResolvedValue(activitiesPayload([{ id: 1, name: 'Dev' }]));

    const wrapper = await mount();
    await wrapper.find('[data-testid="remote-sync-task-name-task-title"]').trigger('click');
    await flushPromises();
    const input = wrapper.find<HTMLInputElement>('[data-testid="remote-sync-comment-task-title"]');
    expect(input.exists()).toBe(true);
    await input.setValue('Comment for tracker');
    await input.trigger('blur');
    await flushPromises();
    expect(csrfFetchMock).not.toHaveBeenCalledWith('/api/time-entries/reassign', expect.anything());
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

  it('shows reconciling day summary chips including blocked and untitled time', async () => {
    dayData = makeDay({
      untitledTotalSeconds: 300,
      rows: [
        {
          taskId: 'task-sum-ok',
          taskName: 'Ready',
          projectName: 'Project',
          trackerName: 'Client',
          totalSeconds: 3600,
          config: { ...baseConfig, id: 'config-sum' },
          issueRef: { remoteIssueId: '1', cachedTitle: 'Issue' },
          entries: [entry({ id: 'e-sum-ok', durationSeconds: 3600 })],
          exports: [],
        },
        {
          taskId: 'task-sum-blocked',
          taskName: 'Blocked',
          projectName: 'Local Project',
          trackerName: null,
          totalSeconds: 600,
          config: null,
          issueRef: null,
          entries: [entry({ id: 'e-sum-blocked', durationSeconds: 600 })],
          exports: [],
        },
      ],
    });
    dollarFetchMock.mockResolvedValue(dayData);
    fetchMock.mockResolvedValue(activitiesPayload([{ id: 1, name: 'Dev' }]));

    const wrapper = await mount();
    const activity = wrapper.find<HTMLSelectElement>(
      '[data-testid="remote-sync-activity-select-task-sum-ok"]',
    );
    await activity.setValue('1');
    await flushPromises();
    expect(wrapper.find('[data-testid="remote-sync-total-day"]').text()).toContain('01:15:00');
    expect(wrapper.find('[data-testid="remote-sync-total-tracked"]').text()).toContain('01:00:00');
    expect(wrapper.find('[data-testid="remote-sync-total-to-send"]').text()).toContain('01:00:00');
    expect(wrapper.find('[data-testid="remote-sync-total-blocked"]').text()).toContain('00:10:00');
    expect(wrapper.find('[data-testid="remote-sync-total-untitled"]').text()).toContain('00:05:00');
    expect(wrapper.find('[data-testid="remote-sync-state-task-sum-blocked"]').text()).toContain(
      'remoteSync.kind.blocked',
    );

    const tooltipTexts = wrapper
      .findAll('[data-tooltip-text]')
      .map((node) => node.attributes('data-tooltip-text') ?? '');
    expect(tooltipTexts).toEqual(
      expect.arrayContaining([
        'remoteSync.dayTotalTooltip',
        'remoteSync.trackedTooltip',
        'remoteSync.toSendTooltip',
        'remoteSync.deltaTooltip',
        'remoteSync.blockedTooltip',
        'remoteSync.untitledTooltip',
      ]),
    );
  });

  it('shows a no-comment placeholder for remote logs without comments', async () => {
    dayData = makeDay({
      rows: [
        {
          taskId: 'task-comment',
          taskName: 'Comment Task',
          projectName: 'Project',
          trackerName: 'Client',
          totalSeconds: 1800,
          config: { ...baseConfig, id: 'config-comment' },
          issueRef: { remoteIssueId: '55', cachedTitle: 'Issue' },
          entries: [entry({ id: 'entry-comment', durationSeconds: 1800 })],
          exports: [],
        },
      ],
    });
    dollarFetchMock.mockResolvedValue(dayData);
    fetchTimeLogsMock.mockResolvedValue([
      {
        remoteLogId: 'log-empty-comment',
        remoteIssueId: '55',
        spentOn: '2026-03-15',
        durationSeconds: 900,
        activityId: '1',
        activityName: 'Dev',
        comment: null,
        remoteUserId: '7',
      },
    ]);
    fetchMock.mockResolvedValue(activitiesPayload([{ id: 1, name: 'Dev' }]));

    const wrapper = await mount();
    await expandRow(wrapper, 'task-comment');
    expect(
      wrapper.find('[data-testid="remote-sync-remote-log-comment-log-empty-comment"]').text(),
    ).toBe('remoteSync.remoteLogNoComment');
  });
});
