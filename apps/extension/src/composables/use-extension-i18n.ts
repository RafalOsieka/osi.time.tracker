import { computed, getCurrentScope, onScopeDispose, readonly, shallowRef } from 'vue';
import {
  detectLocale,
  translate,
  type ExtensionLocale,
  type MessageParams,
} from '../i18n/translate.js';
import { LOCALE_MIRROR_KEY } from '../badge/toolbar-badge.js';

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
  return (key: string, params?: MessageParams) => translate(current, key, params);
});

function setLocale(next: ExtensionLocale): void {
  locale.value = next;
  try {
    localStorage.setItem(LOCALE_KEY, next);
    localeErrorKey.value = null;
  } catch {
    localeErrorKey.value = 'app.languageStorageFailed';
  }
  // Best effort: the service worker reads this mirror for the toolbar title.
  try {
    void chrome.storage.local.set({ [LOCALE_MIRROR_KEY]: next }).catch(() => {});
  } catch {
    // No extension APIs outside extension pages (unit tests); the title then follows the browser.
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
