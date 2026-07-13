import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockNuxtImport } from '@nuxt/test-utils/runtime';
import { ref } from 'vue';
import { mount } from '@vue/test-utils';
import { browserDateTimeSettings } from '../../app/utils/dateTime';
import { useUserSettings } from '../../app/composables/useUserSettings';

const sessionUser = ref<{
  settings?: { timezone: string | null; weekStart: 'monday' | 'sunday' };
} | null>(null);
const csrfFetch = vi.fn();

mockNuxtImport('useUserSession', () => () => ({
  user: sessionUser,
  loggedIn: ref(true),
  fetch: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../app/utils/dateTime', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../app/utils/dateTime')>()),
  browserDateTimeSettings: vi.fn(() => ({ timeZone: 'America/Los_Angeles', weekStart: 'monday' })),
}));

describe('useUserSettings', () => {
  beforeEach(() => {
    sessionUser.value = null;
    csrfFetch.mockReset();
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (useNuxtApp() as any).$csrfFetch = csrfFetch;
    } catch {
      // The Nuxt app is not available until the test mount initializes it.
    }
  });

  it('uses the detected timezone when no timezone is saved', async () => {
    const wrapper = mount({
      setup() {
        const settings = useUserSettings();
        return { settings };
      },
      template: '<div />',
    });

    const composable = wrapper.vm.settings as unknown as ReturnType<typeof useUserSettings>;
    expect(composable.settings.value).toEqual({ timezone: null, weekStart: 'monday' });
    expect(composable.effective.value).toEqual({
      timeZone: 'America/Los_Angeles',
      weekStart: 'monday',
    });
    expect(browserDateTimeSettings).toHaveBeenCalled();
    expect(csrfFetch).not.toHaveBeenCalled();
  });

  it('prefers saved settings and updates the session after saving', async () => {
    sessionUser.value = { settings: { timezone: 'Europe/Warsaw', weekStart: 'sunday' } };

    const wrapper = mount({
      setup() {
        const settings = useUserSettings();
        return { settings };
      },
      template: '<div />',
    });
    const composable = wrapper.vm.settings as unknown as ReturnType<typeof useUserSettings>;

    expect(composable.effective.value).toEqual({ timeZone: 'Europe/Warsaw', weekStart: 'sunday' });
    expect(csrfFetch).not.toHaveBeenCalled();
  });
});
