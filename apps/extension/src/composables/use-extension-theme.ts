import { getCurrentScope, onScopeDispose, readonly, shallowRef } from 'vue';

/** Also read by `public/theme-init.js`, which applies the theme before first paint. */
const THEME_KEY = 'osi-extension-theme';

export type ExtensionTheme = 'light' | 'dark';

/** Light unless dark was explicitly stored; unreadable storage or unknown values stay light. */
function readTheme(): ExtensionTheme {
  try {
    return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

function applyTheme(next: ExtensionTheme): void {
  globalThis.document?.documentElement.classList.toggle('dark', next === 'dark');
}

const theme = shallowRef<ExtensionTheme>(readTheme());

function setTheme(next: ExtensionTheme): void {
  theme.value = next;
  applyTheme(next);
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch {
    // The choice still applies to this page; it just will not survive a reload.
  }
}

/** Light/dark theme shared by the popup and setup pages; follows changes made in other pages. */
export function useExtensionTheme() {
  applyTheme(theme.value);
  if (getCurrentScope() && globalThis.window !== undefined) {
    const onStorage = (event: StorageEvent) => {
      if (event.storageArea !== localStorage || (event.key !== null && event.key !== THEME_KEY))
        return;
      theme.value = readTheme();
      applyTheme(theme.value);
    };
    window.addEventListener('storage', onStorage);
    onScopeDispose(() => window.removeEventListener('storage', onStorage));
  }
  return { theme: readonly(theme), setTheme };
}
