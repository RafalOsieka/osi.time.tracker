import { describe, expect, it, vi, beforeEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime';
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
  clientName: string | null;
  startedAt: string;
  stoppedAt: string | null;
};

let mockEntries: Entry[] = [];
let mockProjects: unknown[] = [];

mockNuxtImport('useAsyncData', () => {
  return (key: string, fetcher: () => Promise<Entry[] | unknown[]>) => {
    const initial = key === 'timer-view-entries' ? mockEntries : mockProjects;
    const data = ref<Entry[] | unknown[]>(initial);
    fetcher()
      .then((result) => {
        data.value = result;
      })
      .catch(() => {});
    return { data, pending: ref(false), refresh: vi.fn().mockResolvedValue(undefined) };
  };
});

const { runningState, elapsedSecondsState, startMock, fetchRunningMock } = vi.hoisted(() => ({
  runningState: { value: null as unknown, __v_isRef: true },
  elapsedSecondsState: { value: 0, __v_isRef: true },
  startMock: vi.fn(),
  fetchRunningMock: vi.fn().mockResolvedValue(undefined),
}));

mockNuxtImport('useTimer', () => () => ({
  running: runningState,
  elapsedSeconds: elapsedSecondsState,
  loading: { value: false },
  fetchRunning: fetchRunningMock,
  start: startMock,
  stop: vi.fn(),
  updateTitle: vi.fn(),
  updateStartedAt: vi.fn(),
}));

const ButtonStub = {
  template:
    '<button v-bind="$attrs" :data-testid="$attrs[\'data-testid\']" @click="$emit(\'click\')"><slot />{{ label }}</button>',
  props: ['label', 'icon', 'loading', 'text', 'rounded', 'severity'],
  emits: ['click'],
};
const DialogStub = {
  template: '<div v-if="visible" data-testid="dialog"><slot /></div>',
  props: ['visible'],
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
      <button :data-testid="\`timer-group-continue-\${group.key}\`" @click="$emit('continue')" />
      <button data-testid="task-changed" @click="$emit('entry-changed')" />
    </div>
  `,
  props: ['group'],
  emits: ['continue', 'entry-changed'],
  data: () => ({ expanded: false }),
  computed: {
    total() {
      return '01:00:00';
    },
  },
};

const commonStubs = {
  Button: ButtonStub,
  TimerBulkAssignDialog: { template: '<div />' },
  TimerAddEntryDialog: { template: '<div />' },
  TimerEntryRow: { template: '<div />', props: ['entry', 'now'] },
  TimerTaskGroup: TimerTaskGroupStub,
  Dialog: DialogStub,
};

function entry(overrides: Partial<Entry>): Entry {
  return {
    id: 'id',
    taskId: null,
    taskName: null,
    projectId: null,
    projectName: null,
    clientName: null,
    startedAt: new Date().toISOString(),
    stoppedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('timer view page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEntries = [];
    mockProjects = [];
    runningState.value = null;
    elapsedSecondsState.value = 0;
    fetchRunningMock.mockClear();
    vi.stubGlobal(
      '$fetch',
      vi.fn((url: string) =>
        Promise.resolve(url.includes('projects') ? mockProjects : mockEntries),
      ),
    );
  });

  it('renders an empty state when there are no entries', async () => {
    const wrapper = await mountSuspended(IndexPage, { global: { stubs: commonStubs } });
    expect(wrapper.find('[data-testid="timer-view-empty-state"]').exists()).toBe(true);
  });

  it('groups entries by day and task, and renders totals', async () => {
    const now = new Date();
    mockEntries = [
      entry({
        id: '1',
        taskId: 'task-1',
        taskName: 'Task One',
        projectId: 'proj-1',
        projectName: 'Project One',
        startedAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0).toISOString(),
        stoppedAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 0).toISOString(),
      }),
    ];

    const wrapper = await mountSuspended(IndexPage, { global: { stubs: commonStubs } });
    await flushPromises();

    expect(wrapper.find('[data-testid="timer-view-empty-state"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="timer-group-task-1"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="timer-group-total-task-1"]').text()).toBe('01:00:00');
  });

  it('renders grouped content client-side and refreshes the running state after a task edit', async () => {
    const now = new Date();
    mockEntries = [
      entry({
        id: '1',
        taskId: 'task-1',
        taskName: 'Task One',
        startedAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0).toISOString(),
        stoppedAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 0).toISOString(),
      }),
    ];

    const wrapper = await mountSuspended(IndexPage, { global: { stubs: commonStubs } });
    await flushPromises();

    expect(wrapper.find('[data-testid="timer-group-task-1"]').exists()).toBe(true);
    await wrapper.find('[data-testid="task-changed"]').trigger('click');
    await flushPromises();
    expect(fetchRunningMock).toHaveBeenCalledTimes(1);
  });

  it('expand/collapse toggle exposes aria-expanded', async () => {
    const now = new Date();
    mockEntries = [
      entry({
        id: '1',
        taskId: 'task-1',
        taskName: 'Task One',
        startedAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0).toISOString(),
        stoppedAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 0).toISOString(),
      }),
    ];

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
    mockEntries = [
      entry({
        id: '1',
        taskId: 'task-1',
        taskName: 'Task One',
        projectId: 'proj-1',
        startedAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0).toISOString(),
        stoppedAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 0).toISOString(),
      }),
    ];

    const wrapper = await mountSuspended(IndexPage, { global: { stubs: commonStubs } });
    await flushPromises();

    await wrapper.find('[data-testid="timer-group-continue-task-1"]').trigger('click');
    expect(startMock).toHaveBeenCalledWith('Task One', 'proj-1');
  });
});
