import { describe, expect, it, vi, beforeEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime';
import TrackerFormDialog from '../../app/components/TrackerFormDialog.vue';
import type { TrackerDto } from '../../shared/types/tracker';

const csrfFetchMock = vi.hoisted(() => vi.fn());
const toastSuccessMock = vi.hoisted(() => vi.fn());
const toastErrorMock = vi.hoisted(() => vi.fn());
const getSecretMock = vi.hoisted(() => vi.fn(() => ''));

mockNuxtImport('useAppToast', () => () => ({
  success: toastSuccessMock,
  error: toastErrorMock,
}));
mockNuxtImport('useTrackerSecret', () => () => ({
  get: getSecretMock,
  set: vi.fn(),
  clear: vi.fn(),
}));

// oxlint-disable-next-line anti-slop/no-module-mocking -- Nuxt i18n is not injectable in this nuxt test
vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>();
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key, locale: { value: 'en' } }),
  };
});

const SelectStub = {
  props: ['modelValue', 'items'],
  emits: ['update:modelValue'],
  template: `
    <select
      v-bind="$attrs"
      :value="modelValue"
      @change="$emit('update:modelValue', $event.target.value)"
    >
      <option v-for="item in items" :key="item.value" :value="item.value">{{ item.label }}</option>
    </select>
  `,
};

const stubs = {
  UModal: {
    props: { open: { type: Boolean, default: true }, title: { type: String, default: '' } },
    template: '<div v-if="open !== false" data-testid="tracker-dialog"><slot name="body" /></div>',
  },
  UForm: { template: '<form v-bind="$attrs" @submit.prevent="$emit(\'submit\')"><slot /></form>' },
  UFormField: { template: '<div><slot /><slot name="error" /></div>' },
  USelect: SelectStub,
  UCheckbox: {
    props: ['modelValue', 'label'],
    emits: ['update:modelValue'],
    template: `
      <label>
        <input
          type="checkbox"
          v-bind="$attrs"
          :checked="modelValue"
          @change="$emit('update:modelValue', $event.target.checked)"
        />
        {{ label }}
      </label>
    `,
  },
  UTooltip: {
    props: ['text'],
    template: '<span :data-tooltip-text="text"><slot /></span>',
  },
  UButton: {
    template: '<button type="button" v-bind="$attrs"><slot /></button>',
  },
  UInput: {
    props: ['modelValue'],
    emits: ['update:modelValue'],
    template:
      '<input v-bind="$attrs" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
  },
  FormDialogFooter: {
    template: '<button type="submit" data-testid="save-button">Save</button>',
  },
};

const existingTracker: TrackerDto = {
  id: 'tracker-1',
  name: 'Existing Tracker',
  systemType: 'redmine',
  baseUrl: 'https://rm.example.com',
  directBrowserAccess: false,
  roundingRule: 'up_15m',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

async function openDialog(tracker: TrackerDto | null) {
  const wrapper = await mountSuspended(TrackerFormDialog, {
    props: { open: false, tracker },
    global: { stubs },
  });
  await wrapper.setProps({ open: true, tracker });
  await flushPromises();
  return wrapper;
}

describe('TrackerFormDialog direct browser access', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    try {
      Object.assign(useNuxtApp(), { $csrfFetch: csrfFetchMock });
    } catch {
      // ignore
    }
  });

  it('seeds create with the checkbox enabled and focusable help', async () => {
    const wrapper = await openDialog(null);
    const checkbox = wrapper.find('[data-testid="tracker-direct-browser-access"] input');
    expect(checkbox.element).toBeInstanceOf(HTMLInputElement);
    if (!(checkbox.element instanceof HTMLInputElement)) throw new Error('checkbox');
    expect(checkbox.element.checked).toBe(true);
    const help = wrapper.find('[data-testid="tracker-direct-browser-access-help"]');
    expect(help.exists()).toBe(true);
    expect(help.attributes('aria-label')).toBe('trackers.directBrowserAccessHelpAria');
    expect(help.element.closest('[data-tooltip-text]')?.getAttribute('data-tooltip-text')).toBe(
      'trackers.directBrowserAccessHelp',
    );
    expect(wrapper.find('[data-testid="tracker-extension-status"]').exists()).toBe(false);
  });

  it('seeds edit with persisted false and no extension readiness panel', async () => {
    getSecretMock.mockReturnValue('browser-secret');
    const wrapper = await openDialog(existingTracker);
    const checkbox = wrapper.find('[data-testid="tracker-direct-browser-access"] input');
    expect(checkbox.element).toBeInstanceOf(HTMLInputElement);
    if (!(checkbox.element instanceof HTMLInputElement)) throw new Error('checkbox');
    expect(checkbox.element.checked).toBe(false);
    expect(wrapper.find('[data-testid="tracker-extension-status"]').exists()).toBe(false);
  });

  it('lets the form stay savable when the extension is required and unavailable', async () => {
    const wrapper = await openDialog(null);
    await wrapper.find('[data-testid="tracker-direct-browser-access"] input').setValue(false);
    const checkbox = wrapper.find('[data-testid="tracker-direct-browser-access"] input');
    expect(checkbox.element).toBeInstanceOf(HTMLInputElement);
    if (!(checkbox.element instanceof HTMLInputElement)) throw new Error('checkbox');
    expect(checkbox.element.checked).toBe(false);
    expect(wrapper.find('[data-testid="tracker-extension-status"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="save-button"]').exists()).toBe(true);
  });
});
