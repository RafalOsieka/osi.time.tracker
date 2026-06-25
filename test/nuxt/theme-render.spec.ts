import { describe, expect, it, vi } from 'vitest';
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime';
import AppRoot from '../../app/app.vue';

const { cookieState, setPreferenceMock, useHeadMock, requestHeaderState, localeState } = vi.hoisted(
  () => ({
    cookieState: { value: 'system' as 'light' | 'dark' | 'system' },
    setPreferenceMock: vi.fn(),
    useHeadMock: vi.fn(),
    requestHeaderState: { value: undefined as string | undefined },
    localeState: { value: 'en' },
  }),
);

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>();

  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => key,
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
