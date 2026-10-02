import type { ProfileDto, UpdateProfileDto } from '../../shared/types/profile';

/**
 * The signed-in user's profile from the session, plus a save helper.
 *
 * `effective.timeZone` is the stored timezone (workspace-settings REQ-398), so
 * SSR and the first client paint format times identically. `UTC` only covers the
 * logged-out case, where no session user exists.
 */
export function useProfile() {
  const { user } = useUserSession();
  const { $csrfFetch } = useNuxtApp();

  const profile = computed<ProfileDto | null>(() =>
    user.value ? { displayName: user.value.displayName, timezone: user.value.timezone } : null,
  );

  const effective = computed(() => ({ timeZone: user.value?.timezone ?? 'UTC' }));

  /** PATCHes the profile and applies the result to the session user. */
  async function save(update: UpdateProfileDto) {
    const updated = await $csrfFetch<ProfileDto>('/api/user/profile', {
      method: 'PATCH',
      body: update,
    });
    if (user.value) Object.assign(user.value, updated);
    return updated;
  }

  return { profile, effective, save };
}
