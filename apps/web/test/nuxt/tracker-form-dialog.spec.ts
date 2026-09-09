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
  UForm: { template: '<form v-bind="$attrs"><slot /></form>' },
  UFormField: { template: '<div><slot /><slot name="error" /></div>' },
  USelect: SelectStub,
  UInput: {
    props: ['modelValue'],
    emits: ['update:modelValue'],
    template:
      '<input v-bind="$attrs" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
  },
  FormDialogFooter: { template: '<div />' },
  TrackerExtensionStatus: { template: '<div data-testid="tracker-extension-status" />' },
};

const existingTracker: TrackerDto = {
  id: 'tracker-1',
  name: 'Existing Tracker',
  systemType: 'redmine',
  baseUrl: 'https://rm.example.com',
  executionMode: 'extension',
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

describe('TrackerFormDialog execution modes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    try {
      Object.assign(useNuxtApp(), { $csrfFetch: csrfFetchMock });
    } catch {
      // ignore
    }
  });

  it('seeds create with client mode and offers only client and extension options', async () => {
    const wrapper = await openDialog(null);
    const select = wrapper.find('[data-testid="tracker-execution-mode-select"]');
    const options = select.findAll('option');
    expect(options.map((option) => option.attributes('value'))).toEqual(['client', 'extension']);
    expect(options.map((option) => option.text())).toEqual([
      'trackers.executionModeClient',
      'trackers.executionModeExtension',
    ]);
    expect(select.element).toHaveProperty('value', 'client');
    expect(wrapper.find('[data-testid="tracker-execution-mode-help"]').text()).toBe(
      'trackers.executionModeClientHelp',
    );
  });

  it('seeds edit with the persisted extension mode and its desktop-only guidance', async () => {
    getSecretMock.mockReturnValue('browser-secret');
    const wrapper = await openDialog(existingTracker);
    const select = wrapper.find('[data-testid="tracker-execution-mode-select"]');
    expect(select.element).toHaveProperty('value', 'extension');
    expect(wrapper.find('[data-testid="tracker-execution-mode-help"]').text()).toBe(
      'trackers.executionModeExtensionHelp',
    );
    expect(select.findAll('option')).toHaveLength(2);
  });
});
