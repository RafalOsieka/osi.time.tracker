import type { UserSettingsDto, UpdateUserSettingsDto } from '../../shared/types/user-settings';
import { browserDateTimeSettings } from '../utils/dateTime';

/** Nuxt payload key for the once-per-session browser zone detection cache. */
const BROWSER_TIME_ZONE_STATE_KEY = 'user-settings-browser-time-zone';

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
  const browserTimeZone = useState<string | null>(BROWSER_TIME_ZONE_STATE_KEY, () => null);

  onMounted(() => {
    if (browserTimeZone.value == null) {
      browserTimeZone.value = browserDateTimeSettings().timeZone;
    }
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
