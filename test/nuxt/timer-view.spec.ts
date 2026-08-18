import { describe, expect, it, vi, beforeEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime';
import { ref } from 'vue';
import IndexPage from '../../app/pages/index.vue';

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>();
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string, params?: Record<string, unknown>) =>
        params ? `${key}:${JSON.stringify(params)}` : key,
      locale: { value: 'en-US' },
    }),
  };
});

type Entry = {
  id: string;
  taskId: string | null;
  taskName: string | null;
  projectId: string | null;
  projectName: string | null;
  startedAt: string;
  stoppedAt: string | null;
};

type Feed = {
  entries: Entry[];
  hasMore: boolean;
  nextBefore: string | null;
};

const settingsState = ref({
  timezone: 'America/Los_Angeles' as string | null,
});
const { entryFetches, fetchMock, mockState } = vi.hoisted(() => {
  const mockState: {
    feed: Feed;
    projects: unknown[];
  } = {
    feed: { entries: [], hasMore: false, nextBefore: null },
    projects: [],
  };
  const entryFetches = { count: 0 };
  const fetchMock = vi.fn((request: string) => {
    if (String(request).includes('/api/time-entries/feed')) {
      entryFetches.count += 1;
      return Promise.resolve(mockState.feed);
    }
    if (String(request).includes('projects')) return Promise.resolve(mockState.projects);
    return Promise.resolve([]);
  });
  return { entryFetches, fetchMock, mockState };
});

mockNuxtImport('useUserSettings', () => () => ({
  settings: computed(() => settingsState.value),
  effective: computed(() => ({
    timeZone: settingsState.value.timezone ?? 'UTC',
  })),
  detectedTimeZone: 'UTC',
  save: vi.fn(),
}));

mockNuxtImport('$fetch', () => fetchMock);
mockNuxtImport('useRequestFetch', () => () => fetchMock);

mockNuxtImport('useAsyncData', () => {
  return (key: string, fetcher: () => Promise<unknown>) => {
    if (key === 'timer-view-feed') {
      entryFetches.count += 1;
      const data = ref(mockState.feed);
      const refresh = vi.fn(async () => {
        try {
          data.value = (await fetcher()) as Feed;
        } catch {
          /* keep previous */
        }
      });
      return { data, pending: ref(false), refresh };
    }
    const data = ref(mockState.projects);
    const refresh = vi.fn(async () => {
      try {
        data.value = (await fetcher()) as unknown[];
      } catch {
        /* keep previous */
      }
    });
    void refresh();
    return { data, pending: ref(false), refresh };
  };
});

const runningState = ref<unknown>(null);
const elapsedSecondsState = ref(0);
const startMock = vi.fn();
const stopMock = vi.fn();
const fetchRunningMock = vi.fn().mockResolvedValue(undefined);

mockNuxtImport('useTimer', () => () => ({
  running: runningState,
  elapsedSeconds: elapsedSecondsState,
  loading: ref(false),
  fetchRunning: fetchRunningMock,
  start: startMock,
  stop: stopMock,
  updateTitle: vi.fn(),
  updateStartedAt: vi.fn(),
}));

const ButtonStub = {
  template:
    '<button v-bind="$attrs" :data-testid="$attrs[\'data-testid\']" @click="$emit(\'click\')"><slot />{{ label }}</button>',
  props: ['label', 'icon', 'loading', 'text', 'rounded', 'variant'],
  emits: ['click'],
};
const DialogStub = {
  template: '<div v-if="open !== false" data-testid="dialog"><slot name="body" /><slot /></div>',
  props: {
    open: { type: Boolean, default: true },
    title: { type: String, default: '' },
  },
  emits: ['update:open'],
};
const TimerTaskGroupStub = {
  name: 'TimerTaskGroup',
  template: `
    <div :data-testid="\`timer-group-\${group.key}\`">
      <button
        :aria-expanded="expanded"
        :data-testid="\`timer-group-toggle-\${group.key}\`"
        @click="expanded = !expanded"
      />
      <div v-if="expanded" :data-testid="\`timer-group-entries-\${group.key}\`" />
      <span :data-testid="\`timer-group-total-\${group.key}\`">{{ total }}</span>
      <button
        :data-testid="\`timer-group-continue-\${group.key}\`"
        @click="isLive ? $emit('stop') : $emit('continue')"
      />
      <button data-testid="task-changed" @click="$emit('entry-changed')" />
    </div>
  `,
  props: ['group', 'isLive'],
  emits: ['continue', 'stop', 'entry-changed'],
  data: () => ({ expanded: false }),
  computed: {
    total() {
      return '01:00:00';
    },
  },
};

