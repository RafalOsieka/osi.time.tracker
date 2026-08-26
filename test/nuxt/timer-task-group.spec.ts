import { describe, expect, it, vi, beforeEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime';
import { createI18n } from 'vue-i18n';
import TimerTaskGroup from '../../app/components/TimerTaskGroup.vue';
import type { TimerViewGroup } from '../../app/utils/timer-view-grouping';
import type { ProjectDto } from '../../shared/types/project';
import type { TrackerDto } from '../../shared/types/tracker';

const csrfFetchMock = vi.hoisted(() => vi.fn());
const toastErrorMock = vi.hoisted(() => vi.fn());

// oxlint-disable-next-line anti-slop/no-module-mocking -- `$fetch`/`ofetch` is a Nuxt global without a project DI port
vi.mock('ofetch', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ofetch')>();
  return { ...actual, $fetch: Object.assign(csrfFetchMock, { create: () => csrfFetchMock }) };
});

mockNuxtImport('useAppToast', () => () => ({
  success: vi.fn(),
  error: toastErrorMock,
}));

const ButtonStub = {
  template: `
    <component
      :is="to ? 'a' : 'button'"
      v-bind="$attrs"
      :href="to"
      :target="target"
      :aria-label="ariaLabel || $attrs['aria-label']"
      :disabled="disabled"
      :data-icon="icon"
      :data-ui-leading="ui?.leadingIcon"
      @click="$emit('click', $event)"
    >{{ label }}<slot /></component>
  `,
  props: [
    'label',
    'ariaLabel',
    'icon',
    'variant',
    'color',
    'square',
    'size',
    'disabled',
    'ui',
    'to',
    'target',
    'external',
  ],
  emits: ['click'],
};
const InputStub = {
  template:
    '<input v-bind="$attrs" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" @blur="$emit(\'blur\')" @keydown.enter="$emit(\'keydown\', $event)" @keydown.esc="$emit(\'keydown\', $event)" />',
  props: ['modelValue'],
  emits: ['update:modelValue', 'blur', 'keydown'],
};
const PopoverStub = {
  props: ['open', 'modal', 'content'],
  emits: ['update:open'],
  template: `
    <div>
      <div @click="$emit('update:open', true)"><slot /></div>
      <div v-if="open"><slot name="content" /></div>
    </div>
  `,
};

const TooltipStub = {
  props: ['text', 'content'],
  template: '<span v-bind="$attrs" :data-tooltip-text="text"><slot /></span>',
};
const BadgeStub = {
  props: ['label', 'color', 'variant', 'size'],
  template: '<span v-bind="$attrs" :aria-label="$attrs[\'aria-label\']">{{ label }}<slot /></span>',
};

const stubs = {
  UButton: ButtonStub,
  UInput: InputStub,
  UPopover: PopoverStub,
  UTooltip: TooltipStub,
  UBadge: BadgeStub,
  TimerEntryRow: true,
  RemoteIssuePicker: {
    props: ['config', 'currentRef', 'linkTestid', 'cachedTestid', 'unlinkedTestid'],
    emits: ['link', 'unlink'],
    template: `
      <div v-bind="$attrs" data-remote-issue-picker="1">
        <a
          v-if="currentRef && currentRef.url"
          :href="currentRef.url"
          target="_blank"
          :data-testid="linkTestid"
        >#{{ currentRef.remoteIssueId }}</a>
        <span v-else-if="currentRef" :data-testid="cachedTestid">#{{ currentRef.remoteIssueId }}</span>
        <span
          v-else
          :data-testid="unlinkedTestid"
          :aria-label="'timerView.remoteIssue.unlinked'"
        ></span>
        <button type="button" data-testid="stub-link" @click="$emit('link', { remoteIssueId: '42', cachedTitle: 'Fix' })">link</button>
        <button type="button" data-testid="stub-unlink" @click="$emit('unlink')">unlink</button>
      </div>
    `,
  },
};

const openProjectTracker = {
  id: 'tracker-1',
  name: 'OpenProject',
  systemType: 'openproject' as const,
  baseUrl: 'https://op.example.com',
  executionMode: 'client' as const,
  roundingRule: 'none' as const,
  requiredFieldDefaults: {},
  createdAt: '',
  updatedAt: '',
};
const redmineTracker = { ...openProjectTracker, systemType: 'redmine' as const };

