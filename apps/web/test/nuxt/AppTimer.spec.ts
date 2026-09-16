import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime';
import { CalendarDate, Time } from '@internationalized/date';
import AppTimer from '../../app/components/AppTimer.vue';
import type { TimeEntryDto } from '../../shared/types/time-entry';
import type { TaskDto } from '../../shared/types/task';

/** Matches `SUGGESTION_DEBOUNCE_MS` in `use-task-suggestions.ts`. */
const SUGGESTION_DEBOUNCE_MS = 200;

/** Advances past the suggestion debounce and settles the resulting fetch. */
async function settleSuggestions() {
  await vi.advanceTimersByTimeAsync(SUGGESTION_DEBOUNCE_MS);
  await flushPromises();
}

type AppTimerRunning = { value: TimeEntryDto | null };
type TimerMenuItem = { id: string; name: string; label: string; onSelect: () => void };

const {
  fetchMock,
  runningState,
  elapsedSecondsState,
  loadingState,
  startMock,
  stopMock,
  updateTitleMock,
  updateStartedAtMock,
} = vi.hoisted(() => {
  const runningState: AppTimerRunning = { value: null };
  return {
    fetchMock: vi.fn(),
    runningState,
    elapsedSecondsState: { value: 0 },
    loadingState: { value: false },
    startMock: vi.fn(),
    stopMock: vi.fn(),
    updateTitleMock: vi.fn(),
    updateStartedAtMock: vi.fn(),
  };
});

// oxlint-disable-next-line anti-slop/no-module-mocking -- Nuxt i18n is not injectable in this nuxt test
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
            (item?.label != null && /new task/i.test(item.label)),
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
// Stands in for Nuxt UI's segmented `UInputDate`: the real component's model
// is an `@internationalized/date` `CalendarDate`, but tests drive it directly
// via `vm.$emit('update:modelValue', ...)` rather than simulating segment
// keystrokes (jsdom/happy-dom cannot run reka's segment key handling).
const InputDateStub = {
  inheritAttrs: false,
  template:
    '<div v-bind="$attrs" class="input-date-stub" :data-model-value="modelValue ? modelValue.toString() : \'\'"><slot name="trailing" /></div>',
  props: ['modelValue', 'range', 'minValue', 'maxValue'],
  emits: ['update:modelValue', 'blur', 'change'],
};
// Stands in for Nuxt UI's segmented `UInputTime`: the real component's model
// is an `@internationalized/date` `Time`, but tests drive it directly via
// `vm.$emit('update:modelValue', ...)` rather than simulating segment
// keystrokes (jsdom/happy-dom cannot run reka's segment key handling).
const InputTimeStub = {
  inheritAttrs: false,
  template: '<div v-bind="$attrs" class="input-time-stub"><slot name="separator" /></div>',
  props: ['modelValue', 'range', 'hourCycle', 'granularity'],
  emits: ['update:modelValue'],
};

function calendarDateFrom(date: Date): CalendarDate {
  return new CalendarDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
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
  UInputDate: InputDateStub,
  UInputTime: InputTimeStub,
  UTooltip: TooltipStub,
};

