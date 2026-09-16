import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime';
import { CalendarDate, parseTime } from '@internationalized/date';
import TimerAddEntryDialog from '../../app/components/TimerAddEntryDialog.vue';
import { wallClockToInstant } from '../../app/utils/date-time';

/** Matches `SUGGESTION_DEBOUNCE_MS` in `use-task-suggestions.ts`. */
const SUGGESTION_DEBOUNCE_MS = 200;

/** Advances past the suggestion debounce and settles the resulting fetch. */
async function settleSuggestions() {
  await vi.advanceTimersByTimeAsync(SUGGESTION_DEBOUNCE_MS);
  await flushPromises();
}

const csrfFetchMock = vi.hoisted(() => vi.fn());
const fetchMock = vi.hoisted(() => vi.fn());
const toastSuccessMock = vi.hoisted(() => vi.fn());
const toastErrorMock = vi.hoisted(() => vi.fn());

// oxlint-disable-next-line anti-slop/no-module-mocking -- `$fetch`/`ofetch` is a Nuxt global without a project DI port
vi.mock('ofetch', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ofetch')>();
  return { ...actual, $fetch: Object.assign(csrfFetchMock, { create: () => csrfFetchMock }) };
});
// oxlint-disable-next-line anti-slop/no-module-mocking -- Nuxt i18n is not injectable in this nuxt test
vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>();
  return { ...actual, useI18n: () => ({ t: (key: string) => key }) };
});

mockNuxtImport('$fetch', () => fetchMock);
mockNuxtImport('useAppToast', () => () => ({
  success: toastSuccessMock,
  error: toastErrorMock,
}));

const ModalStub = {
  props: {
    open: { type: Boolean, default: true },
    title: { type: String, default: '' },
  },
  emits: ['update:open'],
  template:
    '<div v-if="open !== false" data-testid="add-entry-dialog"><slot name="body" /><slot /></div>',
};
const InputMenuStub = {
  template:
    '<input v-bind="$attrs" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value); $emit(\'update:searchTerm\', $event.target.value)" />',
  props: ['modelValue', 'searchTerm', 'items', 'placeholder', 'mode'],
  emits: ['update:modelValue', 'update:searchTerm'],
};
const InputStub = {
  template:
    '<input v-bind="$attrs" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" @blur="$emit(\'blur\')" @keydown.enter="$emit(\'keydown\', $event)" />',
  props: ['modelValue', 'inputmode', 'type'],
  emits: ['update:modelValue', 'blur', 'keydown'],
};
// Stands in for Nuxt UI's segmented `UInputDate`: tests drive it directly via
// `vm.$emit('update:modelValue', ...)` rather than simulating segment
// keystrokes (jsdom/happy-dom cannot run reka's segment key handling).
const InputDateStub = {
  inheritAttrs: false,
  template:
    '<div v-bind="$attrs" class="input-date-stub" :data-model-value="modelValue ? modelValue.toString() : \'\'"><slot name="trailing" /></div>',
  props: ['modelValue'],
  emits: ['update:modelValue'],
};
// Stands in for Nuxt UI's segmented `UInputTime` (range): tests drive it
// directly via `vm.$emit('update:modelValue', { start, end })` rather than
// simulating segment keystrokes.
const InputTimeStub = {
  inheritAttrs: false,
  template: '<div v-bind="$attrs" class="input-time-stub"><slot name="separator" /></div>',
  props: ['modelValue', 'range'],
  emits: ['update:modelValue'],
};

function mount() {
  return mountSuspended(TimerAddEntryDialog, {
    props: { visible: true, timeZone: 'UTC' },
    global: {
      stubs: {
        UModal: ModalStub,
        UInputMenu: InputMenuStub,
        UInput: InputStub,
        UInputDate: InputDateStub,
        UInputTime: InputTimeStub,
        UAlert: { template: '<div v-bind="$attrs"><slot /></div>' },
        FormDialogFooter: {
          template: '<div><button type="submit" data-testid="save-button">save</button></div>',
        },
      },
    },
  });
}

function findTimesStub(wrapper: Awaited<ReturnType<typeof mount>>) {
  return wrapper.findComponent(InputTimeStub);
}