function testI18n() {
  return createI18n({
    legacy: false,
    locale: 'en',
    messages: { en: {}, pl: {} },
    missingWarn: false,
    fallbackWarn: false,
  });
}

function group(key = 'task-1') {
  return {
    key,
    taskId: 'task-1',
    taskName: 'Build feature',
    projectId: 'project-gone',
    projectName: 'Archived project',
    date: '2024-03-15',
    totalSeconds: 3600,
    entries: [
      {
        id: 'entry-1',
        taskId: 'task-1',
        taskName: 'Build feature',
        projectId: 'project-gone',
        projectName: 'Archived project',
        startedAt: '2024-03-15T09:00:00.000Z',
        stoppedAt: '2024-03-15T10:00:00.000Z',
      },
    ],
  };
}

type TimerTaskGroupMountProps = {
  group?: TimerViewGroup;
  isLive?: boolean;
  now?: number;
  timeZone?: string;
  editorKey?: string;
  activeEditorKey?: string | null;
  projectOptions?: ProjectDto[];
  tracker?: TrackerDto | null;
};

function mount(props: TimerTaskGroupMountProps = {}) {
  return mountSuspended(TimerTaskGroup, {
    props: {
      group: group(),
      isLive: false,
      now: Date.now(),
      timeZone: 'UTC',
      editorKey: 'a',
      ...props,
    },
    global: { plugins: [testI18n()], stubs },
  });
}

