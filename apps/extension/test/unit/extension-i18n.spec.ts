import { afterEach, expect, it, vi } from 'vitest';
import { effectScope } from 'vue';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

it('updates open pages on preference changes and removes its listener on disposal', async () => {
  vi.stubGlobal('navigator', { language: 'en' });
  const window = new EventTarget();
  vi.stubGlobal('window', window);
  let saved = 'en';
  const storage = {
    getItem: () => saved,
    setItem: (_key: string, value: string) => {
      saved = value;
    },
  };
  vi.stubGlobal('localStorage', storage);
  const { useExtensionI18n } = await import('../../src/composables/use-extension-i18n.js');
  const scope = effectScope();
  const page = scope.run(() => useExtensionI18n())!;
  saved = 'pl';
  window.dispatchEvent(
    Object.assign(new Event('storage'), { key: 'osi-extension-locale', storageArea: storage }),
  );
  expect(page.locale.value).toBe('pl');
  scope.stop();
  saved = 'en';
  window.dispatchEvent(
    Object.assign(new Event('storage'), { key: 'osi-extension-locale', storageArea: storage }),
  );
  expect(page.locale.value).toBe('pl');
});

it('reports failed preference persistence without breaking translation', async () => {
  vi.stubGlobal('localStorage', {
    getItem: () => 'en',
    setItem: () => {
      throw new Error('storage unavailable');
    },
  });
  const { useExtensionI18n } = await import('../../src/composables/use-extension-i18n.js');
  const page = useExtensionI18n();
  page.setLocale('pl');
  expect(page.t.value('approvals.addWebsite')).toBe('Zatwierdź witrynę');
  expect(page.localeErrorKey.value).toBe('app.languageStorageFailed');
});

it('shares the chosen locale between components and retains it when reopened', async () => {
  vi.stubGlobal('navigator', { language: 'en' });
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  });
  const { useExtensionI18n } = await import('../../src/composables/use-extension-i18n.js');
  const header = useExtensionI18n();
  const form = useExtensionI18n();
  header.setLocale('pl');
  expect(form.t.value('approvals.addWebsite')).toBe('Zatwierdź witrynę');
  vi.resetModules();
  const reopened = await import('../../src/composables/use-extension-i18n.js');
  expect(reopened.useExtensionI18n().locale.value).toBe('pl');
});
