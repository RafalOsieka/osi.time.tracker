import type { UserSettingsDto, UpdateUserSettingsDto } from '../../shared/types/user-settings';

/**
 * Account settings plus hydration-safe effective timezone.
 *
 * Effective display timezone:
 * 1. Saved timezone when present
 * 2. Otherwise `UTC` on SSR and until client mount (stable first paint)
 * 3. After mount with no saved timezone → browser-detected zone (reactive upgrade)
 *
 * Browser detection is never auto-persisted. Detected zone is stored in Nuxt
 * `useState` so client navigations reuse it without flashing `UTC` again.
 */
export function useUserSettings() {
  const { user } = useUserSession();
  const { $csrfFetch } = useNuxtApp();
  const browserTimeZone = useState<string | null>('user-settings-browser-time-zone', () => null);

  onMounted(() => {
    if (browserTimeZone.value == null) {
      browserTimeZone.value = browserDateTimeSettings().timeZone;
    }
  });

  const settings = computed<UserSettingsDto>(() => ({
    timezone: user.value?.settings?.timezone ?? null,
  }));

  const detectedTimeZone = computed(() => browserTimeZone.value ?? 'UTC');

  const effective = computed(() => ({
    timeZone: settings.value.timezone ?? browserTimeZone.value ?? 'UTC',
  }));

  async function save(update: UpdateUserSettingsDto) {
    const updated = await $csrfFetch<UserSettingsDto>('/api/user/settings', {
      method: 'PATCH',
      body: update,
    });
    if (user.value) user.value.settings = updated;
    return updated;
  }

  return { settings, effective, detectedTimeZone, save };
}
