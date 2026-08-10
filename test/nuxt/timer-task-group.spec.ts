import { describe, expect, it, vi, beforeEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime';
import { createI18n } from 'vue-i18n';
import TimerTaskGroup from '../../app/components/TimerTaskGroup.vue';

const csrfFetchMock = vi.hoisted(() => vi.fn());
const toastErrorMock = vi.hoisted(() => vi.fn());

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
      :title="title"
      :aria-label="ariaLabel || $attrs['aria-label']"
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
    'to',
    'target',
    'title',
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
const SelectStub = {
  template: `
    <select v-bind="$attrs" :value="modelValue ?? ''" @change="$emit('update:modelValue', $event.target.value || null)">
      <option value="">(no project)</option>
      <option v-for="option in items" :key="option.id" :value="option.id">{{ option.name }}</option>
    </select>
  `,
  props: ['modelValue', 'items', 'labelKey', 'valueKey'],
  emits: ['update:modelValue'],
};

const stubs = {
  UButton: ButtonStub,
  UInput: InputStub,
  USelect: SelectStub,
  TimerEntryRow: true,
  RemoteIssuePicker: {
    props: ['config', 'currentRef'],
    emits: ['link', 'unlink'],
    template: `
      <div v-bind="$attrs" data-remote-issue-picker="1">
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

function mount(props: Record<string, unknown> = {}) {
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (useNuxtApp() as any).$csrfFetch = csrfFetchMock;
    } catch {
      // ignore
    }
  });

  it('commits a renamed title, while empty names silently revert and Escape cancels', async () => {
    csrfFetchMock.mockResolvedValue({});
    const wrapper = await mount();
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
          createdAt: '',
        },
      ],
    });
    const projectButton = wrapper.find('[data-testid="timer-group-project-task-1"]');
    expect(projectButton.attributes('aria-label')).toBe('timerView.editor.projectLabel');
    await projectButton.trigger('click');
    await flushPromises();

    const select = wrapper.find('[data-testid="timer-group-project-select-task-1"]');
    expect(select.element.tagName).toBe('SELECT');
    expect(select.text()).toContain('Archived project');
    await select.setValue('project-2');
    await flushPromises();

    expect(csrfFetchMock).toHaveBeenLastCalledWith('/api/time-entries/reassign', {
      method: 'POST',
      body: { ids: ['entry-1'], projectId: 'project-2' },
    });

    await wrapper.find('[data-testid="timer-group-project-task-1"]').trigger('click');
    await flushPromises();
    await wrapper.find('[data-testid="timer-group-project-select-task-1"]').setValue('');
    await flushPromises();
    expect(csrfFetchMock).toHaveBeenLastCalledWith('/api/time-entries/reassign', {
      method: 'POST',
      body: { ids: ['entry-1'], projectId: null },
    });

    const noProject = await mount({
      group: { ...group(), projectId: null, projectName: null, trackerName: null },
    });
    expect(
      (noProject.find('[data-testid="timer-group-project-task-1"]').element as HTMLInputElement)
        .value,
    ).toBe('timerView.noProject');
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
  });

  it('omits the remote-issue control entirely when there is no active tracker', async () => {
    const wrapper = await mount({ tracker: null });
    expect(wrapper.find('[data-testid="timer-group-remote-issue-unlinked-task-1"]').exists()).toBe(
      false,
    );
    expect(wrapper.find('[data-testid="timer-group-remote-issue-picker-task-1"]').exists()).toBe(
      false,
    );
  });

  it('shows an unlinked status and an enabled picker when an OpenProject tracker exists but no reference', async () => {
    const wrapper = await mount({ tracker: openProjectTracker });
    expect(wrapper.find('[data-testid="timer-group-remote-issue-unlinked-task-1"]').text()).toBe(
      'timerView.remoteIssue.unlinked',
    );
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
    expect(link.attributes('title')).toContain('Fix login bug');
  });

  it('shows an enabled picker for a Redmine tracker', async () => {
    const wrapper = await mount({ tracker: redmineTracker });
    expect(wrapper.find('[data-testid="timer-group-remote-issue-unlinked-task-1"]').text()).toBe(
      'timerView.remoteIssue.unlinked',
    );
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
      csrfFetchMock.mock.calls.some(
        (call) => typeof call[0] === 'string' && call[0].includes('/remote-issue-ref'),
      ),
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
      csrfFetchMock.mock.calls.some(
        (call) => typeof call[0] === 'string' && call[0].includes('/remote-issue-ref'),
      ),
    ).toBe(false);
    expect(wrapper.emitted('entry-changed')?.length).toBeGreaterThanOrEqual(2);
  });
});
