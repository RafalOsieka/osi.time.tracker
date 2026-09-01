import { defineComponent, h } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime';
import { usePageTitle } from '../../app/composables/use-page-title';
import type { MessageParams } from '../../shared/types/message-params';

const { useHeadMock, localeState } = vi.hoisted(() => ({
  useHeadMock: vi.fn<(payload: { title?: { value: string } }) => void>(),
  localeState: { value: 'en' },
}));

const catalogs = {
  en: {
    'timerView.pageTitle': 'Timer',
    'nav.settings': 'Settings',
    'auth.pageTitle': 'Log in',
    'remoteSync.pageTitle': 'Remote Sync – {date}',
    'layout.title': 'OSI Time Tracker',
  },
  pl: {
    'timerView.pageTitle': 'Stoper',
    'nav.settings': 'Ustawienia',
    'auth.pageTitle': 'Logowanie',
    'remoteSync.pageTitle': 'Synchronizacja zdalna – {date}',
    'layout.title': 'OSI Time Tracker',
  },
} as const;

function catalogFor(locale: string) {
  return locale === 'pl' ? catalogs.pl : catalogs.en;
}

function translate(key: string, params?: MessageParams) {
  const table = catalogFor(localeState.value);
  let base = key;
  if (key === 'timerView.pageTitle') base = table['timerView.pageTitle'];
  else if (key === 'nav.settings') base = table['nav.settings'];
  else if (key === 'auth.pageTitle') base = table['auth.pageTitle'];
  else if (key === 'remoteSync.pageTitle') base = table['remoteSync.pageTitle'];
  else if (key === 'layout.title') base = table['layout.title'];
  if (params?.date == null) return base;
  return base.replace('{date}', String(params.date));
}

// oxlint-disable-next-line anti-slop/no-module-mocking -- Nuxt i18n is not injectable in this nuxt test
vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>();
  return {
    ...actual,
    useI18n: () => ({
      t: translate,
      locale: localeState,
    }),
  };
});

mockNuxtImport('useHead', () => useHeadMock);

function titleFromHead(): string {
  return useHeadMock.mock.calls.at(-1)?.[0]?.title?.value ?? '';
}

async function mountTitledPage(key: string, params?: MessageParams) {
  const Page = defineComponent({
    setup() {
      usePageTitle(() => translate(key, params));
      return () => h('div');
    },
  });
  return mountSuspended(Page);
}

describe('document title page segment', () => {
  beforeEach(() => {
    localeState.value = 'en';
    useHeadMock.mockClear();
  });

  it('sets timer, settings, login, and sync titles from catalog keys', async () => {
    await mountTitledPage('timerView.pageTitle');
    expect(titleFromHead()).toBe('Timer');

    await mountTitledPage('nav.settings');
    expect(titleFromHead()).toBe('Settings');

    await mountTitledPage('auth.pageTitle');
    expect(titleFromHead()).toBe('Log in');

    await mountTitledPage('remoteSync.pageTitle', { date: '2026-09-01' });
    expect(titleFromHead()).toBe('Remote Sync – 2026-09-01');
  });

  it('updates both page and brand segments when locale changes', async () => {
    expect(translate('timerView.pageTitle')).toBe('Timer');
    expect(translate('layout.title')).toBe('OSI Time Tracker');

    localeState.value = 'pl';
    expect(translate('timerView.pageTitle')).toBe('Stoper');
    expect(translate('layout.title')).toBe('OSI Time Tracker');
  });
});
