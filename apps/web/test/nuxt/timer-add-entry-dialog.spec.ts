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
  inheritAttrs: false,
  template:
    '<div><input v-bind="$attrs" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value); $emit(\'update:searchTerm\', $event.target.value)" /><slot name="leading" /></div>',
  props: ['modelValue', 'searchTerm', 'items', 'placeholder', 'mode', 'ui'],
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

  describe('@project mentions and picked suggestions', () => {
    const helios = {
      id: 'p-helios',
      name: 'Helios',
      trackerId: null,
      trackerName: null,
      remoteProjectId: null,
      remoteProjectTitle: null,
      recentTrackedSeconds: 0,
      createdAt: '',
    };
    const suggestion = {
      id: 'task-7',
      name: 'fix login',
      projectId: 'p-nord',
      projectName: 'Nordwind',
      createdAt: '',
    };
    const times = { start: parseTime('09:00'), end: parseTime('10:30') };
    const range = {
      startedAt: wallClockToInstant('2024-03-15', '09:00', 'UTC'),
      stoppedAt: wallClockToInstant('2024-03-15', '10:30', 'UTC'),
    };

    async function mountReady(tasks: unknown[] = []) {
      fetchMock.mockImplementation(async (url: string) =>
        url === '/api/projects' ? [helios] : tasks,
      );
      csrfFetchMock.mockResolvedValue({ id: 'entry-x' });
      const wrapper = await mountSuspended(TimerAddEntryDialog, {
        props: { visible: false, timeZone: 'UTC' },
        global: {
          stubs: {
            UModal: ModalStub,
            UInputMenu: InputMenuStub,
            UInput: InputStub,
            UInputDate: InputDateStub,
            UInputTime: InputTimeStub,
            FormDialogFooter: {
              template: '<div><button type="submit" data-testid="save-button">save</button></div>',
            },
          },
        },
      });
      await wrapper.setProps({ visible: true });
      await flushPromises();
      await wrapper
        .findComponent(InputDateStub)
        .vm.$emit('update:modelValue', new CalendarDate(2024, 3, 15));
      await findTimesStub(wrapper).vm.$emit('update:modelValue', times);
      const menu = wrapper.findComponent(InputMenuStub);
      // SAFETY: the stubbed menu receives the items built by buildTaskTitleMenuItems.
      const rows = () =>
        menu.props('items') as Array<{
          id: string;
          name: string;
          label: string;
          onSelect: () => void;
        }>;
      const save = async () => {
        await wrapper.find('form').trigger('submit');
        await flushPromises();
      };
      return {
        wrapper,
        menu,
        rows,
        save,
        input: wrapper.find('[data-testid="add-entry-title-input"]'),
      };
    }

    it('binds an unedited picked suggestion by taskId', async () => {
      const { menu, rows, save } = await mountReady([suggestion]);
      await menu.vm.$emit('update:searchTerm', 'fix');
      await settleSuggestions();
      const picked = rows().find((row) => row.id === 'task-7')!;
      picked.onSelect();
      await menu.vm.$emit('update:modelValue', picked.name);
      await flushPromises();

      await save();
      expect(csrfFetchMock).toHaveBeenCalledWith('/api/time-entries', {
        method: 'POST',
        body: { taskId: 'task-7', ...range },
      });
    });

    it('falls back to title and the chip project after editing a picked suggestion', async () => {
      const { wrapper, menu, rows, save } = await mountReady([suggestion]);
      await menu.vm.$emit('update:searchTerm', 'fix');
      await settleSuggestions();
      const picked = rows().find((row) => row.id === 'task-7')!;
      picked.onSelect();
      await menu.vm.$emit('update:modelValue', picked.name);
      await flushPromises();
      expect(wrapper.find('[data-testid="add-entry-project-chip"]').text()).toContain('Nordwind');

      await menu.vm.$emit('update:searchTerm', 'fix login again');
      await save();
      expect(csrfFetchMock).toHaveBeenCalledWith('/api/time-entries', {
        method: 'POST',
        body: { title: 'fix login again', projectId: 'p-nord', ...range },
      });
    });

    it('picking a project sets the chip, strips the token and saves in that project', async () => {
      const { wrapper, menu, rows, save } = await mountReady();
      await menu.vm.$emit('update:searchTerm', 'review @hel');
      const picked = rows()[1]!;
      expect(rows()[0]).toMatchObject({ type: 'label' });
      picked.onSelect();
      await menu.vm.$emit('update:modelValue', picked.name);
      await flushPromises();
      expect(wrapper.find('[data-testid="add-entry-project-chip"]').text()).toContain('Helios');

      await save();
      expect(csrfFetchMock).toHaveBeenCalledWith('/api/time-entries', {
        method: 'POST',
        body: { title: 'review', projectId: 'p-helios', ...range },
      });
    });

    it('resolves a fully typed mention on save', async () => {
      const { menu, save } = await mountReady();
      await menu.vm.$emit('update:searchTerm', 'review @helios');
      await save();
      expect(csrfFetchMock).toHaveBeenCalledWith('/api/time-entries', {
        method: 'POST',
        body: { title: 'review', projectId: 'p-helios', ...range },
      });
    });

    it('saves an untitled entry without a project when only the chip is set', async () => {
      const { menu, rows, save } = await mountReady();
      await menu.vm.$emit('update:searchTerm', '@hel');
      const picked = rows()[1]!;
      picked.onSelect();
      await menu.vm.$emit('update:modelValue', picked.name);
      await flushPromises();

      await save();
      expect(csrfFetchMock).toHaveBeenCalledWith('/api/time-entries', {
        method: 'POST',
        body: { title: null, ...range },
      });
    });
  });

  it('issues one suggestion request carrying the final text after rapid typing', async () => {
    const wrapper = await mount();

    await wrapper.findComponent(InputMenuStub).vm.$emit('update:searchTerm', 'F');
    await wrapper.findComponent(InputMenuStub).vm.$emit('update:searchTerm', 'Fi');
    await wrapper.findComponent(InputMenuStub).vm.$emit('update:searchTerm', 'Fix');
    await settleSuggestions();

    const taskCalls = fetchMock.mock.calls.filter(([path]) => path === '/api/tasks');
    expect(taskCalls).toEqual([['/api/tasks', { query: { search: 'Fix' } }]]);
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
