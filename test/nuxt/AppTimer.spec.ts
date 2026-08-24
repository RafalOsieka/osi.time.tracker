import { describe, expect, it, vi, beforeEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime';
import AppTimer from '../../app/components/AppTimer.vue';

const {
  fetchMock,
  runningState,
  elapsedSecondsState,
  loadingState,
  startMock,
  stopMock,
  updateTitleMock,
  updateStartedAtMock,
} = vi.hoisted(() => ({
  fetchMock: vi.fn(),
  runningState: { value: null as unknown },
  elapsedSecondsState: { value: 0 },
  loadingState: { value: false },
  startMock: vi.fn(),
  stopMock: vi.fn(),
  updateTitleMock: vi.fn(),
  updateStartedAtMock: vi.fn(),
}));

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>();
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key }),
  };
});

mockNuxtImport('$fetch', () => fetchMock);

mockNuxtImport('useTimer', () => () => ({
  running: runningState,
  elapsedSeconds: elapsedSecondsState,
  loading: loadingState,
  fetchRunning: vi.fn(),
  start: startMock,
  stop: stopMock,
  updateTitle: updateTitleMock,
  updateStartedAt: updateStartedAtMock,
}));

mockNuxtImport('useUserSettings', () => () => ({
  effective: { value: { timeZone: 'UTC' } },
}));

const InputMenuStub = {
  inheritAttrs: false,
  template: `
    <div class="input-menu-stub">
      <input
        v-bind="$attrs"
        :aria-label="$attrs['aria-label']"
        :placeholder="placeholder"
        :disabled="disabled"
        :value="modelValue"
        @input="$emit('update:modelValue', $event.target.value); $emit('update:searchTerm', $event.target.value)"
        @blur="$emit('blur')"
        @keydown.enter="$emit('keydown', $event)"
      />
      <button
        v-for="item in createItems"
        :key="item.id"
        type="button"
        data-testid="timer-create-item"
        @click="item.onSelect?.(); $emit('update:modelValue', item.name)"
      >
        {{ item.label }}
      </button>
    </div>
  `,
  props: ['modelValue', 'searchTerm', 'items', 'disabled', 'placeholder', 'mode', 'open'],
  emits: ['update:modelValue', 'update:searchTerm', 'update:open', 'blur', 'keydown'],
  computed: {
    createItems(this: {
      items?: Array<{ id?: string; name?: string; label?: string; onSelect?: () => void }>;
    }): Array<{ id: string; name: string; label: string; onSelect?: () => void }> {
      const list = Array.isArray(this.items) ? this.items : [];
      return list
        .filter(
          (item) =>
            item?.id === '__create_new_task__' ||
            (typeof item?.label === 'string' && /new task/i.test(item.label)),
        )
        .map((item) => ({
          id: item.id ?? '',
          name: item.name ?? '',
          label: item.label ?? '',
          onSelect: item.onSelect,
        }));
    },
  },
};
const ButtonStub = {
  template:
    '<button :data-testid="$attrs[\'data-testid\'] ?? \'timer-toggle-button\'" :aria-label="$attrs[\'aria-label\']" :aria-pressed="ariaPressed" :disabled="disabled" :data-icon="icon" :data-ui-leading="ui?.leadingIcon" :class="$attrs.class" @click="$emit(\'click\')">{{ label }}</button>',
  props: [
    'label',
    'square',
    'loading',
    'ariaPressed',
    'disabled',
    'icon',
    'variant',
    'color',
    'ui',
  ],
  emits: ['click'],
};
const PopoverStub = {
  props: {
    open: { type: Boolean, default: false },
  },
  emits: ['update:open'],
  template:
    '<div><slot /><div v-if="open" data-testid="timer-start-editor-popover-host"><slot name="content" /></div></div>',
};
const InputStub = {
  template:
    '<input v-bind="$attrs" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" @blur="$emit(\'blur\')" @change="$emit(\'change\')" @keydown="$emit(\'keydown\', $event)" />',
  props: ['modelValue', 'type', 'inputmode'],
  emits: ['update:modelValue', 'blur', 'change', 'keydown'],
};

