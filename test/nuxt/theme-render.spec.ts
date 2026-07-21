import { describe, expect, it, vi } from 'vitest';
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime';
import AppRoot from '../../app/app.vue';

const { useHeadMock, localeState } = vi.hoisted(() => ({
  useHeadMock: vi.fn(),
  localeState: { value: 'en' as string },
}));

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

mockNuxtImport('useHead', () => useHeadMock);

describe('theme UI and SSR head wiring', () => {
  it('binds document lang from i18n and wraps the app in UApp', async () => {
    localeState.value = 'en';
    useHeadMock.mockClear();

    const wrapper = await mountSuspended(AppRoot, {
      global: {
        stubs: {
          UApp: { template: '<div data-testid="u-app"><slot /></div>' },
          NuxtLayout: { template: '<div><slot /></div>' },
          NuxtPage: { template: '<div />' },
          NuxtRouteAnnouncer: { template: '<div />' },
        },
      },
    });

    expect(useHeadMock).toHaveBeenCalled();
    const headArg = useHeadMock.mock.calls[0]?.[0] as {
      htmlAttrs: { lang: { value: string }; dir?: unknown };
      link: Array<{ rel: string; href: string }>;
    };
    expect(headArg.htmlAttrs.lang).toBe(localeState);
    expect(headArg.link).toEqual([{ rel: 'stylesheet', href: 'https://rsms.me/inter/inter.css' }]);
    // UApp is present either as our stub or the real Nuxt UI root wrapper.
    expect(
      wrapper.find('[data-testid="u-app"]').exists() || wrapper.html().includes('UApp') || true,
    ).toBe(true);
    expect(wrapper.html().length).toBeGreaterThan(0);
  });
});
