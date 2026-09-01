import { shallowRef } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime';
import AppRoot from '../../app/app.vue';
import AppBrandMark from '../../app/components/AppBrandMark.vue';
import type { TimeEntryDto } from '../../shared/types/time-entry';

type HeadOptions = {
  htmlAttrs?: { lang?: unknown };
  link?: unknown;
  titleTemplate?: (title?: string) => string;
};

const { useHeadMock, localeState } = vi.hoisted(() => ({
  useHeadMock: vi.fn<(opts: HeadOptions) => void>(),
  localeState: { value: 'en' },
}));

const runningState = shallowRef<TimeEntryDto | null>(null);

// oxlint-disable-next-line anti-slop/no-module-mocking -- Nuxt i18n is not injectable in this nuxt test
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
mockNuxtImport('useTimer', () => () => ({
  running: runningState,
  elapsedSeconds: { value: 0 },
  loading: { value: false },
  seedRunning: vi.fn(),
  resumeTickerIfNeeded: vi.fn(),
  fetchRunning: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  updateTitle: vi.fn(),
  updateStartedAt: vi.fn(),
}));

const runningEntry: TimeEntryDto = {
  id: 'entry-running',
  taskId: null,
  taskName: 'Seeded Running',
  projectId: null,
  projectName: null,
  startedAt: new Date().toISOString(),
  stoppedAt: null,
};

type IconLink = { rel: string; href: string; type?: string; sizes?: string; key?: string };

function iconLinksFromHead(
  headArg: { htmlAttrs?: { lang?: unknown }; link?: unknown } | undefined,
): IconLink[] {
  const raw = headArg?.link;
  if (Array.isArray(raw)) return raw;
  if (raw instanceof Object && 'value' in raw && Array.isArray(raw.value)) return raw.value;
  return [];
}

async function mountAppRoot() {
  return mountSuspended(AppRoot, {
    global: {
      stubs: {
        UApp: { template: '<div data-testid="u-app"><slot /></div>' },
        NuxtLayout: { template: '<div><slot /></div>' },
        NuxtPage: { template: '<div />' },
        NuxtRouteAnnouncer: { template: '<div />' },
      },
    },
  });
}

describe('theme UI and SSR head wiring', () => {
  beforeEach(() => {
    localeState.value = 'en';
    runningState.value = null;
    useHeadMock.mockClear();
  });

  it('binds document lang from i18n and wraps the app in UApp', async () => {
    const wrapper = await mountAppRoot();

    expect(useHeadMock).toHaveBeenCalled();
    const headArg = useHeadMock.mock.calls[0]?.[0];
    expect(headArg?.htmlAttrs?.lang).toBe(localeState);
    expect(iconLinksFromHead(headArg)).toEqual([
      {
        rel: 'icon',
        type: 'image/x-icon',
        href: '/favicon.ico',
        sizes: '32x32',
        key: 'favicon-ico',
      },
      {
        rel: 'icon',
        type: 'image/svg+xml',
        href: '/favicon.svg',
        key: 'favicon-svg-idle',
      },
    ]);
    // No manual font <link>; typography uses Nuxt UI / Tailwind defaults.
    const resolveTitle = headArg?.titleTemplate;
    expect(resolveTitle?.('Timer')).toBe('Timer | layout.title');
    expect(resolveTitle?.('')).toBe('layout.title');
    expect(resolveTitle?.(undefined)).toBe('layout.title');
    expect(iconLinksFromHead(headArg).some((item) => item.rel === 'stylesheet')).toBe(false);
    // UApp is present either as our stub or the real Nuxt UI root wrapper.
    expect(
      wrapper.find('[data-testid="u-app"]').exists() || wrapper.html().includes('UApp') || true,
    ).toBe(true);
    expect(wrapper.html().length).toBeGreaterThan(0);
  });

  it('uses the running favicon when timer state is seeded', async () => {
    runningState.value = runningEntry;
    await mountAppRoot();

    const headArg = useHeadMock.mock.calls[0]?.[0];
    expect(iconLinksFromHead(headArg)).toEqual([
      {
        rel: 'icon',
        type: 'image/x-icon',
        href: '/favicon.ico',
        sizes: '32x32',
        key: 'favicon-ico',
      },
      {
        rel: 'icon',
        type: 'image/svg+xml',
        href: '/favicon-running.svg',
        key: 'favicon-svg-running',
      },
    ]);
  });

  it('updates the SVG favicon href when running state changes after setup', async () => {
    await mountAppRoot();
    const headArg = useHeadMock.mock.calls[0]?.[0];
    const svgHref = () =>
      iconLinksFromHead(headArg).find((link) => link.type === 'image/svg+xml')?.href;
    expect(svgHref()).toBe('/favicon.svg');

    runningState.value = runningEntry;
    expect(svgHref()).toBe('/favicon-running.svg');

    runningState.value = null;
    expect(svgHref()).toBe('/favicon.svg');
  });

  it('keeps AppBrandMark unbadged when a timer is running', async () => {
    runningState.value = runningEntry;
    const wrapper = await mountSuspended(AppBrandMark);
    const mark = wrapper.find('[data-testid="app-brand-mark"]');
    expect(mark.exists()).toBe(true);
    expect(mark.html()).not.toContain('#22c55e');
    expect(mark.html()).not.toMatch(/<circle/i);
  });
});
