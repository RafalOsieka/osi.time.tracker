import { describe, expect, it, vi, beforeEach } from 'vitest';
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime';
import AppTimer from '../../app/components/AppTimer.vue';

const fetchMock = vi.fn();

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>();
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key }),
  };
});

const {
  runningState,
  elapsedSecondsState,
  loadingState,
  startMock,
  stopMock,
  updateTitleMock,
  updateStartedAtMock,
} = vi.hoisted(() => ({
  runningState: { value: null as unknown },
  elapsedSecondsState: { value: 0 },
  loadingState: { value: false },
  startMock: vi.fn(),
  stopMock: vi.fn(),
  updateTitleMock: vi.fn(),
  updateStartedAtMock: vi.fn(),
}));

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

const AutoCompleteStub = {
  template:
    '<input data-testid="timer-title-input" :aria-label="ariaLabel" :placeholder="placeholder" :disabled="disabled" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" @blur="$emit(\'blur\')" />',
  props: [
    'modelValue',
    'suggestions',
    'optionLabel',
    'disabled',
    'placeholder',
    'ariaLabel',
    'inputId',
  ],
  emits: ['update:modelValue', 'complete', 'item-select', 'blur', 'before-show', 'hide'],
};
const ButtonStub = {
  template:
    '<button :data-testid="$attrs[\'data-testid\'] ?? \'timer-toggle-button\'" :aria-pressed="ariaPressed" :disabled="disabled" @click="$emit(\'click\')">{{ label }}</button>',
  props: ['label', 'severity', 'loading', 'ariaPressed', 'disabled'],
  emits: ['click'],
};
const PopoverStub = {
  template: '<div data-testid="timer-start-editor-popover"><slot /></div>',
  methods: {
    toggle: vi.fn(),
    hide: vi.fn(),
    show: vi.fn(),
  },
};
const DatePickerStub = {
  template:
    '<input :data-testid="$attrs[\'data-testid\']" :value="modelValue" @input="$emit(\'update:modelValue\', new Date($event.target.value))" />',
  props: ['modelValue', 'inputId', 'dateFormat', 'showIcon', 'timeOnly', 'hourFormat'],
  emits: ['update:modelValue'],
};

function runningEntry(taskName: string | null = 'My Task') {
  return {
    id: 'entry-1',
    taskId: taskName ? 'task-1' : null,
    taskName,
    projectId: null,
    projectName: null,
    clientName: null,
    startedAt: new Date().toISOString(),
    stoppedAt: null,
  };
}

