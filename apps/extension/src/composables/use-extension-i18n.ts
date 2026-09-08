import { computed, getCurrentScope, onScopeDispose, readonly, shallowRef } from 'vue';
import { detectLocale, translate, type ExtensionLocale } from '../i18n/translate.js';

const LOCALE_KEY = 'osi-extension-locale';
const localeErrorKey = shallowRef<string | null>(null);

function readLocale(): ExtensionLocale {
  try {
    const saved = localStorage.getItem(LOCALE_KEY);
    if (saved === 'en' || saved === 'pl') return saved;
  } catch {
    localeErrorKey.value = 'app.languageStorageFailed';
  }
  return detectLocale();
}

const locale = shallowRef<ExtensionLocale>(readLocale());
const t = computed(() => {
  const current = locale.value;
  return (key: string) => translate(current, key);
});

function setLocale(next: ExtensionLocale): void {
  locale.value = next;
  try {
    localStorage.setItem(LOCALE_KEY, next);
    localeErrorKey.value = null;
  } catch {
    localeErrorKey.value = 'app.languageStorageFailed';
  }
}

/** One locale per extension page, persisted and synchronized across setup and popup pages. */
export function useExtensionI18n() {
  if (getCurrentScope() && globalThis.window !== undefined) {
    const onStorage = (event: StorageEvent) => {
      if (event.storageArea !== localStorage || (event.key !== null && event.key !== LOCALE_KEY))
        return;
      locale.value = readLocale();
    };
    window.addEventListener('storage', onStorage);
    onScopeDispose(() => window.removeEventListener('storage', onStorage));
  }
  return { locale: readonly(locale), t, setLocale, localeErrorKey: readonly(localeErrorKey) };
}
