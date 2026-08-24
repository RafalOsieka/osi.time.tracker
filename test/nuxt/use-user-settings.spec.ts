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
const useStateStore = vi.hoisted(() => new Map<string, Ref<unknown>>());

mockNuxtImport('useState', () => {
  return <T>(key: string, init?: () => T): Ref<T> => {
    if (!useStateStore.has(key)) {
      useStateStore.set(key, ref(init ? init() : null) as Ref<unknown>);
    }
    return useStateStore.get(key) as Ref<T>;
  };
});

mockNuxtImport('useUserSession', () => () => ({
  user: sessionUser,
  loggedIn: ref(true),
  fetch: vi.fn().mockResolvedValue(undefined),
}));
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
      // oxlint-disable-next-line typescript/no-explicit-any -- Nuxt $csrfFetch is not on the typed app payload in tests
      (useNuxtApp() as any).$csrfFetch = csrfFetch;
    } catch {
      // The Nuxt app is not available until the test mount initializes it.
    }
  });

  it('uses UTC before mount when no timezone is saved, then upgrades to browser after mount', async () => {
    let beforeMountTimeZone = '';
    const wrapper = mount({
      setup() {
        const settings = useUserSettings();
        // onMounted has not run yet during setup — effective must stay hydration-safe.
        beforeMountTimeZone = settings.effective.value.timeZone;
        return { settings };
      },
      template: '<div />',
    });

    expect(beforeMountTimeZone).toBe('UTC');

    const composable = wrapper.vm.settings as unknown as ReturnType<typeof useUserSettings>;
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

    const wrapper = mount({
      setup() {
        const settings = useUserSettings();
        return { settings };
      },
      template: '<div />',
    });
    const composable = wrapper.vm.settings as unknown as ReturnType<typeof useUserSettings>;
    await nextTick();

    expect(composable.effective.value).toEqual({ timeZone: 'Europe/Warsaw' });
    expect(csrfFetch).not.toHaveBeenCalled();
  });

  it('does not auto-persist timezone when unset', async () => {
    const wrapper = mount({
      setup() {
        const settings = useUserSettings();
        return { settings };
      },
      template: '<div />',
    });
    const composable = wrapper.vm.settings as unknown as ReturnType<typeof useUserSettings>;
    await nextTick();

    expect(composable.settings.value.timezone).toBeNull();
    expect(csrfFetch).not.toHaveBeenCalled();
  });
});
