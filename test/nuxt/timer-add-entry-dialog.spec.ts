import { describe, expect, it, vi, beforeEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime';
import TimerAddEntryDialog from '../../app/components/TimerAddEntryDialog.vue';
import { combineLocalDateAndTime } from '../../app/utils/timerViewGrouping';

const csrfFetchMock = vi.hoisted(() => vi.fn());
const fetchMock = vi.hoisted(() => vi.fn());
const toastSuccessMock = vi.hoisted(() => vi.fn());
const toastErrorMock = vi.hoisted(() => vi.fn());

vi.mock('ofetch', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ofetch')>();
  return { ...actual, $fetch: Object.assign(csrfFetchMock, { create: () => csrfFetchMock }) };
});
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
  props: ['modelValue', 'inputmode'],
  emits: ['update:modelValue', 'blur', 'keydown'],
};

function mount() {
  return mountSuspended(TimerAddEntryDialog, {
    props: { visible: true, date: new Date(2024, 2, 15), timeZone: 'UTC' },
    global: {
      stubs: {
        UModal: ModalStub,
        UInputMenu: InputMenuStub,
        UInput: InputStub,
        UAlert: { template: '<div v-bind="$attrs"><slot /></div>' },
        FormDialogFooter: {
          template: '<div><button type="submit" data-testid="save-button">save</button></div>',
        },
      },
    },
  });
}

describe('TimerAddEntryDialog', () => {
  beforeEach(() => {
    csrfFetchMock.mockReset();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue([]);
    vi.stubGlobal('$fetch', fetchMock);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (useNuxtApp() as any).$csrfFetch = csrfFetchMock;
    } catch {
      // ignore
    }
  });

  it('submits converted local instants and emits the created entry', async () => {
    const created = { id: 'entry-1' };
    csrfFetchMock.mockResolvedValue(created);
    const wrapper = await mount();
    await wrapper.find('[data-testid="add-entry-title-input"]').setValue('  Manual task  ');
    const start = wrapper.find('[data-testid="add-entry-start-input"]');
    const end = wrapper.find('[data-testid="add-entry-end-input"]');
    await start.setValue('900');
    await start.trigger('blur');
    await end.setValue('1030');
    await end.trigger('blur');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(csrfFetchMock).toHaveBeenCalledWith('/api/time-entries', {
      method: 'POST',
      body: {
        title: 'Manual task',
        startedAt: combineLocalDateAndTime(new Date(2024, 2, 15), '09:00', 'UTC'),
        stoppedAt: combineLocalDateAndTime(new Date(2024, 2, 15), '10:30', 'UTC'),
      },
    });
    expect(wrapper.emitted('added')).toEqual([[created]]);
    expect(wrapper.emitted('update:visible')).toEqual([[false]]);
  });

  it('blocks an end time before the start with an inline error', async () => {
    const wrapper = await mount();
    const start = wrapper.find('[data-testid="add-entry-start-input"]');
    const end = wrapper.find('[data-testid="add-entry-end-input"]');
    await start.setValue('1100');
    await start.trigger('blur');
    await end.setValue('1000');
    await end.trigger('blur');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(csrfFetchMock).not.toHaveBeenCalled();
    expect(wrapper.find('[data-testid="add-entry-range-error"]').text()).toBe(
      'timerView.addEntry.rangeError',
    );
  });
});
