import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime';
import { flushPromises } from '@vue/test-utils';
import SettingsPage from '../../app/pages/settings.vue';

const harness = vi.hoisted(() => ({
  saveMock: vi.fn(),
  toastAdd: vi.fn(),
  settings: { value: { timezone: 'UTC' } },
  detectedTimeZone: { value: 'UTC' },
}));

// oxlint-disable-next-line anti-slop/no-module-mocking -- Nuxt i18n is not injectable in this nuxt test
vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>();
  const { ref } = await import('vue');
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => key,
      locale: ref('en'),
      setLocale: vi.fn(),
    }),
  };
});

// oxlint-disable-next-line anti-slop/no-module-mocking -- cookie settings composable has no test seam
vi.mock('../../app/composables/use-user-settings', async () => {
  const { ref } = await import('vue');
  harness.settings = ref({ timezone: 'UTC' });
  harness.detectedTimeZone = ref('UTC');
  return {
    useUserSettings: () => ({
      settings: harness.settings,
      detectedTimeZone: harness.detectedTimeZone,
      save: harness.saveMock,
    }),
  };
});

mockNuxtImport('useColorMode', () => () => ({
  unknown: false,
  preference: 'system',
}));

mockNuxtImport('useToast', () => () => ({
  add: harness.toastAdd,
}));

const FormFieldStub = { template: '<div><slot /><slot name="hint" /></div>' };
const SelectStub = {
  props: ['modelValue', 'items'],
  template: '<div />',
};
const SelectMenuStub = {
  name: 'USelectMenu',
  inheritAttrs: false,
  props: ['modelValue', 'items'],
  emits: ['update:modelValue'],
  template:
    '<button type="button" data-testid="settings-timezone-trigger" @click="$emit(\'update:modelValue\', \'Europe/Warsaw\')">{{ modelValue }}</button>',
};
const SkeletonStub = { template: '<div data-testid="settings-skeleton" />' };

async function mountSettings() {
  const wrapper = await mountSuspended(SettingsPage, {
    global: {
      stubs: {
        UFormField: FormFieldStub,
        USelect: SelectStub,
        USelectMenu: SelectMenuStub,
        USkeleton: SkeletonStub,
      },
    },
  });
  await flushPromises();
  return wrapper;
}

describe('settings page', () => {
  beforeEach(() => {
    harness.saveMock.mockReset();
    harness.toastAdd.mockReset();
    harness.settings.value = { timezone: 'UTC' };
    harness.detectedTimeZone.value = 'UTC';
  });

  it('has no Save button and restores timezone when persist fails', async () => {
    harness.saveMock.mockRejectedValue(new Error('network'));
    const wrapper = await mountSettings();

    expect(wrapper.find('[data-testid="page-settings"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="settings-preferences"]').exists()).toBe(true);
    expect(wrapper.text()).not.toMatch(/Save settings/i);

    await wrapper.get('[data-testid="settings-timezone-trigger"]').trigger('click');
    await flushPromises();

    expect(harness.saveMock).toHaveBeenCalledWith({ timezone: 'Europe/Warsaw' });
    expect(harness.toastAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'settings.saveError',
        color: 'error',
      }),
    );
    expect(wrapper.get('[data-testid="settings-timezone-trigger"]').text()).toBe('UTC');
  });

  it('persists a timezone change without a Save button', async () => {
    harness.saveMock.mockImplementation(async (update: { timezone: string }) => {
      harness.settings.value = { timezone: update.timezone };
      return harness.settings.value;
    });
    const wrapper = await mountSettings();

    await wrapper.get('[data-testid="settings-timezone-trigger"]').trigger('click');
    await flushPromises();

    expect(harness.saveMock).toHaveBeenCalledWith({ timezone: 'Europe/Warsaw' });
    expect(harness.toastAdd).not.toHaveBeenCalled();
    expect(wrapper.get('[data-testid="settings-timezone-trigger"]').text()).toBe('Europe/Warsaw');
  });
});