describe('AppTimer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runningState.value = null;
    elapsedSecondsState.value = 0;
    loadingState.value = false;
    vi.stubGlobal('$fetch', fetchMock.mockResolvedValue([]));
  });

  it('renders the idle state with a Start button', async () => {
    const wrapper = await mountSuspended(AppTimer, {
      global: { stubs: { AutoComplete: AutoCompleteStub, Button: ButtonStub } },
    });

    expect(wrapper.find('[data-testid="app-timer"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="timer-toggle-button"]').text()).toBe('timer.start');
    expect(wrapper.find('[data-testid="timer-elapsed"]').text()).toBe('00:00:00');
  });

  it('renders the running state with a Stop button and elapsed time', async () => {
    runningState.value = runningEntry();
    elapsedSecondsState.value = 65;

    const wrapper = await mountSuspended(AppTimer, {
      global: { stubs: { AutoComplete: AutoCompleteStub, Button: ButtonStub } },
    });

    expect(wrapper.find('[data-testid="timer-toggle-button"]').text()).toBe('timer.stop');
    expect(wrapper.find('[data-testid="timer-elapsed"]').text()).toBe('00:01:05');
  });

  it('calls start() when the toggle button is clicked while idle', async () => {
    const wrapper = await mountSuspended(AppTimer, {
      global: { stubs: { AutoComplete: AutoCompleteStub, Button: ButtonStub } },
    });

    await wrapper.find('[data-testid="timer-toggle-button"]').trigger('click');
    expect(startMock).toHaveBeenCalled();
  });

  it('calls stop() when the toggle button is clicked while running', async () => {
    runningState.value = runningEntry();

    const wrapper = await mountSuspended(AppTimer, {
      global: { stubs: { AutoComplete: AutoCompleteStub, Button: ButtonStub } },
    });

    await wrapper.find('[data-testid="timer-toggle-button"]').trigger('click');
    expect(stopMock).toHaveBeenCalled();
  });

  it('the title input has an accessible label', async () => {
    const wrapper = await mountSuspended(AppTimer, {
      global: { stubs: { AutoComplete: AutoCompleteStub, Button: ButtonStub } },
    });

    const input = wrapper.find('[data-testid="timer-title-input"]');
    expect(input.attributes('aria-label')).toBe('timer.titleLabel');
  });

  it('shows the running title after start (not cleared to placeholder)', async () => {
    runningState.value = runningEntry('My Task');

    const wrapper = await mountSuspended(AppTimer, {
      global: { stubs: { AutoComplete: AutoCompleteStub, Button: ButtonStub } },
    });

    const input = wrapper.find('[data-testid="timer-title-input"]');
    expect(input.attributes('value')).toBe('My Task');
  });

  it('shows the running title after reload/hydration from the server', async () => {
    runningState.value = runningEntry('Reloaded Task');

    const wrapper = await mountSuspended(AppTimer, {
      global: { stubs: { AutoComplete: AutoCompleteStub, Button: ButtonStub } },
    });

    expect(wrapper.find('[data-testid="timer-title-input"]').attributes('value')).toBe(
      'Reloaded Task',
    );
  });

  it('shows a blank input for an untitled running entry (no placeholder, no "(no task)")', async () => {
    runningState.value = runningEntry(null);

    const wrapper = await mountSuspended(AppTimer, {
      global: { stubs: { AutoComplete: AutoCompleteStub, Button: ButtonStub } },
    });

    const input = wrapper.find('[data-testid="timer-title-input"]');
    expect(input.attributes('value')).toBe('');
    expect(input.attributes('placeholder')).toBeUndefined();
  });

  it('disables the input and the toggle button while the running fetch is in flight', async () => {
    loadingState.value = true;

    const wrapper = await mountSuspended(AppTimer, {
      global: { stubs: { AutoComplete: AutoCompleteStub, Button: ButtonStub } },
    });

    expect(wrapper.find('[data-testid="timer-title-input"]').attributes('disabled')).toBeDefined();
    expect(
      wrapper.find('[data-testid="timer-toggle-button"]').attributes('disabled'),
    ).toBeDefined();
  });

  it('starts the timer on Enter when the suggestion overlay is closed', async () => {
    const wrapper = await mountSuspended(AppTimer, {
      global: { stubs: { AutoComplete: AutoCompleteStub, Button: ButtonStub } },
    });

    await wrapper.find('[data-testid="timer-title-input"]').trigger('keydown.enter');
    expect(startMock).toHaveBeenCalled();
  });

  it('does not start the timer on Enter when the suggestion overlay is open', async () => {
    const wrapper = await mountSuspended(AppTimer, {
      global: { stubs: { AutoComplete: AutoCompleteStub, Button: ButtonStub } },
    });

    await wrapper.findComponent(AutoCompleteStub).vm.$emit('before-show');
    await wrapper.find('[data-testid="timer-title-input"]').trigger('keydown.enter');
    expect(startMock).not.toHaveBeenCalled();
  });

  it('commits an edited running title via updateTitle on blur', async () => {
    runningState.value = runningEntry('My Task');

    const wrapper = await mountSuspended(AppTimer, {
      global: { stubs: { AutoComplete: AutoCompleteStub, Button: ButtonStub } },
    });

    const input = wrapper.find('[data-testid="timer-title-input"]');
    await input.setValue('Renamed Task');
    await input.trigger('blur');

    expect(updateTitleMock).toHaveBeenCalledWith('Renamed Task');
  });

  it('commits an edited running title via updateTitle on Enter', async () => {
    runningState.value = runningEntry('My Task');

    const wrapper = await mountSuspended(AppTimer, {
      global: { stubs: { AutoComplete: AutoCompleteStub, Button: ButtonStub } },
    });

    const input = wrapper.find('[data-testid="timer-title-input"]');
    await input.setValue('Renamed Task');
    await input.trigger('keydown.enter');

    expect(updateTitleMock).toHaveBeenCalledWith('Renamed Task');
    expect(stopMock).not.toHaveBeenCalled();
  });

  it('detaches the task when the running title is cleared to blank and committed', async () => {
    runningState.value = runningEntry('My Task');

    const wrapper = await mountSuspended(AppTimer, {
      global: { stubs: { AutoComplete: AutoCompleteStub, Button: ButtonStub } },
    });

    const input = wrapper.find('[data-testid="timer-title-input"]');
    await input.setValue('');
    await input.trigger('blur');

    expect(updateTitleMock).toHaveBeenCalledWith('');
  });

  describe('start-time editor popover', () => {
    function mount() {
      return mountSuspended(AppTimer, {
        global: {
          stubs: {
            AutoComplete: AutoCompleteStub,
            Button: ButtonStub,
            Popover: PopoverStub,
            DatePicker: DatePickerStub,
          },
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

      const dateInput = wrapper.find('[data-testid="timer-start-editor-date-input"]');
      const timeInput = wrapper.find('[data-testid="timer-start-editor-time-input"]');
      expect(new Date(dateInput.attributes('value')!).getTime()).toBe(startedAt.getTime());
      expect(new Date(timeInput.attributes('value')!).getTime()).toBe(startedAt.getTime());
    });

    it('blocks a future start with an inline error and does not call updateStartedAt', async () => {
      runningState.value = runningEntry();
      const wrapper = await mount();

      await wrapper.find('[data-testid="timer-elapsed"]').trigger('click');

      const future = new Date(Date.now() + 60 * 60 * 1000);
      await wrapper
        .find('[data-testid="timer-start-editor-date-input"]')
        .setValue(future.toString());
      await wrapper
        .find('[data-testid="timer-start-editor-time-input"]')
        .setValue(future.toString());
      await wrapper.find('[data-testid="timer-start-editor-save-button"]').trigger('click');

      expect(updateStartedAtMock).not.toHaveBeenCalled();
      expect(wrapper.find('[data-testid="timer-start-editor-error"]').text()).toBe(
        'error.timeEntryStartedAtInFuture',
      );
    });

    it('commits a valid past start via updateStartedAt', async () => {
      runningState.value = runningEntry();
      const wrapper = await mount();

      await wrapper.find('[data-testid="timer-elapsed"]').trigger('click');

      const past = new Date(Date.now() - 60 * 60 * 1000);
      await wrapper.find('[data-testid="timer-start-editor-date-input"]').setValue(past.toString());
      await wrapper.find('[data-testid="timer-start-editor-time-input"]').setValue(past.toString());
      await wrapper.find('[data-testid="timer-start-editor-save-button"]').trigger('click');

      expect(updateStartedAtMock).toHaveBeenCalledTimes(1);
    });
  });
});