function localDateInputValue(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

function runningEntry(taskName: string | null = 'My Task') {
  return {
    id: 'entry-1',
    taskId: taskName ? 'task-1' : null,
    taskName,
    projectId: null,
    projectName: null,
    startedAt: new Date().toISOString(),
    stoppedAt: null,
  };
}

const TooltipStub = {
  props: ['text', 'content'],
  template: '<span v-bind="$attrs" :data-tooltip-text="text"><slot /></span>',
};

const baseStubs = {
  UInputMenu: InputMenuStub,
  UButton: ButtonStub,
  UPopover: PopoverStub,
  UInput: InputStub,
  UTooltip: TooltipStub,
};

describe('AppTimer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runningState.value = null;
    elapsedSecondsState.value = 0;
    loadingState.value = false;
    fetchMock.mockResolvedValue([]);
    vi.stubGlobal('$fetch', fetchMock);
  });

  it('renders the idle state with a play icon toggle', async () => {
    const wrapper = await mountSuspended(AppTimer, {
      global: { stubs: baseStubs },
    });

    expect(wrapper.find('[data-testid="app-timer"]').exists()).toBe(true);
    const toggle = wrapper.find('[data-testid="timer-toggle-button"]');
    expect(toggle.attributes('aria-label')).toBe('timer.start');
    expect(toggle.element.closest('[data-tooltip-text]')?.getAttribute('data-tooltip-text')).toBe(
      'timer.start',
    );
    expect(toggle.attributes('data-icon')).toBe('i-lucide-play');
    expect(toggle.attributes('aria-pressed')).not.toBe('true');
    expect(wrapper.find('[data-testid="timer-elapsed"]').text()).toBe('00:00:00');
  });

  it('renders the running state with a square icon toggle and elapsed time', async () => {
    runningState.value = runningEntry();
    elapsedSecondsState.value = 65;

    const wrapper = await mountSuspended(AppTimer, {
      global: { stubs: baseStubs },
    });

    const toggle = wrapper.find('[data-testid="timer-toggle-button"]');
    expect(toggle.attributes('aria-label')).toBe('timer.stop');
    expect(toggle.element.closest('[data-tooltip-text]')?.getAttribute('data-tooltip-text')).toBe(
      'timer.stop',
    );
    expect(toggle.attributes('data-icon')).toBe('i-lucide-square');
    expect(toggle.attributes('aria-pressed')).toBe('true');
    expect(toggle.attributes('data-ui-leading') ?? '').toMatch(/timer-stop-icon/);
    expect(wrapper.find('[data-testid="timer-elapsed"]').text()).toBe('00:01:05');
  });

  it('calls start() when the toggle button is clicked while idle', async () => {
    const wrapper = await mountSuspended(AppTimer, {
      global: { stubs: baseStubs },
    });

    await wrapper.find('[data-testid="timer-toggle-button"]').trigger('click');
    expect(startMock).toHaveBeenCalled();
  });

  it('starts with freeform search text when no task is selected', async () => {
    const wrapper = await mountSuspended(AppTimer, {
      global: { stubs: baseStubs },
    });

    // Autocomplete keeps typed text on searchTerm without committing model-value.
    await wrapper.findComponent(InputMenuStub).vm.$emit('update:searchTerm', 'Topbar Stop Task');
    await flushPromises();
    await wrapper.find('[data-testid="timer-toggle-button"]').trigger('click');

    expect(startMock).toHaveBeenCalledWith('Topbar Stop Task', undefined, null);
  });

  it('calls stop() when the toggle button is clicked while running', async () => {
    runningState.value = runningEntry();

    const wrapper = await mountSuspended(AppTimer, {
      global: { stubs: baseStubs },
    });

    await wrapper.find('[data-testid="timer-toggle-button"]').trigger('click');
    expect(stopMock).toHaveBeenCalled();
  });

  it('the title input has an accessible label', async () => {
    const wrapper = await mountSuspended(AppTimer, {
      global: { stubs: baseStubs },
    });

    const input = wrapper.find('[data-testid="timer-title-input"]');
    expect(input.attributes('aria-label')).toBe('timer.titleLabel');
  });

  it('shows the running title after start (not cleared to placeholder)', async () => {
    runningState.value = runningEntry('My Task');

    const wrapper = await mountSuspended(AppTimer, {
      global: { stubs: baseStubs },
    });

    const input = wrapper.find('[data-testid="timer-title-input"]');
    expect(input.attributes('value')).toBe('My Task');
  });

  it('shows the running title after reload/hydration from the server', async () => {
    runningState.value = runningEntry('Reloaded Task');

    const wrapper = await mountSuspended(AppTimer, {
      global: { stubs: baseStubs },
    });

    expect(wrapper.find('[data-testid="timer-title-input"]').attributes('value')).toBe(
      'Reloaded Task',
    );
  });

  it('shows a blank input for an untitled running entry (no placeholder, no "(no task)")', async () => {
    runningState.value = runningEntry(null);

    const wrapper = await mountSuspended(AppTimer, {
      global: { stubs: baseStubs },
    });

    const input = wrapper.find('[data-testid="timer-title-input"]');
    expect(input.attributes('value')).toBe('');
    expect(input.attributes('placeholder')).toBeUndefined();
  });

  it('disables the input and the toggle button while the running fetch is in flight', async () => {
    loadingState.value = true;

    const wrapper = await mountSuspended(AppTimer, {
      global: { stubs: baseStubs },
    });

    expect(wrapper.find('[data-testid="timer-title-input"]').attributes('disabled')).toBeDefined();
    expect(
      wrapper.find('[data-testid="timer-toggle-button"]').attributes('disabled'),
    ).toBeDefined();
  });

  it('starts the timer on Enter when the suggestion overlay is closed', async () => {
    const wrapper = await mountSuspended(AppTimer, {
      global: { stubs: baseStubs },
    });

    await wrapper.find('[data-testid="timer-title-input"]').trigger('keydown.enter');
    expect(startMock).toHaveBeenCalled();
  });

  it('does not start the timer on Enter when the suggestion overlay is open', async () => {
    const wrapper = await mountSuspended(AppTimer, {
      global: { stubs: baseStubs },
    });

    await wrapper.findComponent(InputMenuStub).vm.$emit('update:open', true);
    await flushPromises();
    await wrapper.find('[data-testid="timer-title-input"]').trigger('keydown.enter');
    expect(startMock).not.toHaveBeenCalled();
  });

  it('commits an edited running title via updateTitle on blur', async () => {
    runningState.value = runningEntry('My Task');

    const wrapper = await mountSuspended(AppTimer, {
      global: { stubs: baseStubs },
    });

    const input = wrapper.find('[data-testid="timer-title-input"]');
    await input.setValue('Renamed Task');
    await input.trigger('blur');

    expect(updateTitleMock).toHaveBeenCalledWith('Renamed Task', null);
  });

  it('commits an edited running title via updateTitle on Enter', async () => {
    runningState.value = runningEntry('My Task');

    const wrapper = await mountSuspended(AppTimer, {
      global: { stubs: baseStubs },
    });

    const input = wrapper.find('[data-testid="timer-title-input"]');
    await input.setValue('Renamed Task');
    await input.trigger('keydown.enter');

    expect(updateTitleMock).toHaveBeenCalledWith('Renamed Task', null);
    expect(stopMock).not.toHaveBeenCalled();
  });

  it('detaches the task when the running title is cleared to blank and committed', async () => {
    runningState.value = runningEntry('My Task');

    const wrapper = await mountSuspended(AppTimer, {
      global: { stubs: baseStubs },
    });

    const input = wrapper.find('[data-testid="timer-title-input"]');
    await input.setValue('');
    await input.trigger('blur');

    expect(updateTitleMock).toHaveBeenCalledWith('', null);
  });

  it('selecting a suggestion fires once, sends taskId, and never sets [object Object]', async () => {
    fetchMock.mockResolvedValue([
      {
        id: 'task-42',
        name: 'Linked Task',
        projectId: 'project-1',
        projectName: 'Project One',
        createdAt: '',
        remoteIssueRef: {
          id: 'ref-1',
          taskId: 'task-42',
          userId: 'user-1',
          trackerId: 'cfg-1',
          remoteIssueId: '99',
          cachedTitle: 'Linked Task',
          createdAt: '',
          updatedAt: '',
        },
      },
    ]);

    const wrapper = await mountSuspended(AppTimer, {
      global: { stubs: baseStubs },
    });

    // Trigger suggestion fetch via search-term, then simulate the real
    // select sequence: item onSelect (stash id) + model update (name string).
    await wrapper.findComponent(InputMenuStub).vm.$emit('update:searchTerm', 'Linked');
    await flushPromises();

    const items = wrapper.findComponent(InputMenuStub).props('items') as Array<{
      id: string;
      name: string;
      label: string;
      onSelect: () => void;
    }>;
    const suggestion = items.find((item) => item.id === 'task-42');
    expect(suggestion).toBeTruthy();
    expect(suggestion!.label).toContain('Linked Task');
    expect(suggestion!.label).toContain('#99');
    expect(items.some((item) => item.id === '__create_new_task__')).toBe(true);
    suggestion!.onSelect();
    await wrapper.findComponent(InputMenuStub).vm.$emit('update:modelValue', 'Linked Task');
    await flushPromises();

    expect(startMock).not.toHaveBeenCalled();
    expect(updateTitleMock).not.toHaveBeenCalled();
    expect(wrapper.find('[data-testid="timer-title-input"]').attributes('value')).toBe(
      'Linked Task',
    );
    expect(wrapper.text()).not.toContain('[object Object]');
    expect(suggestion!.label).not.toContain('[object Object]');

    await wrapper.find('[data-testid="timer-toggle-button"]').trigger('click');
    await flushPromises();

    expect(startMock).toHaveBeenCalledTimes(1);
    expect(startMock).toHaveBeenCalledWith('Linked Task', undefined, 'task-42');
  });

  it('selecting a suggestion while running patches with taskId exactly once', async () => {
    runningState.value = runningEntry('My Task');
    fetchMock.mockResolvedValue([
      {
        id: 'task-99',
        name: 'Other Task',
        projectId: null,
        projectName: null,
        createdAt: '',
      },
    ]);

    const wrapper = await mountSuspended(AppTimer, {
      global: { stubs: baseStubs },
    });

    await wrapper.findComponent(InputMenuStub).vm.$emit('update:searchTerm', 'Other');
    await flushPromises();

    const items = wrapper.findComponent(InputMenuStub).props('items') as Array<{
      id: string;
      name: string;
      onSelect: () => void;
    }>;
    const suggestion = items.find((item) => item.id === 'task-99');
    expect(suggestion).toBeTruthy();
    suggestion!.onSelect();
    await wrapper.findComponent(InputMenuStub).vm.$emit('update:modelValue', 'Other Task');
    await flushPromises();

    expect(updateTitleMock).toHaveBeenCalledTimes(1);
    expect(updateTitleMock).toHaveBeenCalledWith('Other Task', 'task-99');
    expect(wrapper.find('[data-testid="timer-title-input"]').attributes('value')).toBe(
      'Other Task',
    );
    expect(wrapper.text()).not.toContain('[object Object]');
  });

  it('offers a create-new-task option alongside an exact match', async () => {
    fetchMock.mockResolvedValue([
      {
        id: 'task-exact',
        name: 'Exact Match',
        projectId: 'project-1',
        projectName: 'Project One',
        createdAt: '',
      },
    ]);

    const wrapper = await mountSuspended(AppTimer, {
      global: { stubs: baseStubs },
    });

    await wrapper.findComponent(InputMenuStub).vm.$emit('update:searchTerm', 'Exact Match');
    await flushPromises();

    const items = wrapper.findComponent(InputMenuStub).props('items') as Array<{
      id: string;
      name: string;
      label: string;
    }>;
    expect(items.some((item) => item.id === 'task-exact')).toBe(true);
    const createItem = items.find((item) => item.id === '__create_new_task__');
    expect(createItem).toBeTruthy();
    expect(items[0]?.id).toBe('__create_new_task__');
    expect(createItem!.name).toBe('Exact Match');
    // Label is i18n-backed (`{title} (new task)`); accept translated or key fallback.
    expect(
      /new task/i.test(createItem!.label) ||
        createItem!.label.includes('Exact Match') ||
        createItem!.label === 'timer.createOption',
    ).toBe(true);
    expect(wrapper.find('[data-testid="timer-create-item"]').exists()).toBe(true);
  });

  it('does not offer a create option for empty text', async () => {
    const wrapper = await mountSuspended(AppTimer, {
      global: { stubs: baseStubs },
    });

    await wrapper.findComponent(InputMenuStub).vm.$emit('update:searchTerm', '');
    await flushPromises();
    expect(wrapper.find('[data-testid="timer-create-item"]').exists()).toBe(false);
    let items = wrapper.findComponent(InputMenuStub).props('items') as Array<{ id: string }>;
    expect(items.some((item) => item.id === '__create_new_task__')).toBe(false);

    await wrapper.findComponent(InputMenuStub).vm.$emit('update:searchTerm', '   ');
    await flushPromises();
    expect(wrapper.find('[data-testid="timer-create-item"]').exists()).toBe(false);
    items = wrapper.findComponent(InputMenuStub).props('items') as Array<{ id: string }>;
    expect(items.some((item) => item.id === '__create_new_task__')).toBe(false);
  });

  it('create option clears a previously selected taskId and closes the overlay', async () => {
    fetchMock.mockResolvedValue([
      {
        id: 'task-42',
        name: 'Linked Task',
        projectId: 'project-1',
        projectName: 'Project One',
        createdAt: '',
      },
    ]);

    const wrapper = await mountSuspended(AppTimer, {
      global: { stubs: baseStubs },
    });

    await wrapper.findComponent(InputMenuStub).vm.$emit('update:searchTerm', 'Linked');
    await flushPromises();
    const items = wrapper.findComponent(InputMenuStub).props('items') as Array<{
      id: string;
      onSelect: () => void;
    }>;
    items.find((item) => item.id === 'task-42')!.onSelect();
    await wrapper.findComponent(InputMenuStub).vm.$emit('update:modelValue', 'Linked Task');
    await wrapper.findComponent(InputMenuStub).vm.$emit('update:open', true);
    await flushPromises();

    await wrapper.findComponent(InputMenuStub).vm.$emit('update:searchTerm', 'Linked Task');
    await flushPromises();
    const createItem = (
      wrapper.findComponent(InputMenuStub).props('items') as Array<{
        id: string;
        onSelect: () => void;
      }>
    ).find((item) => item.id === '__create_new_task__');
    expect(createItem).toBeTruthy();
    createItem!.onSelect();
    await wrapper.findComponent(InputMenuStub).vm.$emit('update:modelValue', 'Linked Task');
    await flushPromises();

    expect(wrapper.findComponent(InputMenuStub).props('open')).toBe(false);

    await wrapper.find('[data-testid="timer-toggle-button"]').trigger('click');
    await flushPromises();
    expect(startMock).toHaveBeenCalledWith('Linked Task', undefined, null);
  });

  describe('start-time editor popover', () => {
    function mount() {
      return mountSuspended(AppTimer, {
        global: {
          stubs: baseStubs,
        },
      });
    }

    it('makes the elapsed display an activatable trigger with an accessible label', async () => {
      runningState.value = runningEntry();
      const wrapper = await mount();

      const trigger = wrapper.find('[data-testid="timer-elapsed"]');
      expect(trigger.element.tagName).toBe('BUTTON');
      expect(trigger.attributes('aria-label')).toBe('timer.editStartLabel');
    });

    it("seeds the date/time fields with the running entry's local start when opened", async () => {
      const startedAt = new Date('2024-01-05T10:30:00.000Z');
      runningState.value = { ...runningEntry(), startedAt: startedAt.toISOString() };
      const wrapper = await mount();

      await wrapper.find('[data-testid="timer-elapsed"]').trigger('click');
      await flushPromises();

      const dateInput = wrapper.find('[data-testid="timer-start-editor-date-input"]');
      const timeInput = wrapper.find<HTMLInputElement>(
        '[data-testid="timer-start-editor-time-input"]',
      );
      expect(dateInput.attributes('value') ?? (dateInput.element as HTMLInputElement).value).toBe(
        '2024-01-05',
      );
      expect(timeInput.element.value).toBe('10:30');
    });

    it('blocks a future start with an inline error and does not call updateStartedAt', async () => {
      runningState.value = runningEntry();
      const wrapper = await mount();

      await wrapper.find('[data-testid="timer-elapsed"]').trigger('click');
      await flushPromises();

      const future = new Date(Date.now() + 60 * 60 * 1000);
      await wrapper
        .find('[data-testid="timer-start-editor-date-input"]')
        .setValue(localDateInputValue(future));
      await wrapper.find('[data-testid="timer-start-editor-date-input"]').trigger('blur');
      await wrapper
        .find('[data-testid="timer-start-editor-time-input"]')
        .setValue(
          `${String(future.getHours()).padStart(2, '0')}:${String(future.getMinutes()).padStart(2, '0')}`,
        );
      await wrapper.find('[data-testid="timer-start-editor-time-input"]').trigger('blur');
      await wrapper.find('[data-testid="timer-start-editor-save-button"]').trigger('click');
      await flushPromises();

      expect(updateStartedAtMock).not.toHaveBeenCalled();
      expect(wrapper.find('[data-testid="timer-start-editor-error"]').text()).toBe(
        'error.timeEntryStartedAtInFuture',
      );
    });

    it('commits a valid past start via updateStartedAt', async () => {
      runningState.value = runningEntry();
      const wrapper = await mount();

      await wrapper.find('[data-testid="timer-elapsed"]').trigger('click');
      await flushPromises();

      const past = new Date('2020-01-01T00:00:00.000Z');
      await wrapper
        .find('[data-testid="timer-start-editor-date-input"]')
        .setValue(localDateInputValue(past));
      await wrapper.find('[data-testid="timer-start-editor-date-input"]').trigger('blur');
      await wrapper
        .find('[data-testid="timer-start-editor-time-input"]')
        .setValue(
          `${String(past.getHours()).padStart(2, '0')}:${String(past.getMinutes()).padStart(2, '0')}`,
        );
      await wrapper.find('[data-testid="timer-start-editor-time-input"]').trigger('blur');
      await wrapper.find('[data-testid="timer-start-editor-save-button"]').trigger('click');
      await flushPromises();

      expect(updateStartedAtMock).toHaveBeenCalledTimes(1);
    });

    it('commits an unpadded typed date and compact typed time', async () => {
      runningState.value = runningEntry();
      const wrapper = await mount();

      await wrapper.find('[data-testid="timer-elapsed"]').trigger('click');
      await flushPromises();
      const dateInput = wrapper.find('[data-testid="timer-start-editor-date-input"]');
      await dateInput.setValue('2024-7-9');
      await dateInput.trigger('blur');
      const timeInput = wrapper.find<HTMLInputElement>(
        '[data-testid="timer-start-editor-time-input"]',
      );
      await timeInput.setValue('900');
      await timeInput.trigger('blur');
      await wrapper.find('[data-testid="timer-start-editor-save-button"]').trigger('click');
      await flushPromises();

      expect(updateStartedAtMock).toHaveBeenCalledWith('2024-07-09T09:00:00Z');
      expect(timeInput.element.value).toBe('09:00');
    });

    it('reverts garbage date text without sending an update', async () => {
      const startedAt = new Date('2024-01-05T10:30:00.000Z');
      runningState.value = { ...runningEntry(), startedAt: startedAt.toISOString() };
      const wrapper = await mount();

      await wrapper.find('[data-testid="timer-elapsed"]').trigger('click');
      await flushPromises();
      const dateInput = wrapper.find('[data-testid="timer-start-editor-date-input"]');
      const original =
        (dateInput.element as HTMLInputElement).value || dateInput.attributes('value');
      await dateInput.setValue('garbage');
      await dateInput.trigger('blur');
      await flushPromises();

      const after = (dateInput.element as HTMLInputElement).value || dateInput.attributes('value');
      expect(after).toBe(original);
      expect(updateStartedAtMock).not.toHaveBeenCalled();
    });
  });
});