describe('AppTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    runningState.value = null;
    elapsedSecondsState.value = 0;
    loadingState.value = false;
    fetchMock.mockResolvedValue([]);
    vi.stubGlobal('$fetch', fetchMock);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
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
    await settleSuggestions();

    const items: TimerMenuItem[] = wrapper.findComponent(InputMenuStub).props('items');
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

  it('discards a stale suggestion response that resolves after a newer request', async () => {
    let resolveFirst: (value: TaskDto[]) => void = () => {};
    let resolveSecond: (value: TaskDto[]) => void = () => {};
    const firstResponse = new Promise<TaskDto[]>((resolve) => {
      resolveFirst = resolve;
    });
    const secondResponse = new Promise<TaskDto[]>((resolve) => {
      resolveSecond = resolve;
    });
    fetchMock.mockImplementationOnce(() => firstResponse);
    fetchMock.mockImplementationOnce(() => secondResponse);

    const wrapper = await mountSuspended(AppTimer, {
      global: { stubs: baseStubs },
    });

    // Two searches far enough apart that each settles its own debounce and
    // issues its own request, leaving both in flight at once.
    await wrapper.findComponent(InputMenuStub).vm.$emit('update:searchTerm', 'a');
    await vi.advanceTimersByTimeAsync(SUGGESTION_DEBOUNCE_MS);
    await wrapper.findComponent(InputMenuStub).vm.$emit('update:searchTerm', 'ab');
    await vi.advanceTimersByTimeAsync(SUGGESTION_DEBOUNCE_MS);

    // The newer request ("ab") resolves first...
    resolveSecond([
      { id: 'task-ab', name: 'AB Task', projectId: null, projectName: null, createdAt: '' },
    ]);
    await flushPromises();
    // ...then the stale "a" response arrives late and must be ignored.
    resolveFirst([
      { id: 'task-a', name: 'A Task', projectId: null, projectName: null, createdAt: '' },
    ]);
    await flushPromises();

    const items: TimerMenuItem[] = wrapper.findComponent(InputMenuStub).props('items');
    expect(items.some((item) => item.id === 'task-ab')).toBe(true);
    expect(items.some((item) => item.id === 'task-a')).toBe(false);
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
    await settleSuggestions();

    const items: TimerMenuItem[] = wrapper.findComponent(InputMenuStub).props('items');
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
    await settleSuggestions();

    const items: TimerMenuItem[] = wrapper.findComponent(InputMenuStub).props('items');
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
    let items: TimerMenuItem[] = wrapper.findComponent(InputMenuStub).props('items');
    expect(items.some((item) => item.id === '__create_new_task__')).toBe(false);

    await wrapper.findComponent(InputMenuStub).vm.$emit('update:searchTerm', '   ');
    await flushPromises();
    expect(wrapper.find('[data-testid="timer-create-item"]').exists()).toBe(false);
    items = wrapper.findComponent(InputMenuStub).props('items');
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
    await settleSuggestions();
    const items: TimerMenuItem[] = wrapper.findComponent(InputMenuStub).props('items');
    items.find((item) => item.id === 'task-42')!.onSelect();
    await wrapper.findComponent(InputMenuStub).vm.$emit('update:modelValue', 'Linked Task');
    await wrapper.findComponent(InputMenuStub).vm.$emit('update:open', true);
    await flushPromises();

    await wrapper.findComponent(InputMenuStub).vm.$emit('update:searchTerm', 'Linked Task');
    await flushPromises();
    const createItems: TimerMenuItem[] = wrapper.findComponent(InputMenuStub).props('items');
    const createItem = createItems.find((item) => item.id === '__create_new_task__');
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
      expect(dateInput.attributes('data-model-value')).toBe('2024-01-05');
      expect(wrapper.findComponent(InputTimeStub).props('modelValue')).toEqual(new Time(10, 30));
    });

    it('blocks a future start with an inline error and does not call updateStartedAt', async () => {
      runningState.value = runningEntry();
      const wrapper = await mount();

      await wrapper.find('[data-testid="timer-elapsed"]').trigger('click');
      await flushPromises();

      const future = new Date(Date.now() + 60 * 60 * 1000);
      await wrapper
        .findComponent(InputDateStub)
        .vm.$emit('update:modelValue', calendarDateFrom(future));
      await wrapper
        .findComponent(InputTimeStub)
        .vm.$emit('update:modelValue', new Time(future.getHours(), future.getMinutes()));
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
        .findComponent(InputDateStub)
        .vm.$emit('update:modelValue', calendarDateFrom(past));
      await wrapper
        .findComponent(InputTimeStub)
        .vm.$emit('update:modelValue', new Time(past.getHours(), past.getMinutes()));
      await wrapper.find('[data-testid="timer-start-editor-save-button"]').trigger('click');
      await flushPromises();

      expect(updateStartedAtMock).toHaveBeenCalledTimes(1);
    });

    it('commits a picked date and time via updateStartedAt', async () => {
      runningState.value = runningEntry();
      const wrapper = await mount();

      await wrapper.find('[data-testid="timer-elapsed"]').trigger('click');
      await flushPromises();
      await wrapper
        .findComponent(InputDateStub)
        .vm.$emit('update:modelValue', new CalendarDate(2024, 7, 9));
      await wrapper.findComponent(InputTimeStub).vm.$emit('update:modelValue', new Time(9, 0));
      await wrapper.find('[data-testid="timer-start-editor-save-button"]').trigger('click');
      await flushPromises();

      expect(updateStartedAtMock).toHaveBeenCalledWith('2024-07-09T09:00:00.000Z');
    });

    it('disables saving while the date is incomplete', async () => {
      const startedAt = new Date('2024-01-05T10:30:00.000Z');
      runningState.value = { ...runningEntry(), startedAt: startedAt.toISOString() };
      const wrapper = await mount();

      await wrapper.find('[data-testid="timer-elapsed"]').trigger('click');
      await flushPromises();
      await wrapper.findComponent(InputDateStub).vm.$emit('update:modelValue', null);
      await flushPromises();

      const saveButton = wrapper.find('[data-testid="timer-start-editor-save-button"]');
      expect(saveButton.attributes('disabled')).not.toBeUndefined();

      await saveButton.trigger('click');
      await flushPromises();
      expect(updateStartedAtMock).not.toHaveBeenCalled();
    });

    it('disables saving while the time is incomplete', async () => {
      const startedAt = new Date('2024-01-05T10:30:00.000Z');
      runningState.value = { ...runningEntry(), startedAt: startedAt.toISOString() };
      const wrapper = await mount();

      await wrapper.find('[data-testid="timer-elapsed"]').trigger('click');
      await flushPromises();
      await wrapper.findComponent(InputTimeStub).vm.$emit('update:modelValue', null);
      await flushPromises();

      const saveButton = wrapper.find('[data-testid="timer-start-editor-save-button"]');
      expect(saveButton.attributes('disabled')).not.toBeUndefined();

      await saveButton.trigger('click');
      await flushPromises();
      expect(updateStartedAtMock).not.toHaveBeenCalled();
    });
  });
});
