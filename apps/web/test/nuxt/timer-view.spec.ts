import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime';
import { ref } from 'vue';
import IndexPage from '../../app/pages/index.vue';
import type { MessageParams } from '../../shared/types/message-params';
import type { ProjectDto } from '../../shared/types/project';
import type { TimeEntryDto } from '../../shared/types/time-entry';

// oxlint-disable-next-line anti-slop/no-module-mocking -- Nuxt i18n is not injectable in this nuxt test
vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>();
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string, params?: MessageParams) =>
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

type SettingsState = { timezone: string | null };
const settingsState = ref<SettingsState>({
  timezone: 'America/Los_Angeles',
});
interface TimerViewMockState {
  feed: Feed;
  /** Status of the SSR/initial feed request the page awaits lazily. */
  feedStatus: 'pending' | 'success' | 'error';
  /** Answers to client feed requests (load more, refresh), consumed in order. */
  feedResponses: Array<Feed | Error | Promise<Feed>>;
  projects: ProjectDto[];
}
const { entryFetches, fetchMock, mockState } = vi.hoisted(() => {
  const mockState: TimerViewMockState = {
    feed: { entries: [], hasMore: false, nextBefore: null },
    feedStatus: 'success',
    feedResponses: [],
    projects: [],
  };
  const entryFetches = { count: 0 };
  const fetchMock = vi.fn((request: string, _options?: { query?: Record<string, string> }) => {
    if (String(request).includes('/api/time-entries/feed')) {
      entryFetches.count += 1;
      const next = mockState.feedResponses.shift() ?? mockState.feed;
      if (next instanceof Error) return Promise.reject(next);
      return Promise.resolve(next);
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
  return (key: string, fetcher: () => Promise<Feed | ProjectDto[]>) => {
    if (key === 'timer-view-feed') {
      entryFetches.count += 1;
      const data = ref(mockState.feed);
      const refresh = vi.fn(async () => {
        try {
          const next = await fetcher();
          if (!Array.isArray(next) && 'entries' in next) data.value = next;
        } catch {
          /* keep previous */
        }
      });
      const status = ref(mockState.feedStatus);
      return { data: mockState.feedStatus === 'success' ? data : ref(null), status, refresh };
    }
    const data = ref(mockState.projects);
    const refresh = vi.fn(async () => {
      try {
        const next = await fetcher();
        if (Array.isArray(next)) data.value = next;
      } catch {
        /* keep previous */
      }
    });
    void refresh();
    return { data, pending: ref(false), refresh };
  };
});

const runningState = ref<TimeEntryDto | null>(null);
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
  props: ['group', 'isLive', 'now'],
  // Same emits as the real component, so listener identity never forces a re-render.
  emits: ['continue', 'stop', 'entry-changed', 'entry-deleted', 'editing-started'],
  data: () => ({ expanded: false }),
  updated(this: { group: { key: string } }) {
    groupUpdates.set(this.group.key, (groupUpdates.get(this.group.key) ?? 0) + 1);
  },
  computed: {
    total() {
      return '01:00:00';
    },
  },
};

/** Re-render count of each stubbed task group, keyed by group key. */
const groupUpdates = vi.hoisted(() => new Map<string, number>());

/** Entry payload the add-entry stub emits for smart-include tests. */
interface PendingAddedEntry {
  value: Entry | null;
}
const pendingAddedEntry = vi.hoisted((): PendingAddedEntry => ({ value: null }));

const TimerAddEntryDialogStub = {
  name: 'TimerAddEntryDialog',
  props: ['visible', 'timeZone'],
  emits: ['added', 'update:visible'],
  template: '<button type="button" data-testid="stub-emit-added" @click="onEmit" />',
  setup(
    _props: { visible?: boolean; timeZone?: string },
    { emit }: { emit: (e: 'added', payload: Entry) => void },
  ) {
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
    mockState.feedStatus = 'success';
    mockState.feedResponses = [];
    mockState.projects = [];
    settingsState.value = { timezone: 'America/Los_Angeles' };
    entryFetches.count = 0;
    runningState.value = null;
    elapsedSecondsState.value = 0;
    pendingAddedEntry.value = null;
    groupUpdates.clear();
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

  /** Feed query objects of client feed requests (load more / refresh), in order. */
  function clientFeedQueries() {
    return fetchMock.mock.calls
      .filter(([request, options]) => String(request).includes('/api/time-entries/feed') && options)
      .map(([, options]) => options?.query ?? {});
  }

  function loadedDayFeed(): Feed {
    return {
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
  }

  it('shows the loading skeleton, not the never-tracked state, while the feed is pending', async () => {
    mockState.feedStatus = 'pending';
    const wrapper = await mountSuspended(IndexPage, { global: { stubs: commonStubs } });

    expect(wrapper.find('[data-testid="timer-view-loading"]').attributes('aria-busy')).toBe('true');
    expect(wrapper.find('[data-testid="timer-view-never-tracked"]').exists()).toBe(false);
  });

  it('refreshes the whole loaded window with one range request after an edit', async () => {
    mockState.feed = loadedDayFeed();
    mockState.feedResponses = [
      {
        entries: [
          entry({
            id: 'older-1',
            taskId: 'task-older',
            taskName: 'Older Task',
            startedAt: '2024-06-10T17:00:00.000Z',
            stoppedAt: '2024-06-10T18:00:00.000Z',
          }),
        ],
        hasMore: true,
        nextBefore: '2024-06-10T07:00:00.000Z',
      },
    ];
    const wrapper = await mountSuspended(IndexPage, { global: { stubs: commonStubs } });
    await flushPromises();
    await wrapper.find('[data-testid="timer-view-load-more"]').trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-testid="timer-group-task-older"]').exists()).toBe(true);

    fetchMock.mockClear();
    mockState.feedResponses = [
      {
        entries: [...loadedDayFeed().entries],
        hasMore: true,
        nextBefore: '2024-06-15T07:00:00.000Z',
      },
    ];
    await wrapper.find('[data-testid="task-changed"]').trigger('click');
    await flushPromises();

    expect(clientFeedQueries()).toEqual([{ from: '2024-06-10T07:00:00.000Z' }]);
  });

  it('keeps the held entries when the refresh fails', async () => {
    mockState.feed = loadedDayFeed();
    const wrapper = await mountSuspended(IndexPage, { global: { stubs: commonStubs } });
    await flushPromises();

    mockState.feedResponses = [new Error('offline')];
    await wrapper.find('[data-testid="task-changed"]').trigger('click');
    await flushPromises();

    expect(wrapper.find('[data-testid="timer-group-task-loaded"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="timer-view-load-more"]').exists()).toBe(true);
  });

  it('ticks only the running group and its day total (REQ-394)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2024-06-15T12:00:00.000Z'));
      const running = entry({
        id: 'running-1',
        taskId: 'task-live',
        taskName: 'Live Task',
        startedAt: '2024-06-15T11:00:00.000Z',
        stoppedAt: null,
      });
      runningState.value = running;
      mockState.feed = {
        entries: [
          running,
          entry({
            id: 'stopped-1',
            taskId: 'task-idle',
            taskName: 'Idle Task',
            startedAt: '2024-06-15T09:00:00.000Z',
            stoppedAt: '2024-06-15T10:00:00.000Z',
          }),
        ],
        hasMore: false,
        nextBefore: null,
      };
      const wrapper = await mountSuspended(IndexPage, { global: { stubs: commonStubs } });
      await flushPromises();
      const dayTotal = () => wrapper.get('[data-testid="timer-day-total-2024-06-15"]').text();
      const totalBefore = dayTotal();
      groupUpdates.clear();

      vi.setSystemTime(new Date('2024-06-15T12:00:01.000Z'));
      elapsedSecondsState.value += 1;
      await flushPromises();

      expect(groupUpdates.get('task-live')).toBe(1);
      expect(groupUpdates.get('task-idle')).toBeUndefined();
      expect(totalBefore).toContain('02:00:00');
      expect(dayTotal()).toContain('02:00:01');
    } finally {
      vi.useRealTimers();
    }
  });

  describe('automatic load more (REQ-392)', () => {
    /**
     * Test double that lets a test report the sentinel entering or leaving range.
     * NuxtLink prefetching observes links too, so tests find the sentinel's observer
     * by the element it watches.
     */
    class FakeIntersectionObserver {
      static instances: FakeIntersectionObserver[] = [];
      readonly targets: Element[] = [];
      constructor(private readonly callback: (records: { isIntersecting: boolean }[]) => void) {
        FakeIntersectionObserver.instances.push(this);
      }
      observe(target: Element) {
        this.targets.push(target);
      }
      unobserve() {}
      disconnect() {}
      report(isIntersecting: boolean) {
        this.callback([{ isIntersecting }]);
      }
    }

    function sentinelObservers() {
      return FakeIntersectionObserver.instances.filter((observer) =>
        observer.targets.some(
          (target) => target.getAttribute('data-testid') === 'timer-view-load-more-sentinel',
        ),
      );
    }

    function sentinel() {
      const observer = sentinelObservers().at(-1);
      if (!observer) throw new Error('no sentinel observer');
      return observer;
    }

    const olderPage: Feed = {
      entries: [
        entry({
          id: 'older-1',
          taskId: 'task-older',
          taskName: 'Older Task',
          startedAt: '2024-06-10T17:00:00.000Z',
          stoppedAt: '2024-06-10T18:00:00.000Z',
        }),
      ],
      hasMore: false,
      nextBefore: null,
    };

    beforeEach(() => {
      FakeIntersectionObserver.instances = [];
      vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
    });
    afterEach(() => {
      // Unmount so a previous page's sentinel observer never answers for the next test.
      mounted.splice(0).forEach((wrapper) => wrapper.unmount());
      vi.unstubAllGlobals();
    });

    const mounted: Array<Awaited<ReturnType<typeof mountSuspended>>> = [];
    async function mountPage() {
      const wrapper = await mountSuspended(IndexPage, { global: { stubs: commonStubs } });
      mounted.push(wrapper);
      return wrapper;
    }

    it('loads older days when the list end comes into range', async () => {
      mockState.feed = loadedDayFeed();
      mockState.feedResponses = [olderPage];
      const wrapper = await mountPage();
      await flushPromises();
      fetchMock.mockClear();

      sentinel().report(true);
      await flushPromises();

      expect(clientFeedQueries()).toEqual([{ before: '2024-06-15T07:00:00.000Z' }]);
      expect(wrapper.find('[data-testid="timer-group-task-older"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="timer-view-load-more"]').exists()).toBe(false);
    });

    it('issues no second request while one is in flight', async () => {
      mockState.feed = loadedDayFeed();
      let answer: (page: Feed) => void = () => {};
      mockState.feedResponses = [
        new Promise<Feed>((resolve) => {
          answer = resolve;
        }),
      ];
      const wrapper = await mountPage();
      await flushPromises();
      fetchMock.mockClear();

      sentinel().report(true);
      await wrapper.vm.$nextTick();
      sentinel().report(false);
      await wrapper.vm.$nextTick();
      sentinel().report(true);
      await wrapper.vm.$nextTick();
      expect(clientFeedQueries()).toHaveLength(1);

      answer(olderPage);
      await flushPromises();
      expect(clientFeedQueries()).toHaveLength(1);
    });

    it('does not observe or request anything once history is exhausted', async () => {
      mockState.feed = { ...loadedDayFeed(), hasMore: false, nextBefore: null };
      await mountPage();
      await flushPromises();

      expect(sentinelObservers()).toHaveLength(0);
      expect(clientFeedQueries()).toEqual([]);
    });

    it('stops loading automatically after a failure and leaves the button for a retry', async () => {
      mockState.feed = loadedDayFeed();
      mockState.feedResponses = [new Error('offline')];
      const wrapper = await mountPage();
      await flushPromises();
      fetchMock.mockClear();

      sentinel().report(true);
      await flushPromises();
      sentinel().report(false);
      sentinel().report(true);
      await flushPromises();
      expect(clientFeedQueries()).toHaveLength(1);
      expect(wrapper.find('[data-testid="timer-group-task-loaded"]').exists()).toBe(true);

      mockState.feedResponses = [olderPage];
      await wrapper.find('[data-testid="timer-view-load-more"]').trigger('click');
      await flushPromises();
      expect(clientFeedQueries()).toHaveLength(2);
      expect(wrapper.find('[data-testid="timer-group-task-older"]').exists()).toBe(true);
    });
  });
});
