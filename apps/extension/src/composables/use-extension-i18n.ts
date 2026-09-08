import { computed, shallowRef } from 'vue';
import { detectLocale, translate, type ExtensionLocale } from '../i18n/translate.js';

/** Browser-locale messages with an explicit override for later settings UI. */
export function useExtensionI18n() {
  const locale = shallowRef<ExtensionLocale>(detectLocale());
  const t = computed(() => {
    const current = locale.value;
    return (key: string) => translate(current, key);
  });

  function setLocale(next: ExtensionLocale) {
    locale.value = next;
  }

  return { locale, t, setLocale };
}
