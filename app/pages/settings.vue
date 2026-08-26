<script setup lang="ts">
type ColorModePreference = 'light' | 'dark' | 'system';
type AppLocale = 'en' | 'pl';

const { t, locale, setLocale } = useI18n();
const colorMode = useColorMode();
const toast = useAppToast();
const { settings, detectedTimeZone, save } = useUserSettings();

/**
 * Prefer controls stay hidden until client-side sources settle:
 * - color-mode cookie/local preference (`unknown` until app:mounted)
 * - browser timezone detection (UTC fallback until useUserSettings onMounted)
 * Otherwise USelect shows system/UTC defaults and then jumps.
 */
const preferencesReady = ref(false);

const timezone = ref(settings.value.timezone ?? detectedTimeZone.value);

const timezones = Intl.supportedValuesOf('timeZone');
const localeItems = computed(
  () =>
    [
      { label: t('locale.en'), value: 'en' },
      { label: t('locale.pl'), value: 'pl' },
    ] satisfies Array<{ label: string; value: AppLocale }>,
);
const themeItems = computed(
  () =>
    [
      { label: t('theme.light'), value: 'light' },
      { label: t('theme.dark'), value: 'dark' },
      { label: t('theme.system'), value: 'system' },
    ] satisfies Array<{ label: string; value: ColorModePreference }>,
);

const selectedLocale = computed({
  get: (): AppLocale => (locale.value === 'pl' ? 'pl' : 'en'),
  set: (value: AppLocale) => {
    void setLocale(value);
  },
});

const selectedTheme = computed({
  get: (): ColorModePreference => {
    const preference = colorMode.preference;
    return preference === 'light' || preference === 'dark' || preference === 'system'
      ? preference
      : 'system';
  },
  set: (value: ColorModePreference) => {
    colorMode.preference = value;
  },
});

function syncLocalAccountFields() {
  timezone.value = settings.value.timezone ?? detectedTimeZone.value;
}

function waitForColorMode(): Promise<void> {
  if (!colorMode.unknown) return Promise.resolve();
  return new Promise((resolve) => {
    const stop = watch(
      () => colorMode.unknown,
      (unknown) => {
        if (!unknown) {
          stop();
          resolve();
        }
      },
      { immediate: true },
    );
    // Safety: never block the form if the flag never clears.
    window.setTimeout(() => {
      stop();
      resolve();
    }, 1500);
  });
}

onMounted(async () => {
  // useUserSettings registers onMounted first; nextTick lets browser TZ apply.
  await nextTick();
  syncLocalAccountFields();
  await waitForColorMode();
  syncLocalAccountFields();
  preferencesReady.value = true;
});

// Keep local controls in sync when session settings change (e.g. after a successful PATCH).
watch(settings, () => {
  if (!preferencesReady.value) return;
  syncLocalAccountFields();
});

// After mount, unsaved timezone upgrades from UTC fallback to browser-detected.
watch(detectedTimeZone, () => {
  if (!preferencesReady.value || settings.value.timezone) return;
  timezone.value = detectedTimeZone.value;
});

/** Latest-write-wins: only the most recent PATCH result is applied if requests overlap. */
let accountPatchGeneration = 0;

async function persistTimezone(value: string, previousTimezone: string) {
  const generation = ++accountPatchGeneration;
  try {
    await save({ timezone: value });
  } catch {
    if (generation === accountPatchGeneration) {
      timezone.value = previousTimezone;
      toast.error(t('settings.saveError'));
    }
  }
}

function onTimezoneChange(value: string | undefined) {
  if (!value || value === (settings.value.timezone ?? detectedTimeZone.value)) return;
  const previousTimezone = settings.value.timezone ?? detectedTimeZone.value;
  timezone.value = value;
  void persistTimezone(value, previousTimezone);
}
</script>

<template>
  <div data-testid="page-settings" class="mx-auto max-w-xl space-y-4">
    <h1 class="text-2xl font-semibold">{{ t('nav.settings') }}</h1>

    <div
      v-if="!preferencesReady"
      class="grid gap-4"
      aria-busy="true"
      data-testid="settings-preferences-loading"
    >
      <USkeleton class="h-14 w-full" />
      <USkeleton class="h-14 w-full" />
      <USkeleton class="h-14 w-full" />
    </div>

    <div v-else class="grid gap-4" data-testid="settings-preferences">
      <UFormField
        :label="t('settings.language')"
        name="language"
        data-testid="settings-language-field"
      >
        <USelect
          id="settings-language"
          v-model="selectedLocale"
          :items="localeItems"
          value-key="value"
          label-key="label"
          class="w-full"
          data-testid="settings-language"
        />
      </UFormField>

      <UFormField :label="t('settings.theme')" name="theme" data-testid="settings-theme-field">
        <USelect
          id="settings-theme"
          v-model="selectedTheme"
          :items="themeItems"
          value-key="value"
          label-key="label"
          class="w-full"
          data-testid="settings-theme"
        />
      </UFormField>

      <UFormField
        :label="t('settings.timezone')"
        name="timezone"
        data-testid="settings-timezone-field"
      >
        <USelectMenu
          id="settings-timezone"
          :model-value="timezone"
          :items="timezones"
          searchable
          class="w-full"
          data-testid="settings-timezone"
          @update:model-value="onTimezoneChange"
        />
        <template v-if="!settings.timezone" #hint>
          {{ t('settings.detectedTimezone', { timezone: detectedTimeZone }) }}
        </template>
      </UFormField>
    </div>
  </div>
</template>
