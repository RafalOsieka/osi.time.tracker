import { describe, expect, it, vi, beforeEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { mountSuspended } from '@nuxt/test-utils/runtime';
import { createI18n } from 'vue-i18n';
import TimerTaskGroup from '../../app/components/TimerTaskGroup.vue';

const csrfFetchMock = vi.fn();
const selectShowMock = vi.fn();
const selectHideMock = vi.fn();

vi.mock('ofetch', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ofetch')>();
  return { ...actual, $fetch: Object.assign(csrfFetchMock, { create: () => csrfFetchMock }) };
});
vi.mock('primevue/usetoast', () => ({ useToast: () => ({ add: vi.fn() }) }));

const ButtonStub = {
  template:
    '<button v-bind="$attrs" :aria-label="ariaLabel" @click="$emit(\'click\', $event)">{{ label }}</button>',
  props: ['label', 'ariaLabel', 'icon', 'text', 'rounded'],
  emits: ['click'],
};
const InputTextStub = {
  template:
    '<input v-bind="$attrs" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
  props: ['modelValue'],
  emits: ['update:modelValue'],
};
const SelectStub = {
  template: `
    <select v-bind="$attrs" :value="modelValue" @change="$emit('update:modelValue', $event.target.value || null)">
      <option value="">(no project)</option>
      <option v-for="option in options" :key="option.id" :value="option.id">{{ option.name }}</option>
    </select>
  `,
  props: ['modelValue', 'options', 'optionLabel', 'optionValue', 'showClear', 'ariaLabel'],
  emits: ['update:modelValue'],
  methods: { show: selectShowMock, hide: selectHideMock },
};

const stubs = {
  Button: ButtonStub,
  InputText: InputTextStub,
  Select: SelectStub,
  TimerEntryRow: true,
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

function group(key = 'task-1') {
  return {
    key,
    taskId: 'task-1',
    taskName: 'Build feature',
    projectId: 'project-gone',
    projectName: 'Archived project',
    clientName: 'Acme',
    date: '2024-03-15',
    totalSeconds: 3600,
    entries: [],
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
    selectShowMock.mockReset();
    selectHideMock.mockReset();
  });

  it('commits a renamed title, while empty names silently revert and Escape cancels', async () => {
    csrfFetchMock.mockResolvedValue({});
    const wrapper = await mount();
    await wrapper.find('[data-testid="timer-group-title-task-1"]').trigger('click');
    const title = wrapper.find('[data-testid="timer-group-title-input-task-1"]');
    await title.setValue('  Ship feature  ');
    await title.trigger('blur');

    expect(csrfFetchMock).toHaveBeenCalledWith('/api/tasks/task-1', {
      method: 'PATCH',
      body: { name: 'Ship feature' },
    });
    expect(wrapper.emitted('entry-changed')).toHaveLength(1);

    await wrapper.find('[data-testid="timer-group-title-task-1"]').trigger('click');
    await wrapper.find('[data-testid="timer-group-title-input-task-1"]').setValue('   ');
    await wrapper.find('[data-testid="timer-group-title-input-task-1"]').trigger('blur');
    expect(csrfFetchMock).toHaveBeenCalledTimes(1);

    await wrapper.find('[data-testid="timer-group-title-task-1"]').trigger('click');
    await wrapper.find('[data-testid="timer-group-title-input-task-1"]').trigger('keydown.esc');
    expect(wrapper.find('[data-testid="timer-group-title-input-task-1"]').exists()).toBe(false);
  });

  it('opens the project select on one click, retains its deleted project, and commits changes or clearing', async () => {
    csrfFetchMock.mockResolvedValue({});
    const wrapper = await mount({
      projectOptions: [
        {
          id: 'project-2',
          name: 'Current project',
          clientId: 'c',
          clientName: 'Acme',
          createdAt: '',
        },
      ],
    });
    const projectButton = wrapper.find('[data-testid="timer-group-project-task-1"]');
    expect(projectButton.attributes('aria-label')).toBe('timerView.editor.projectLabel');
    await projectButton.trigger('click');
    await flushPromises();

    expect(selectShowMock).toHaveBeenCalledTimes(1);
    const select = wrapper.find('[data-testid="timer-group-project-select-task-1"]');
    expect(select.element.tagName).toBe('SELECT');
    expect(select.text()).toContain('Archived project');
    await select.setValue('project-2');

    expect(csrfFetchMock).toHaveBeenLastCalledWith('/api/tasks/task-1', {
      method: 'PATCH',
      body: { name: 'Build feature', projectId: 'project-2' },
    });

    await wrapper.find('[data-testid="timer-group-project-task-1"]').trigger('click');
    await wrapper.find('[data-testid="timer-group-project-select-task-1"]').setValue('');
    expect(csrfFetchMock).toHaveBeenLastCalledWith('/api/tasks/task-1', {
      method: 'PATCH',
      body: { name: 'Build feature', projectId: null },
    });

    const noProject = await mount({
      group: { ...group(), projectId: null, projectName: null, clientName: null },
    });
    expect(noProject.find('[data-testid="timer-group-project-task-1"]').text()).toBe(
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
        <TimerTaskGroup :group="group('task-a')" :is-live="false" :now="0" editor-key="a" :active-editor-key="active" @editing-started="active = 'a'" />
        <TimerTaskGroup :group="group('task-b')" :is-live="false" :now="0" editor-key="b" :active-editor-key="active" @editing-started="active = 'b'" />
      `,
    };
    const wrapper = await mountSuspended(Host, { global: { plugins: [testI18n()], stubs } });
    const firstHeader = wrapper.findAll('.timer-group__toggle')[0]!;
    expect(firstHeader.findAll('button')).toHaveLength(3);
    expect(firstHeader.find('button button').exists()).toBe(false);

    await wrapper.find('[data-testid="timer-group-title-task-a"]').trigger('click');
    await wrapper.find('[data-testid="timer-group-project-task-b"]').trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-testid="timer-group-title-input-task-a"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="timer-group-project-select-task-b"]').exists()).toBe(true);
  });
});