/** Entry payload the add-entry stub emits for smart-include tests. */
const pendingAddedEntry = vi.hoisted(() => ({ value: null as Entry | null }));

const TimerAddEntryDialogStub = {
  name: 'TimerAddEntryDialog',
  props: ['visible', 'timeZone'],
  emits: ['added', 'update:visible'],
  template: '<button type="button" data-testid="stub-emit-added" @click="onEmit" />',
  setup(_: unknown, { emit }: { emit: (e: 'added', payload: Entry) => void }) {
    return {
      onEmit() {
        if (pendingAddedEntry.value) emit('added', pendingAddedEntry.value);
      },
    };
  },
};

const commonStubs = {
  UButton: ButtonStub,
  TableHeader: {
    template:
      '<div data-testid="timer-view-header"><button data-testid="timer-view-add-entry" @click="$emit(\'create\')" /></div>',
    props: ['title', 'newLabel', 'newTestid'],
    emits: ['create'],
  },
  TimerAddEntryDialog: TimerAddEntryDialogStub,
  TimerEntryRow: { template: '<div />', props: ['entry', 'now'] },
  TimerTaskGroup: TimerTaskGroupStub,
  UModal: DialogStub,
};

function entry(overrides: Partial<Entry>): Entry {
  return {
    id: 'id',
    taskId: null,
    taskName: null,
    projectId: null,
    projectName: null,
    startedAt: new Date().toISOString(),
    stoppedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('timer view page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.feed = { entries: [], hasMore: false, nextBefore: null };
    mockState.projects = [];
    settingsState.value = { timezone: 'America/Los_Angeles' };
    entryFetches.count = 0;
    runningState.value = null;
    elapsedSecondsState.value = 0;
    pendingAddedEntry.value = null;
    fetchRunningMock.mockClear();
    startMock.mockClear();
    stopMock.mockClear();
    fetchMock.mockClear();
    vi.stubGlobal('$fetch', fetchMock);
  });

  it('renders the never-tracked empty state when the feed is empty', async () => {
    const wrapper = await mountSuspended(IndexPage, { global: { stubs: commonStubs } });
    await flushPromises();
    expect(wrapper.find('[data-testid="timer-view-never-tracked"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="timer-view-load-more"]').exists()).toBe(false);
  });

  it('leaves the never-tracked state when the first timer starts', async () => {
    const wrapper = await mountSuspended(IndexPage, { global: { stubs: commonStubs } });
    await flushPromises();
    expect(wrapper.find('[data-testid="timer-view-never-tracked"]').exists()).toBe(true);

    const startedAt = new Date().toISOString();
    runningState.value = {
      id: 'running-1',
      taskId: 'task-1',
      taskName: 'First Task',
      projectId: null,
      projectName: null,
      startedAt,
      stoppedAt: null,
    };
    await flushPromises();
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="timer-view-never-tracked"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="timer-group-task-1"]').exists()).toBe(true);
  });

  it('shows newest-day fallback content without an empty-window state', async () => {
    mockState.feed = {
      entries: [
        entry({
          id: 'old-1',
          taskId: 'task-old',
          taskName: 'Old Task',
          startedAt: '2024-01-10T09:00:00.000Z',
          stoppedAt: '2024-01-10T10:00:00.000Z',
        }),
      ],
      hasMore: true,
      nextBefore: '2024-01-10T00:00:00.000Z',
    };
    const wrapper = await mountSuspended(IndexPage, { global: { stubs: commonStubs } });
    await flushPromises();
    expect(wrapper.find('[data-testid="timer-group-task-old"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="timer-view-load-more"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="timer-view-anchored-week-banner"]').exists()).toBe(false);
  });

  it('groups entries by day and task, and renders totals', async () => {
    const now = new Date();
    mockState.feed = {
      entries: [
        entry({
          id: '1',
          taskId: 'task-1',
          taskName: 'Task One',
          projectId: 'proj-1',
          projectName: 'Project One',
          startedAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0).toISOString(),
          stoppedAt: new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            10,
            0,
          ).toISOString(),
        }),
      ],
      hasMore: false,
      nextBefore: null,
    };

    const wrapper = await mountSuspended(IndexPage, { global: { stubs: commonStubs } });
    await flushPromises();

    expect(wrapper.find('[data-testid="timer-group-task-1"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="timer-group-total-task-1"]').text()).toBe('01:00:00');
    expect(wrapper.find('[data-testid="timer-view-load-more"]').exists()).toBe(false);
  });

  it('regroups loaded entries when the timezone changes without refetching', async () => {
    const utcDate = new Date().toISOString().slice(0, 10);
    const expectedLosAngelesDay = new Date(`${utcDate}T00:30:00Z`).toLocaleDateString('en-CA', {
      timeZone: 'America/Los_Angeles',
    });
    const expectedTokyoDay = new Date(`${utcDate}T00:30:00Z`).toLocaleDateString('en-CA', {
      timeZone: 'Asia/Tokyo',
    });
    mockState.feed = {
      entries: [
        entry({
          id: 'boundary',
          taskId: 'task-1',
          taskName: 'Boundary task',
          startedAt: `${utcDate}T00:30:00.000Z`,
          stoppedAt: `${utcDate}T01:30:00.000Z`,
        }),
      ],
      hasMore: false,
      nextBefore: null,
    };

    const wrapper = await mountSuspended(IndexPage, { global: { stubs: commonStubs } });
    await flushPromises();
    expect(wrapper.find(`[data-testid="timer-day-${expectedLosAngelesDay}"]`).exists()).toBe(true);
    const fetchesBefore = entryFetches.count;

    settingsState.value = { timezone: 'Asia/Tokyo' };
    await wrapper.vm.$nextTick();
    expect(wrapper.find(`[data-testid="timer-day-${expectedTokyoDay}"]`).exists()).toBe(true);
    expect(wrapper.find(`[data-testid="timer-day-${expectedLosAngelesDay}"]`).exists()).toBe(false);
    expect(entryFetches.count).toBe(fetchesBefore);
  });

  it('refreshes the running state after a task edit', async () => {
    const now = new Date();
    mockState.feed = {
      entries: [
        entry({
          id: '1',
          taskId: 'task-1',
          taskName: 'Task One',
          startedAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0).toISOString(),
          stoppedAt: new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            10,
            0,
          ).toISOString(),
        }),
      ],
      hasMore: false,
      nextBefore: null,
    };

    const wrapper = await mountSuspended(IndexPage, { global: { stubs: commonStubs } });
    await flushPromises();

    expect(wrapper.find('[data-testid="timer-group-task-1"]').exists()).toBe(true);
    await wrapper.find('[data-testid="task-changed"]').trigger('click');
    await flushPromises();
    expect(fetchRunningMock).toHaveBeenCalledTimes(1);
  });

  it('expand/collapse toggle exposes aria-expanded', async () => {
    const now = new Date();
    mockState.feed = {
      entries: [
        entry({
          id: '1',
          taskId: 'task-1',
          taskName: 'Task One',
          startedAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0).toISOString(),
          stoppedAt: new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            10,
            0,
          ).toISOString(),
        }),
      ],
      hasMore: false,
      nextBefore: null,
    };

    const wrapper = await mountSuspended(IndexPage, { global: { stubs: commonStubs } });
    await flushPromises();

    const toggle = wrapper.find('[data-testid="timer-group-toggle-task-1"]');
    expect(toggle.attributes('aria-expanded')).toBe('false');
    await toggle.trigger('click');
    expect(toggle.attributes('aria-expanded')).toBe('true');
    expect(wrapper.find('[data-testid="timer-group-entries-task-1"]').exists()).toBe(true);
  });

  it('continue action calls useTimer.start with the group task name and project', async () => {
    const now = new Date();
    mockState.feed = {
      entries: [
        entry({
          id: '1',
          taskId: 'task-1',
          taskName: 'Task One',
          projectId: 'proj-1',
          startedAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0).toISOString(),
          stoppedAt: new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            10,
            0,
          ).toISOString(),
        }),
      ],
      hasMore: false,
      nextBefore: null,
    };

    const wrapper = await mountSuspended(IndexPage, { global: { stubs: commonStubs } });
    await flushPromises();

    await wrapper.find('[data-testid="timer-group-continue-task-1"]').trigger('click');
    expect(startMock).toHaveBeenCalledWith('Task One', 'proj-1');
  });

  it('stop action on a live group calls useTimer.stop', async () => {
    const now = new Date();
    const runningEntry = entry({
      id: 'running-1',
      taskId: 'task-1',
      taskName: 'Task One',
      projectId: 'proj-1',
      startedAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0).toISOString(),
      stoppedAt: null,
    });
    runningState.value = runningEntry;
    mockState.feed = {
      entries: [runningEntry],
      hasMore: false,
      nextBefore: null,
    };

    const wrapper = await mountSuspended(IndexPage, { global: { stubs: commonStubs } });
    await flushPromises();

    await wrapper.find('[data-testid="timer-group-continue-task-1"]').trigger('click');
    expect(stopMock).toHaveBeenCalledTimes(1);
    expect(startMock).not.toHaveBeenCalled();
  });

  it('exposes a page-level add entry control', async () => {
    const wrapper = await mountSuspended(IndexPage, { global: { stubs: commonStubs } });
    await flushPromises();
    expect(wrapper.find('[data-testid="timer-view-add-entry"]').exists()).toBe(true);
  });

  it('smart-includes a manual entry on a day outside the loaded feed without load more', async () => {
    // Loaded window: a single June day in America/Los_Angeles (PDT, UTC-7).
    mockState.feed = {
      entries: [
        entry({
          id: 'loaded-1',
          taskId: 'task-loaded',
          taskName: 'Loaded Day Task',
          startedAt: '2024-06-15T17:00:00.000Z',
          stoppedAt: '2024-06-15T18:00:00.000Z',
        }),
      ],
      hasMore: true,
      nextBefore: '2024-06-15T07:00:00.000Z',
    };

    const outsideEntry = entry({
      id: 'outside-1',
      taskId: 'task-outside',
      taskName: 'Outside Day Task',
      // January day not present in the loaded feed; older than loadedFrom.
      startedAt: '2024-01-05T18:00:00.000Z',
      stoppedAt: '2024-01-05T19:00:00.000Z',
    });
    pendingAddedEntry.value = outsideEntry;

    const wrapper = await mountSuspended(IndexPage, { global: { stubs: commonStubs } });
    await flushPromises();

    expect(wrapper.find('[data-testid="timer-group-task-loaded"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="timer-group-task-outside"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="timer-view-load-more"]').exists()).toBe(true);

    const fetchesBefore = entryFetches.count;
    await wrapper.find('[data-testid="stub-emit-added"]').trigger('click');
    await flushPromises();
    await wrapper.vm.$nextTick();

    // Day appears without requiring load more, and without a full feed refresh.
    expect(wrapper.find('[data-testid="timer-group-task-outside"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="timer-day-2024-01-05"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="timer-view-load-more"]').exists()).toBe(true);
    expect(entryFetches.count).toBe(fetchesBefore);
  });
});
