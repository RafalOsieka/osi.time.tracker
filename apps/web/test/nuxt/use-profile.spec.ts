import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockNuxtImport } from '@nuxt/test-utils/runtime';
import { nextTick, ref } from 'vue';
import { mount } from '@vue/test-utils';
import type { AuthUser } from '../../shared/types/auth';
import { useProfile } from '../../app/composables/use-profile';

const sessionUser = ref<AuthUser | null>(null);
const csrfFetch = vi.hoisted(() => vi.fn());

// oxlint-disable-next-line anti-slop/no-module-mocking -- `$csrfFetch` wraps the Nuxt `$fetch` global without a project DI port
vi.mock('ofetch', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ofetch')>();
  return { ...actual, $fetch: Object.assign(csrfFetch, { create: () => csrfFetch }) };
});

mockNuxtImport('useUserSession', () => () => ({
  user: sessionUser,
  loggedIn: ref(true),
  fetch: vi.fn().mockResolvedValue(undefined),
}));

/** Mounts a component that runs `useProfile` and records the timezone seen during setup. */
function mountProfile() {
  let setupTimeZone = '';
  let composable!: ReturnType<typeof useProfile>;
  mount({
    setup() {
      composable = useProfile();
      setupTimeZone = composable.effective.value.timeZone;
      return {};
    },
    template: '<div />',
  });
  return { composable, setupTimeZone };
}

describe('useProfile', () => {
  beforeEach(() => {
    sessionUser.value = {
      id: 'u1',
      email: 'jan@example.com',
      displayName: 'Jan',
      timezone: 'Europe/Warsaw',
    };
    csrfFetch.mockReset();
  });

  it('uses the stored timezone from the first render with no change after mount', async () => {
    const { composable, setupTimeZone } = mountProfile();
    expect(setupTimeZone).toBe('Europe/Warsaw');

    await nextTick();
    expect(composable.effective.value).toEqual({ timeZone: 'Europe/Warsaw' });
    expect(composable.profile.value).toEqual({ displayName: 'Jan', timezone: 'Europe/Warsaw' });
  });

  it('saves via PATCH and applies the result to the session user', async () => {
    csrfFetch.mockResolvedValue({ displayName: 'Jan Kowalski', timezone: 'Europe/Warsaw' });
    const { composable } = mountProfile();

    await composable.save({ displayName: 'Jan Kowalski' });

    expect(csrfFetch).toHaveBeenCalledWith(
      '/api/user/profile',
      expect.objectContaining({ method: 'PATCH', body: { displayName: 'Jan Kowalski' } }),
    );
    expect(sessionUser.value?.displayName).toBe('Jan Kowalski');
    expect(composable.profile.value?.displayName).toBe('Jan Kowalski');
  });
});
