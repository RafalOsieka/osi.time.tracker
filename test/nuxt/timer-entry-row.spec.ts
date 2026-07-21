import { describe, expect, it, vi, beforeEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime';
import TimerEntryRow from '../../app/components/TimerEntryRow.vue';
import type { TimeEntryDto } from '../../shared/types/time-entry';

const csrfFetchMock = vi.hoisted(() => vi.fn());
const confirmMock = vi.hoisted(() => vi.fn(async () => true));
const toastErrorMock = vi.hoisted(() => vi.fn());

vi.mock('ofetch', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ofetch')>();
  return {
    ...actual,
    $fetch: Object.assign(csrfFetchMock, {
      create: () => csrfFetchMock,
      raw: csrfFetchMock,
      native: csrfFetchMock,
    }),
  };
});

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>();
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key, locale: { value: 'en' } }),
  };
});

mockNuxtImport('useAppConfirm', () => () => confirmMock);
mockNuxtImport('useAppToast', () => () => ({
  success: vi.fn(),
  error: toastErrorMock,
}));

const ButtonStub = {
  template: '<button v-bind="$attrs" @click="$emit(\'click\')"><slot />{{ label }}</button>',
  props: ['label', 'icon', 'variant', 'color', 'loading', 'square'],
  emits: ['click'],
};
const InputStub = {
  template:
    '<input v-bind="$attrs" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" @blur="$emit(\'blur\')" @keydown.enter="$emit(\'keydown\', $event)" @keydown.esc="$emit(\'keydown\', $event)" />',
  props: ['modelValue', 'type', 'inputmode'],
  emits: ['update:modelValue', 'blur', 'keydown'],
};

const commonStubs = {
  UButton: ButtonStub,
  UInput: InputStub,
};

function makeEntry(overrides: Partial<TimeEntryDto> = {}): TimeEntryDto {
  return {
    id: 'entry-1',
    taskId: 'task-1',
    taskName: 'Task One',
    projectId: null,
    projectName: null,
    clientName: null,
    startedAt: '2024-03-15T09:00:00.000Z',
    stoppedAt: '2024-03-15T10:00:00.000Z',
    ...overrides,
  };
}

describe('TimerEntryRow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    confirmMock.mockResolvedValue(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (useNuxtApp() as any).$csrfFetch = csrfFetchMock;
    } catch {
      // ignore
    }
  });

  it('commits a title edit on blur and calls PATCH', async () => {
    csrfFetchMock.mockResolvedValue(makeEntry({ taskName: 'Renamed', taskId: 'task-1' }));

    const wrapper = await mountSuspended(TimerEntryRow, {
      props: { entry: makeEntry(), now: Date.now() },
      global: { stubs: commonStubs },
    });

    await wrapper.find('[data-testid="timer-entry-title-entry-1"]').trigger('click');
    await flushPromises();
    const input = wrapper.find('[data-testid="timer-entry-title-input-entry-1"]');
    await input.setValue('Renamed');
    await input.trigger('blur');
    await flushPromises();

    expect(csrfFetchMock).toHaveBeenCalledWith(
      '/api/time-entries/entry-1',
      expect.objectContaining({ method: 'PATCH', body: { title: 'Renamed' } }),
    );
  });

  it('cancels an edit on Escape without sending a request', async () => {
    const wrapper = await mountSuspended(TimerEntryRow, {
      props: { entry: makeEntry(), now: Date.now() },
      global: { stubs: commonStubs },
    });

    await wrapper.find('[data-testid="timer-entry-title-entry-1"]').trigger('click');
    await flushPromises();
    const input = wrapper.find('[data-testid="timer-entry-title-input-entry-1"]');
    await input.setValue('Should not be sent');
    await input.trigger('keydown', { key: 'Escape' });
    await flushPromises();

    expect(csrfFetchMock).not.toHaveBeenCalled();
    expect(wrapper.find('[data-testid="timer-entry-title-input-entry-1"]').exists()).toBe(false);
  });

  it('normalizes and commits a compact start time via PATCH', async () => {
    csrfFetchMock.mockResolvedValue(makeEntry());
    const wrapper = await mountSuspended(TimerEntryRow, {
      props: { entry: makeEntry(), now: Date.now() },
      global: { stubs: commonStubs },
    });

    await wrapper.find('[data-testid="timer-entry-start-entry-1"]').trigger('click');
    await flushPromises();
    const input = wrapper.find('[data-testid="timer-entry-start-input-entry-1"]');
    await input.setValue('901');
    await input.trigger('keydown', { key: 'Enter' });
    await flushPromises();

    expect(csrfFetchMock).toHaveBeenCalledWith(
      '/api/time-entries/entry-1',
      expect.objectContaining({
        method: 'PATCH',
        body: { startedAt: '2024-03-15T09:01:00Z' },
      }),
    );
  });

  it('silently reverts an invalid stop time without sending a request', async () => {
    const wrapper = await mountSuspended(TimerEntryRow, {
      props: { entry: makeEntry(), now: Date.now() },
      global: { stubs: commonStubs },
    });

    await wrapper.find('[data-testid="timer-entry-stop-entry-1"]').trigger('click');
    await flushPromises();
    const input = wrapper.find<HTMLInputElement>('[data-testid="timer-entry-stop-input-entry-1"]');
    await input.setValue('59');
    await input.trigger('blur');
    await flushPromises();

    expect(csrfFetchMock).not.toHaveBeenCalled();
    expect(input.element.value).toBe('10:00');
  });

  it('shows a confirmation before deleting and calls DELETE on accept', async () => {
    csrfFetchMock.mockResolvedValue({ success: true });

    const wrapper = await mountSuspended(TimerEntryRow, {
      props: { entry: makeEntry(), now: Date.now() },
      global: { stubs: commonStubs },
    });

    await wrapper.find('[data-testid="timer-entry-delete-entry-1"]').trigger('click');
    await flushPromises();

    expect(confirmMock).toHaveBeenCalled();
    expect(csrfFetchMock).toHaveBeenCalledWith(
      '/api/time-entries/entry-1',
      expect.objectContaining({ method: 'DELETE' }),
    );
    expect(wrapper.emitted('deleted')).toHaveLength(1);
  });
});
