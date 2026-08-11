import type { UserSettingsDto, UpdateUserSettingsDto } from '../../shared/types/user-settings';
import { browserDateTimeSettings } from '../utils/dateTime';

/**
 * Account settings plus hydration-safe effective timezone.
 *
 * Effective display timezone:
 * 1. Saved timezone when present
 * 2. Otherwise `UTC` on SSR and until client mount (stable first paint)
 * 3. After mount with no saved timezone → browser-detected zone (reactive upgrade)
 *
 * Browser detection is never auto-persisted.
 */
export function useUserSettings() {
  const { user } = useUserSession();
  const { $csrfFetch } = useNuxtApp();

  /** Set only after client mount so SSR and first client paint match (`UTC` fallback). */
  const browserTimeZone = ref<string | null>(null);

  onMounted(() => {
    browserTimeZone.value = browserDateTimeSettings().timeZone;
  });

  const settings = computed<UserSettingsDto>(() => ({
    timezone: user.value?.settings?.timezone ?? null,
    weekStart: user.value?.settings?.weekStart ?? 'monday',
  }));

  const detectedTimeZone = computed(() => browserTimeZone.value ?? 'UTC');

  const effective = computed(() => ({
    timeZone: settings.value.timezone ?? browserTimeZone.value ?? 'UTC',
    weekStart: settings.value.weekStart,
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
