import { describe, expect, it, vi, beforeEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime';
import TimerEntryRow from '../../app/components/TimerEntryRow.vue';
import type { TimeEntryDto } from '../../shared/types/time-entry';
import type { instantToZonedDateTime } from '../../app/utils/date-time';

const csrfFetchMock = vi.hoisted(() => vi.fn());
const confirmMock = vi.hoisted(() => vi.fn(async () => true));
const toastErrorMock = vi.hoisted(() => vi.fn());

// oxlint-disable-next-line anti-slop/no-module-mocking -- `$fetch`/`ofetch` is a Nuxt global without a project DI port
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

// oxlint-disable-next-line anti-slop/no-module-mocking -- Nuxt i18n is not injectable in this nuxt test
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
// Stands in for Nuxt UI's segmented `UInputTime`: the real component's model
// is an `@internationalized/date` `ZonedDateTime` (single, for a running
// entry's start) or `{ start, end }` (range, for a stopped entry), but tests
// drive it directly via `vm.$emit('update:modelValue', ...)` rather than
// simulating segment keystrokes (jsdom/happy-dom cannot run reka's segment
// key handling). `blur`/`keydown` are deliberately NOT declared as emits so
// they fall through `$attrs` onto the rendered `<div>` as plain native
// listeners, matching how the real `UInputTime` forwards them onto its own
// DOM root.
const InputTimeStub = {
  inheritAttrs: false,
  template: '<div v-bind="$attrs" class="input-time-stub"><slot name="separator" /></div>',
  props: ['modelValue', 'range', 'hourCycle', 'granularity', 'size', 'variant', 'ui', 'disabled'],
  emits: ['update:modelValue'],
};

const TooltipStub = {
  props: ['text', 'content'],
  template: '<span v-bind="$attrs" :data-tooltip-text="text"><slot /></span>',
};

const commonStubs = {
  UButton: ButtonStub,
  UInput: InputStub,
  UInputTime: InputTimeStub,
  UTooltip: TooltipStub,
};

function makeEntry(overrides: Partial<TimeEntryDto> = {}): TimeEntryDto {
  return {
    id: 'entry-1',
    taskId: 'task-1',
    taskName: 'Task One',
    projectId: null,
    projectName: null,
    startedAt: '2024-03-15T09:00:00.000Z',
    stoppedAt: '2024-03-15T10:00:00.000Z',
    ...overrides,
  };
}

/** The `TimeField` rendered in the row's fixed time slot, regardless of running/stopped. */
function findTimesField(wrapper: Awaited<ReturnType<typeof mountSuspended>>) {
  return wrapper.find('[data-testid="timer-entry-times-entry-1"]');
}

function findTimesStub(wrapper: Awaited<ReturnType<typeof mountSuspended>>) {
  return wrapper.findComponent(InputTimeStub);
}

describe('TimerEntryRow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    confirmMock.mockResolvedValue(true);
    try {
      Object.assign(useNuxtApp(), { $csrfFetch: csrfFetchMock });
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

  it('commits a changed minute on Enter, preserving stored seconds', async () => {
    csrfFetchMock.mockResolvedValue(makeEntry());
    const wrapper = await mountSuspended(TimerEntryRow, {
      props: {
        entry: makeEntry({ startedAt: '2024-03-15T09:00:17.000Z' }),
        now: Date.now(),
        timeZone: 'UTC',
      },
      global: { stubs: commonStubs },
    });

    const stub = findTimesStub(wrapper);
    // SAFETY: TimerEntryRow always seeds the stub with a { start, end } (or { start }) shape built from the entry.
    const seeded = stub.props('modelValue') as { start: ReturnType<typeof instantToZonedDateTime> };
    await stub.vm.$emit('update:modelValue', {
      ...seeded,
      start: seeded.start.set({ minute: 1 }),
    });
    await findTimesField(wrapper).trigger('keydown', { key: 'Enter' });
    await flushPromises();

    expect(csrfFetchMock).toHaveBeenCalledWith(
      '/api/time-entries/entry-1',
      expect.objectContaining({
        method: 'PATCH',
        body: { startedAt: '2024-03-15T09:01:17.000Z' },
      }),
    );
  });

  it('sends no request when a commit leaves the value unchanged', async () => {
    const wrapper = await mountSuspended(TimerEntryRow, {
      props: { entry: makeEntry(), now: Date.now(), timeZone: 'UTC' },
      global: { stubs: commonStubs },
    });

    const stub = findTimesStub(wrapper);
    const seeded = stub.props('modelValue');
    // Retyping the same minute re-emits an equal value, as a real segmented
    // field would (only the touched segment's digits change).
    await stub.vm.$emit('update:modelValue', seeded);
    await findTimesField(wrapper).trigger('keydown', { key: 'Enter' });
    await flushPromises();

    expect(csrfFetchMock).not.toHaveBeenCalled();
  });

  it('clamps a same-minute inversion instead of surfacing a stopped-before-started error', async () => {
    csrfFetchMock.mockResolvedValue(makeEntry());
    const wrapper = await mountSuspended(TimerEntryRow, {
      props: {
        entry: makeEntry({
          startedAt: '2024-03-15T10:42:50.000Z',
          stoppedAt: '2024-03-15T10:43:10.000Z',
        }),
        now: Date.now(),
        timeZone: 'UTC',
      },
      global: { stubs: commonStubs },
    });

    const stub = findTimesStub(wrapper);
    // SAFETY: TimerEntryRow always seeds the stub with a { start, end } (or { start }) shape built from the entry.
    const seeded = stub.props('modelValue') as {
      start: ReturnType<typeof instantToZonedDateTime>;
      end: ReturnType<typeof instantToZonedDateTime>;
    };
    // User retypes the start minute to 43 (its own seconds, 50, untouched by
    // a minute-segment edit); start and stop now share minute 43 with start
    // after stop.
    await stub.vm.$emit('update:modelValue', {
      ...seeded,
      start: seeded.start.set({ minute: 43 }),
    });
    await findTimesField(wrapper).trigger('keydown', { key: 'Enter' });
    await flushPromises();

    // The clamp snaps the edited bound (start) to the untouched bound's
    // seconds, so the server sees an ordered, zero-duration pair instead of
    // a "stopped before started" rejection.
    expect(csrfFetchMock).toHaveBeenCalledWith(
      '/api/time-entries/entry-1',
      expect.objectContaining({
        method: 'PATCH',
        body: { startedAt: '2024-03-15T10:43:10.000Z' },
      }),
    );
  });

  it('shows a confirmation before deleting and calls DELETE on accept', async () => {
    csrfFetchMock.mockResolvedValue({ success: true });

    const wrapper = await mountSuspended(TimerEntryRow, {
      props: { entry: makeEntry(), now: Date.now() },
      global: { stubs: commonStubs },
    });

    const deleteButton = wrapper.find('[data-testid="timer-entry-delete-entry-1"]');
    expect(
      deleteButton.element.closest('[data-tooltip-text]')?.getAttribute('data-tooltip-text'),
    ).toBe('timerView.entryRow.deleteLabel');
    await deleteButton.trigger('click');
    await flushPromises();

    expect(confirmMock).toHaveBeenCalled();
    expect(csrfFetchMock).toHaveBeenCalledWith(
      '/api/time-entries/entry-1',
      expect.objectContaining({ method: 'DELETE' }),
    );
    expect(wrapper.emitted('deleted')).toHaveLength(1);
  });

  it('exposes a long title in a tooltip and keeps editors off ch-based widths', async () => {
    const longName = 'A very long time entry title that should truncate in the row';
    const wrapper = await mountSuspended(TimerEntryRow, {
      props: { entry: makeEntry({ taskName: longName }), now: Date.now(), timeZone: 'UTC' },
      global: { stubs: commonStubs },
    });

    const title = wrapper.find('[data-testid="timer-entry-title-entry-1"]');
    expect(title.attributes('style') ?? '').not.toMatch(/\d+ch/);
    expect(wrapper.find('[data-tooltip-text]').attributes('data-tooltip-text')).toBe(longName);

    await title.trigger('click');
    await flushPromises();
    const input = wrapper.find<HTMLInputElement>('[data-testid="timer-entry-title-input-entry-1"]');
    expect(input.element.value).toBe(longName);
    expect(input.attributes('style') ?? '').not.toMatch(/\d+ch/);
  });

  it('patches start time on the same local day only', async () => {
    csrfFetchMock.mockResolvedValue(makeEntry());
    const wrapper = await mountSuspended(TimerEntryRow, {
      props: {
        entry: makeEntry({ startedAt: '2024-03-15T09:00:00.000Z' }),
        now: Date.now(),
        timeZone: 'UTC',
      },
      global: { stubs: commonStubs },
    });

    const stub = findTimesStub(wrapper);
    // SAFETY: TimerEntryRow always seeds the stub with a { start, end } (or { start }) shape built from the entry.
    const seeded = stub.props('modelValue') as { start: ReturnType<typeof instantToZonedDateTime> };
    await stub.vm.$emit('update:modelValue', {
      ...seeded,
      start: seeded.start.set({ hour: 14, minute: 30 }),
    });
    await findTimesField(wrapper).trigger('keydown', { key: 'Enter' });
    await flushPromises();

    expect(csrfFetchMock).toHaveBeenCalledWith(
      '/api/time-entries/entry-1',
      expect.objectContaining({
        method: 'PATCH',
        body: { startedAt: '2024-03-15T14:30:00.000Z' },
      }),
    );
  });

  it('keeps the time slot a stable width for a stopped entry', async () => {
    const wrapper = await mountSuspended(TimerEntryRow, {
      props: { entry: makeEntry(), now: Date.now(), timeZone: 'UTC' },
      global: { stubs: commonStubs },
    });

    const field = findTimesField(wrapper);
    expect(field.element.closest('span')?.className ?? '').toContain('w-[11.5rem]');
  });

  it('keeps the time slot the same width for a running entry', async () => {
    const wrapper = await mountSuspended(TimerEntryRow, {
      props: {
        entry: makeEntry({ stoppedAt: null }),
        now: Date.now(),
        timeZone: 'UTC',
      },
      global: { stubs: commonStubs },
    });

    const field = findTimesField(wrapper);
    expect(field.element.closest('span')?.className ?? '').toContain('w-[11.5rem]');
    expect(wrapper.text()).toContain('timerView.entryRow.nowLabel');
  });
});
