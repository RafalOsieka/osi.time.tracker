import { describe, expect, it, vi } from 'vitest';
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime';
import ColorModeToggle from '../../app/components/ColorModeToggle.vue';
import AppRoot from '../../app/app.vue';

const { cookieState, setPreferenceMock, useHeadMock, requestHeaderState, tMock, localeState } =
  vi.hoisted(() => ({
    cookieState: { value: 'system' as 'light' | 'dark' | 'system' },
    setPreferenceMock: vi.fn(),
    useHeadMock: vi.fn(),
    requestHeaderState: { value: undefined as string | undefined },
    tMock: vi.fn((key: string) => {
      const labels: Record<string, string> = {
        'theme.toggleLabel': 'Theme',
        'theme.light': 'Light',
        'theme.dark': 'Dark',
        'theme.system': 'System',
      };
      return labels[key] ?? key;
    }),
    localeState: { value: 'en' },
  }));

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>();

  return {
    ...actual,
    useI18n: () => ({
      t: tMock,
      locale: localeState,
    }),
  };
});

mockNuxtImport('useColorMode', () => () => ({
  preference: cookieState,
  setPreference: setPreferenceMock,
}));

mockNuxtImport('useCookie', () => () => cookieState);
mockNuxtImport('useRequestHeader', () => () => requestHeaderState.value);
mockNuxtImport('useHead', () => useHeadMock);

describe('theme UI and SSR head wiring', () => {
  it('renders the 3-way PrimeVue theme selector with accessible label', async () => {
    const wrapper = await mountSuspended(ColorModeToggle, {
      global: {
        stubs: {
          SelectButton: {
            props: ['modelValue', 'options', 'ariaLabel'],
            emits: ['update:modelValue'],
            template:
              '<div v-bind="$attrs" :aria-label="ariaLabel">' +
              '<button v-for="option in options" :key="option.value" type="button" @click="$emit(\'update:modelValue\', option.value)">' +
              '{{ option.label }}' +
              '</button>' +
              '</div>',
          },
        },
      },
    });

    expect(wrapper.find('[data-testid="theme-toggle-group"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Light');
    expect(wrapper.text()).toContain('Dark');
    expect(wrapper.text()).toContain('System');
    expect(wrapper.find('[data-testid="theme-toggle-group"]').attributes('aria-label')).toBe(
      'Theme',
    );

    await wrapper.findAll('button')[1]!.trigger('click');
    expect(setPreferenceMock).toHaveBeenCalledWith('dark');
  });

  it('sets dark class on initial html attrs when cookie stores dark', async () => {
    cookieState.value = 'dark';
    requestHeaderState.value = undefined;
    useHeadMock.mockClear();

    await mountSuspended(AppRoot, {
      global: {
        stubs: {
          NuxtLayout: { template: '<div><slot /></div>' },
          NuxtPage: { template: '<div />' },
          NuxtRouteAnnouncer: { template: '<div />' },
        },
      },
    });

    expect(useHeadMock).toHaveBeenCalledWith({
      htmlAttrs: {
        lang: localeState,
        class: 'dark',
      },
      link: [{ rel: 'stylesheet', href: 'https://rsms.me/inter/inter.css' }],
    });
  });
});
