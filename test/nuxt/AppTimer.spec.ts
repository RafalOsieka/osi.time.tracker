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

const { runningState, elapsedSecondsState, startMock, stopMock } = vi.hoisted(() => ({
  runningState: { value: null as unknown },
  elapsedSecondsState: { value: 0 },
  startMock: vi.fn(),
  stopMock: vi.fn(),
}));

mockNuxtImport('useTimer', () => () => ({
  running: runningState,
  elapsedSeconds: elapsedSecondsState,
  fetchRunning: vi.fn(),
  start: startMock,
  stop: stopMock,
}));

const AutoCompleteStub = {
  template:
    '<input data-testid="timer-title-input" :aria-label="ariaLabel" :placeholder="placeholder" :disabled="disabled" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
  props: [
    'modelValue',
    'suggestions',
    'optionLabel',
    'disabled',
    'placeholder',
    'ariaLabel',
    'inputId',
  ],
  emits: ['update:modelValue', 'complete', 'item-select'],
};
const ButtonStub = {
  template:
    '<button data-testid="timer-toggle-button" :aria-pressed="ariaPressed" @click="$emit(\'click\')">{{ label }}</button>',
  props: ['label', 'severity', 'loading', 'ariaPressed'],
  emits: ['click'],
};

describe('AppTimer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runningState.value = null;
    elapsedSecondsState.value = 0;
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
    runningState.value = {
      id: 'entry-1',
      taskId: null,
      taskName: null,
      projectId: null,
      projectName: null,
      clientName: null,
      startedAt: new Date().toISOString(),
      stoppedAt: null,
    };
    elapsedSecondsState.value = 65;

    const wrapper = await mountSuspended(AppTimer, {
      global: { stubs: { AutoComplete: AutoCompleteStub, Button: ButtonStub } },
    });

    expect(wrapper.find('[data-testid="timer-toggle-button"]').text()).toBe('timer.stop');
    expect(wrapper.find('[data-testid="timer-elapsed"]').text()).toBe('00:01:05');
    expect(wrapper.find('[data-testid="timer-title-input"]').attributes('disabled')).toBeDefined();
  });

  it('calls start() when the toggle button is clicked while idle', async () => {
    const wrapper = await mountSuspended(AppTimer, {
      global: { stubs: { AutoComplete: AutoCompleteStub, Button: ButtonStub } },
    });

    await wrapper.find('[data-testid="timer-toggle-button"]').trigger('click');
    expect(startMock).toHaveBeenCalled();
  });

  it('calls stop() when the toggle button is clicked while running', async () => {
    runningState.value = {
      id: 'entry-1',
      taskId: null,
      taskName: null,
      projectId: null,
      projectName: null,
      clientName: null,
      startedAt: new Date().toISOString(),
      stoppedAt: null,
    };

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
});
