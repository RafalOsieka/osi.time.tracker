import type { UserSettingsDto, UpdateUserSettingsDto } from '../../shared/types/user-settings';
import { browserDateTimeSettings } from '../utils/dateTime';

export function useUserSettings() {
  const { user } = useUserSession();
  const { $csrfFetch } = useNuxtApp();
  const detected = import.meta.client ? browserDateTimeSettings().timeZone : 'UTC';
  const settings = computed<UserSettingsDto>(() => ({
    timezone: user.value?.settings?.timezone ?? null,
    weekStart: user.value?.settings?.weekStart ?? 'monday',
  }));
  const effective = computed(() => ({
    timeZone: settings.value.timezone ?? detected,
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

  return { settings, effective, detectedTimeZone: detected, save };
}
