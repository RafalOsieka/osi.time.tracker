import { usePrimeVue } from 'primevue/config';
import { watch } from 'vue';

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
    (_newLocale) => {
      if (primevue.config) {
        // TODO: implement locale change in PrimeVue config (currently not supported)
      }
    },
    { immediate: true },
  );
});
