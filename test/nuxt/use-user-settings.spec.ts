import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockNuxtImport } from '@nuxt/test-utils/runtime';
import { nextTick, ref, type Ref } from 'vue';
import { mount } from '@vue/test-utils';
import { browserDateTimeSettings } from '../../app/utils/dateTime';
import { useUserSettings } from '../../app/composables/useUserSettings';

const sessionUser = ref<{
  settings?: { timezone: string | null };
} | null>(null);
const csrfFetch = vi.fn();

/** Isolate Nuxt useState between tests without app-side test hooks. */
const useStateStore = vi.hoisted(() => new Map<string, Ref<string | null>>());

mockNuxtImport('useState', () => {
  return (key: string, init?: () => string | null): Ref<string | null> => {
    let box = useStateStore.get(key);
    if (!box) {
      box = ref(init ? init() : null);
      useStateStore.set(key, box);
    }
    return box;
  };
});

mockNuxtImport('useUserSession', () => () => ({
  user: sessionUser,
  loggedIn: ref(true),
  fetch: vi.fn().mockResolvedValue(undefined),
}));
// oxlint-disable-next-line anti-slop/no-module-mocking -- timezone helpers stubbed for clock control
vi.mock('../../app/utils/dateTime', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../app/utils/dateTime')>()),
  browserDateTimeSettings: vi.fn(() => ({ timeZone: 'America/Los_Angeles' })),
}));

describe('useUserSettings', () => {
  beforeEach(() => {
    sessionUser.value = null;
    csrfFetch.mockReset();
    useStateStore.clear();
    try {
      Object.assign(useNuxtApp(), { $csrfFetch: csrfFetch });
    } catch {
      // The Nuxt app is not available until the test mount initializes it.
    }
  });

  it('uses UTC before mount when no timezone is saved, then upgrades to browser after mount', async () => {
    let beforeMountTimeZone = '';
    let composable!: ReturnType<typeof useUserSettings>;
    mount({
      setup() {
        composable = useUserSettings();
        // onMounted has not run yet during setup — effective must stay hydration-safe.
        beforeMountTimeZone = composable.effective.value.timeZone;
        return {};
      },
      template: '<div />',
    });

    expect(beforeMountTimeZone).toBe('UTC');

    await nextTick();
    expect(composable.settings.value).toEqual({ timezone: null });
    expect(composable.effective.value).toEqual({
      timeZone: 'America/Los_Angeles',
    });
    expect(composable.detectedTimeZone.value).toBe('America/Los_Angeles');
    expect(browserDateTimeSettings).toHaveBeenCalled();
    expect(csrfFetch).not.toHaveBeenCalled();
  });

  it('prefers saved settings over browser detection with no post-mount upgrade', async () => {
    sessionUser.value = { settings: { timezone: 'Europe/Warsaw' } };

    let composable!: ReturnType<typeof useUserSettings>;
    mount({
      setup() {
        composable = useUserSettings();
        return {};
      },
      template: '<div />',
    });
    await nextTick();

    expect(composable.effective.value).toEqual({ timeZone: 'Europe/Warsaw' });
    expect(csrfFetch).not.toHaveBeenCalled();
  });

  it('does not auto-persist timezone when unset', async () => {
    let composable!: ReturnType<typeof useUserSettings>;
    mount({
      setup() {
        composable = useUserSettings();
        return {};
      },
      template: '<div />',
    });
    await nextTick();

    expect(composable.settings.value.timezone).toBeNull();
    expect(csrfFetch).not.toHaveBeenCalled();
  });
});
