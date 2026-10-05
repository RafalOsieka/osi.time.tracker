import { afterEach, expect, it, vi } from 'vite-plus/test';
import { effectScope } from 'vue';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

function stubDocument() {
  const classes = new Set<string>();
  vi.stubGlobal('document', {
    documentElement: {
      classList: {
        toggle: (name: string, force: boolean) =>
          force ? classes.add(name) : classes.delete(name),
      },
    },
  });
  return classes;
}

function stubStorage(initial: string | null) {
  let saved = initial;
  const storage = {
    getItem: () => saved,
    setItem: (_key: string, value: string) => {
      saved = value;
    },
  };
  vi.stubGlobal('localStorage', storage);
  return { storage, read: () => saved, write: (value: string) => (saved = value) };
}

async function loadTheme() {
  return (await import('../../src/composables/use-extension-theme.js')).useExtensionTheme;
}

it('defaults to light and ignores unknown stored values', async () => {
  const classes = stubDocument();
  stubStorage('system');
  const useExtensionTheme = await loadTheme();
  expect(useExtensionTheme().theme.value).toBe('light');
  expect(classes.has('dark')).toBe(false);
});

it('falls back to light when storage cannot be read or written', async () => {
  const classes = stubDocument();
  vi.stubGlobal('localStorage', {
    getItem: () => {
      throw new Error('storage unavailable');
    },
    setItem: () => {
      throw new Error('storage unavailable');
    },
  });
  const useExtensionTheme = await loadTheme();
  const page = useExtensionTheme();
  expect(page.theme.value).toBe('light');
  page.setTheme('dark');
  expect(page.theme.value).toBe('dark');
  expect(classes.has('dark')).toBe(true);
});

it('persists dark and applies it on the next page load', async () => {
  const classes = stubDocument();
  const stored = stubStorage(null);
  const useExtensionTheme = await loadTheme();
  useExtensionTheme().setTheme('dark');
  expect(stored.read()).toBe('dark');
  expect(classes.has('dark')).toBe(true);

  vi.resetModules();
  const reopenedClasses = stubDocument();
  const reopened = await loadTheme();
  expect(reopened().theme.value).toBe('dark');
  expect(reopenedClasses.has('dark')).toBe(true);
});

it('follows a theme change made in another page until disposed', async () => {
  const classes = stubDocument();
  const stored = stubStorage('light');
  const window = new EventTarget();
  vi.stubGlobal('window', window);
  const useExtensionTheme = await loadTheme();
  const scope = effectScope();
  const page = scope.run(() => useExtensionTheme())!;
  const changed = () =>
    window.dispatchEvent(
      Object.assign(new Event('storage'), {
        key: 'osi-extension-theme',
        storageArea: stored.storage,
      }),
    );

  stored.write('dark');
  changed();
  expect(page.theme.value).toBe('dark');
  expect(classes.has('dark')).toBe(true);

  scope.stop();
  stored.write('light');
  changed();
  expect(page.theme.value).toBe('dark');
});