describe('TimerTaskGroup', () => {
  beforeEach(() => {
    csrfFetchMock.mockReset();
    try {
      Object.assign(useNuxtApp(), { $csrfFetch: csrfFetchMock });
    } catch {
      // ignore
    }
  });

  it('commits a renamed title, while empty names silently revert and Escape cancels', async () => {
    csrfFetchMock.mockResolvedValue({});
    const wrapper = await mount();
    const toggle = wrapper.find('[data-testid="timer-group-toggle-task-1"]');
    expect(toggle.element.closest('[data-tooltip-text]')?.getAttribute('data-tooltip-text')).toBe(
      'timerView.expandLabel',
    );
    await wrapper.find('[data-testid="timer-group-title-task-1"]').trigger('click');
    await flushPromises();
    const title = wrapper.find('[data-testid="timer-group-title-input-task-1"]');
    await title.setValue('  Ship feature  ');
    await title.trigger('blur');
    await flushPromises();

    expect(csrfFetchMock).toHaveBeenCalledWith('/api/time-entries/reassign', {
      method: 'POST',
      body: { ids: ['entry-1'], name: 'Ship feature' },
    });
    expect(wrapper.emitted('entry-changed')).toHaveLength(1);

    await wrapper.find('[data-testid="timer-group-title-task-1"]').trigger('click');
    await flushPromises();
    await wrapper.find('[data-testid="timer-group-title-input-task-1"]').setValue('   ');
    await wrapper.find('[data-testid="timer-group-title-input-task-1"]').trigger('blur');
    await flushPromises();
    expect(csrfFetchMock).toHaveBeenCalledTimes(1);

    await wrapper.find('[data-testid="timer-group-title-task-1"]').trigger('click');
    await flushPromises();
    await wrapper.find('[data-testid="timer-group-title-input-task-1"]').trigger('keydown', {
      key: 'Escape',
    });
    await flushPromises();
    expect(wrapper.find('[data-testid="timer-group-title-input-task-1"]').exists()).toBe(false);
  });

  it('opens the project select on one click, retains its deleted project, and commits changes or clearing', async () => {
    csrfFetchMock.mockResolvedValue({});
    const wrapper = await mount({
      projectOptions: [
        {
          id: 'project-2',
          name: 'Current project',
          trackerId: 'c',
          trackerName: null,
          createdAt: '',
        },
      ],
    });
    const projectButton = wrapper.find('[data-testid="timer-group-project-task-1"]');
    expect(projectButton.attributes('aria-label')).toBe('timerView.editor.projectLabel');
    await projectButton.trigger('click');
    await flushPromises();

    const list = wrapper.find('[data-testid="timer-group-project-select-task-1"]');
    expect(list.exists()).toBe(true);
    expect(list.text()).toContain('Archived project');
    const current = list.findAll('button').find((node) => node.text().includes('Current project'));
    expect(current).toBeDefined();
    await current!.trigger('click');
    await flushPromises();

    expect(csrfFetchMock).toHaveBeenLastCalledWith('/api/time-entries/reassign', {
      method: 'POST',
      body: { ids: ['entry-1'], projectId: 'project-2' },
    });

    await wrapper.find('[data-testid="timer-group-project-task-1"]').trigger('click');
    await flushPromises();
    const clear = wrapper
      .find('[data-testid="timer-group-project-select-task-1"]')
      .findAll('button')
      .find((node) => node.text().includes('timerView.noProject'));
    expect(clear).toBeDefined();
    await clear!.trigger('click');
    await flushPromises();
    expect(csrfFetchMock).toHaveBeenLastCalledWith('/api/time-entries/reassign', {
      method: 'POST',
      body: { ids: ['entry-1'], projectId: null },
    });

    const noProject = await mount({
      group: { ...group(), projectId: null, projectName: null },
    });
    expect(noProject.find('[data-testid="timer-group-project-task-1"]').text()).toContain(
      'timerView.noProject',
    );
  });

  it('keeps header controls as sibling buttons and closes a previous group editor', async () => {
    const Host = {
      components: { TimerTaskGroup },
      setup: () => {
        const active = ref<string | null>(null);
        return { active, group };
      },
      template: `
        <TimerTaskGroup :group="group('task-a')" :is-live="false" :now="0" time-zone="UTC" editor-key="a" :active-editor-key="active" @editing-started="active = 'a'" />
        <TimerTaskGroup :group="group('task-b')" :is-live="false" :now="0" time-zone="UTC" editor-key="b" :active-editor-key="active" @editing-started="active = 'b'" />
      `,
    };
    const wrapper = await mountSuspended(Host, { global: { plugins: [testI18n()], stubs } });
    const firstHeader = wrapper.findAll('[data-testid="timer-group-header-controls"]')[0]!;
    expect(firstHeader.findAll('button').length).toBeGreaterThanOrEqual(1);
    expect(firstHeader.find('[data-testid="timer-group-title-task-a"]').exists()).toBe(true);
    expect(firstHeader.find('[data-testid="timer-group-project-task-a"]').exists()).toBe(true);
    expect(firstHeader.find('button button').exists()).toBe(false);

    await wrapper.find('[data-testid="timer-group-title-task-a"]').trigger('click');
    await flushPromises();
    await wrapper.find('[data-testid="timer-group-project-task-b"]').trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-testid="timer-group-title-input-task-a"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="timer-group-project-select-task-b"]').exists()).toBe(true);

    await wrapper.find('[data-testid="timer-group-project-task-a"]').trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-testid="timer-group-project-select-task-a"]').exists()).toBe(true);
    await wrapper.find('[data-testid="timer-group-project-task-b"]').trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-testid="timer-group-project-select-task-a"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="timer-group-project-select-task-b"]').exists()).toBe(true);
  });

  it('shows a disabled remote-issue icon when there is no active tracker', async () => {
    const wrapper = await mount({ tracker: null });
    const disabled = wrapper.find('[data-testid="timer-group-remote-issue-disabled-task-1"]');
    expect(disabled.exists()).toBe(true);
    expect(disabled.classes()).toContain('w-6');
    expect(disabled.classes()).toContain('text-dimmed');
    expect(disabled.attributes('disabled')).toBeDefined();
    expect(disabled.attributes('aria-label')).toBe('timerView.remoteIssue.unavailableNoTracker');
    expect(disabled.attributes('title')).toBeUndefined();
    expect(disabled.element.closest('[data-tooltip-text]')?.getAttribute('data-tooltip-text')).toBe(
      'timerView.remoteIssue.unavailableNoTracker',
    );
    expect(wrapper.find('[data-testid="timer-group-remote-issue-picker-task-1"]').exists()).toBe(
      false,
    );
  });

  it('shows a disabled remote-issue icon when the task has no project', async () => {
    const wrapper = await mount({
      tracker: null,
      group: { ...group(), projectId: null, projectName: null },
    });
    const disabled = wrapper.find('[data-testid="timer-group-remote-issue-disabled-task-1"]');
    expect(disabled.exists()).toBe(true);
    expect(disabled.attributes('aria-label')).toBe('timerView.remoteIssue.unavailableNoProject');
  });

  it('shows an unlinked status and an enabled picker when an OpenProject tracker exists but no reference', async () => {
    const wrapper = await mount({ tracker: openProjectTracker });
    const unlinked = wrapper.find('[data-testid="timer-group-remote-issue-unlinked-task-1"]');
    expect(unlinked.exists()).toBe(true);
    expect(unlinked.attributes('aria-label')).toBe('timerView.remoteIssue.unlinked');
    expect(unlinked.text()).not.toContain('timerView.remoteIssue.unlinked');
    expect(wrapper.find('[data-testid="timer-group-remote-issue-picker-task-1"]').exists()).toBe(
      true,
    );
  });

  it('renders a linked anchor with the reference URL and a tooltip', async () => {
    const wrapper = await mount({
      tracker: openProjectTracker,
      group: {
        ...group(),
        remoteIssueRef: {
          id: 'ref-1',
          taskId: 'task-1',
          userId: 'user-1',
          trackerId: 'tracker-1',
          remoteIssueId: '42',
          cachedTitle: 'Fix login bug',
          url: 'https://op.example.com/work_packages/42',
          createdAt: '',
          updatedAt: '',
        },
      },
    });
    const link = wrapper.find('[data-testid="timer-group-remote-issue-link-task-1"]');
    expect(link.attributes('href')).toBe('https://op.example.com/work_packages/42');
    expect(link.attributes('target')).toBe('_blank');
    expect(link.attributes('title')).toBeUndefined();
  });

  it('shows an enabled picker for a Redmine tracker', async () => {
    const wrapper = await mount({ tracker: redmineTracker });
    expect(
      wrapper
        .find('[data-testid="timer-group-remote-issue-unlinked-task-1"]')
        .attributes('aria-label'),
    ).toBe('timerView.remoteIssue.unlinked');
    expect(wrapper.find('[data-testid="timer-group-remote-issue-picker-task-1"]').exists()).toBe(
      true,
    );
    expect(wrapper.find('[data-testid="timer-group-remote-issue-disabled-task-1"]').exists()).toBe(
      false,
    );
  });

  it('link, replace and unlink send the day entry ids to reassign and never call a task-global route', async () => {
    csrfFetchMock.mockResolvedValue([]);
    const wrapper = await mount({ tracker: openProjectTracker });
    expect(wrapper.find('[data-testid="timer-group-remote-issue-picker-task-1"]').exists()).toBe(
      true,
    );

    await wrapper.find('[data-testid="stub-link"]').trigger('click');
    await flushPromises();

    expect(csrfFetchMock).toHaveBeenCalledWith('/api/time-entries/reassign', {
      method: 'POST',
      body: {
        ids: ['entry-1'],
        remoteIssueId: '42',
        cachedTitle: 'Fix',
      },
    });
    expect(
      csrfFetchMock.mock.calls.some((call) => String(call[0]).includes('/remote-issue-ref')),
    ).toBe(false);
    expect(wrapper.emitted('entry-changed')).toHaveLength(1);

    csrfFetchMock.mockClear();
    await wrapper.find('[data-testid="stub-unlink"]').trigger('click');
    await flushPromises();
    expect(csrfFetchMock).toHaveBeenCalledWith('/api/time-entries/reassign', {
      method: 'POST',
      body: { ids: ['entry-1'], remoteIssueId: null },
    });
    expect(
      csrfFetchMock.mock.calls.some((call) => String(call[0]).includes('/remote-issue-ref')),
    ).toBe(false);
    expect(wrapper.emitted('entry-changed')?.length).toBeGreaterThanOrEqual(2);
  });

  it('indicates a live group with a stop control instead of a live phrase', async () => {
    const wrapper = await mount({ isLive: true });
    expect(wrapper.find('[data-testid="timer-group-live-task-1"]').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('timerView.liveLabel');
    const action = wrapper.find('[data-testid="timer-group-continue-task-1"]');
    expect(action.attributes('aria-pressed')).toBe('true');
    expect(action.attributes('aria-label')).toBe('timer.stop');
    expect(action.element.closest('[data-tooltip-text]')?.getAttribute('data-tooltip-text')).toBe(
      'timer.stop',
    );
    expect(action.attributes('data-icon')).toBe('i-lucide-square');
    expect(action.attributes('data-ui-leading') ?? '').toMatch(/timer-stop-icon/);
    await action.trigger('click');
    expect(wrapper.emitted('continue')).toBeUndefined();
    expect(wrapper.emitted('stop')).toHaveLength(1);
  });

  it('lets an untitled group edit its title and continue like a named group', async () => {
    csrfFetchMock.mockResolvedValue({});
    const wrapper = await mount({
      group: {
        key: 'untitled',
        taskId: null,
        taskName: null,
        projectId: null,
        projectName: null,
        totalSeconds: 3600,
        entries: [
          {
            id: 'entry-u',
            taskId: null,
            taskName: null,
            projectId: null,
            projectName: null,
            startedAt: '2024-03-15T09:00:00.000Z',
            stoppedAt: '2024-03-15T10:00:00.000Z',
          },
        ],
      },
    });
    expect(wrapper.find('[data-testid="timer-group-bulk-assign-untitled"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="timer-group-continue-untitled"]').exists()).toBe(true);
    const project = wrapper.find('[data-testid="timer-group-project-untitled"]');
    expect(project.exists()).toBe(true);
    expect(project.attributes('disabled')).toBeDefined();
    expect(project.attributes('title')).toBeUndefined();
    expect(project.element.closest('[data-tooltip-text]')?.getAttribute('data-tooltip-text')).toBe(
      'timerView.projectRequiresTitle',
    );
    await project.trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-testid="timer-group-project-select-untitled"]').exists()).toBe(
      false,
    );

    await wrapper.find('[data-testid="timer-group-title-untitled"]').trigger('click');
    await flushPromises();
    const input = wrapper.find('[data-testid="timer-group-title-input-untitled"]');
    await input.setValue('Named from untitled');
    await input.trigger('blur');
    await flushPromises();
    expect(csrfFetchMock).toHaveBeenCalledWith('/api/time-entries/reassign', {
      method: 'POST',
      body: { ids: ['entry-u'], name: 'Named from untitled' },
    });
  });

  it('truncates long titles with a tooltip and shows a numeric count badge', async () => {
    const longName = 'Implement a very long consultant task name that must not overflow';
    const wrapper = await mount({
      group: {
        ...group(),
        taskName: longName,
        entries: [
          {
            id: 'entry-1',
            taskId: 'task-1',
            taskName: longName,
            projectId: 'project-gone',
            projectName: 'Archived project',
            startedAt: '2024-03-15T09:00:00.000Z',
            stoppedAt: '2024-03-15T10:00:00.000Z',
          },
          {
            id: 'entry-2',
            taskId: 'task-1',
            taskName: longName,
            projectId: 'project-gone',
            projectName: 'Archived project',
            startedAt: '2024-03-15T11:00:00.000Z',
            stoppedAt: '2024-03-15T12:00:00.000Z',
          },
        ],
      },
    });

    const title = wrapper.find('[data-testid="timer-group-title-task-1"]');
    expect(title.attributes('style') ?? '').not.toMatch(/\d+ch/);
    expect(title.element.closest('[data-tooltip-text]')?.getAttribute('data-tooltip-text')).toBe(
      longName,
    );
    expect(wrapper.find('[data-overflow-tooltip]').exists()).toBe(true);

    const count = wrapper.find('[data-testid="timer-group-count-task-1"]');
    expect(count.text()).toBe('2');
    expect(count.text()).not.toContain('timerView.entryCount');
    expect(count.attributes('aria-label')).toBe('timerView.entryCount');

    await title.trigger('click');
    await flushPromises();
    const input = wrapper.find<HTMLInputElement>('[data-testid="timer-group-title-input-task-1"]');
    expect(input.exists()).toBe(true);
    expect(input.attributes('style') ?? '').not.toMatch(/\d+ch/);
    expect(input.element.value).toBe(longName);
  });

  it('caps the entry-count badge at 9+', async () => {
    const entries = Array.from({ length: 10 }, (_, index) => ({
      id: `entry-${index + 1}`,
      taskId: 'task-1',
      taskName: 'Build feature',
      projectId: 'project-gone',
      projectName: 'Archived project',
      startedAt: '2024-03-15T09:00:00.000Z',
      stoppedAt: '2024-03-15T10:00:00.000Z',
    }));
    const wrapper = await mount({ group: { ...group(), entries } });
    const count = wrapper.find('[data-testid="timer-group-count-task-1"]');
    expect(count.text()).toBe('9+');
    expect(count.attributes('aria-label')).toBe('timerView.entryCount');
  });

  it('does not enable a title tooltip when the name fits the slot', async () => {
    const wrapper = await mount({
      group: { ...group(), taskName: 'Short' },
    });
    expect(wrapper.find('[data-overflow-tooltip]').attributes('data-overflow-tooltip')).toBe('off');
  });
});
