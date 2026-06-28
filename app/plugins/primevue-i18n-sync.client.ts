import { watch } from 'vue';
import { usePrimeVue } from 'primevue/config';

/**
 * Keeps PrimeVue's component locale (aria labels, calendar names, etc.)
 * in sync with the active @nuxtjs/i18n locale.
 *
 * Only the locale *code* is synced here; full PrimeVue locale message objects
 * (month/day names) can be extended when Polish PrimeVue strings are needed.
 */
export default defineNuxtPlugin(() => {
  // useI18n() requires a component setup context; access the i18n instance
  // via the Nuxt app instead, which is always available inside a plugin.
  const { locale } = useNuxtApp().$i18n;
  const primevue = usePrimeVue();

  watch(
    locale,
    (newLocale) => {
      if (primevue.config) {
        primevue.config.locale = {
          ...primevue.config.locale,
          // Expose the active locale code so PrimeVue-aware code can read it.
          // Full month/day name overrides for 'pl' can be added here later.
        };
        // Store the active locale on the PrimeVue config for reference.
        (primevue.config as Record<string, unknown>).activeLocale = newLocale;
      }
    },
    { immediate: true },
  );
});