describe('TimerAddEntryDialog', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    csrfFetchMock.mockReset();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue([]);
    vi.stubGlobal('$fetch', fetchMock);
    try {
      Object.assign(useNuxtApp(), { $csrfFetch: csrfFetchMock });
    } catch {
      // ignore
    }
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('submits converted local instants and emits the created entry', async () => {
    const created = { id: 'entry-1' };
    csrfFetchMock.mockResolvedValue(created);
    const wrapper = await mount();
    await wrapper
      .findComponent(InputDateStub)
      .vm.$emit('update:modelValue', new CalendarDate(2024, 3, 15));
    await wrapper.find('[data-testid="add-entry-title-input"]').setValue('  Manual task  ');
    await findTimesStub(wrapper).vm.$emit('update:modelValue', {
      start: parseTime('09:00'),
      end: parseTime('10:30'),
    });
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(csrfFetchMock).toHaveBeenCalledWith('/api/time-entries', {
      method: 'POST',
      body: {
        title: 'Manual task',
        startedAt: wallClockToInstant('2024-03-15', '09:00', 'UTC'),
        stoppedAt: wallClockToInstant('2024-03-15', '10:30', 'UTC'),
      },
    });
    expect(wrapper.emitted('added')).toEqual([[created]]);
    expect(wrapper.emitted('update:visible')).toEqual([[false]]);
  });

  it('falls back to the typed search term when no suggestion is selected', async () => {
    // Real UInputMenu (autocomplete) commits typed text to `searchTerm`
    // continuously but only commits `modelValue` (state.title) when the user
    // selects a suggestion; typing a brand-new title and saving without
    // picking one must still submit it rather than dropping it as untitled.
    const created = { id: 'entry-2' };
    csrfFetchMock.mockResolvedValue(created);
    const wrapper = await mount();
    await wrapper
      .findComponent(InputDateStub)
      .vm.$emit('update:modelValue', new CalendarDate(2024, 3, 15));
    await wrapper.findComponent(InputMenuStub).vm.$emit('update:searchTerm', 'Freeform Title');
    await findTimesStub(wrapper).vm.$emit('update:modelValue', {
      start: parseTime('09:00'),
      end: parseTime('10:30'),
    });
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(csrfFetchMock).toHaveBeenCalledWith('/api/time-entries', {
      method: 'POST',
      body: {
        title: 'Freeform Title',
        startedAt: wallClockToInstant('2024-03-15', '09:00', 'UTC'),
        stoppedAt: wallClockToInstant('2024-03-15', '10:30', 'UTC'),
      },
    });
  });

  it('issues one suggestion request carrying the final text after rapid typing', async () => {
    const wrapper = await mount();

    await wrapper.findComponent(InputMenuStub).vm.$emit('update:searchTerm', 'F');
    await wrapper.findComponent(InputMenuStub).vm.$emit('update:searchTerm', 'Fi');
    await wrapper.findComponent(InputMenuStub).vm.$emit('update:searchTerm', 'Fix');
    await settleSuggestions();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/tasks', { query: { search: 'Fix' } });
  });

  it('blocks an end time before the start with an inline error', async () => {
    const wrapper = await mount();
    await findTimesStub(wrapper).vm.$emit('update:modelValue', {
      start: parseTime('11:00'),
      end: parseTime('10:00'),
    });
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(csrfFetchMock).not.toHaveBeenCalled();
    expect(wrapper.find('[data-testid="add-entry-range-error"]').text()).toBe(
      'timerView.addEntry.rangeError',
    );
  });

  it('blocks submit when the date is cleared to null', async () => {
    const wrapper = await mount();
    await wrapper.findComponent(InputDateStub).vm.$emit('update:modelValue', null);
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(csrfFetchMock).not.toHaveBeenCalled();
    expect(wrapper.find('[data-testid="add-entry-range-error"]').text()).toBe(
      'error.timeEntryStartedAtInvalid',
    );
  });

  it('blocks submit when a time segment is cleared to incomplete', async () => {
    const wrapper = await mount();
    await findTimesStub(wrapper).vm.$emit('update:modelValue', {
      start: undefined,
      end: parseTime('10:00'),
    });
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(csrfFetchMock).not.toHaveBeenCalled();
    expect(wrapper.find('[data-testid="add-entry-range-error"]').text()).toBe(
      'error.timeEntryStartedAtInvalid',
    );
  });
});
