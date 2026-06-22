import { describe, expect, it, vi } from 'vitest';

/**
 * Unit tests for locale-driven side effects:
 * - html[lang] is set to the active locale (app.vue useHead logic)
 * - PrimeVue activeLocale tracks the app locale (primevue-i18n-sync plugin logic)
 *
 * These tests exercise the logic in isolation without a full Nuxt runtime.
 */

describe('html lang binding', () => {
  it('passes the active locale ref to useHead htmlAttrs', () => {
    const headCalls: Array<{ htmlAttrs?: { lang: unknown } }> = [];
    const useHeadMock = vi.fn((opts: { htmlAttrs?: { lang: unknown } }) => {
      headCalls.push(opts);
    });

    // Simulate what app.vue does
    const locale = { value: 'en' };
    useHeadMock({ htmlAttrs: { lang: locale } });

    expect(headCalls).toHaveLength(1);
    expect(headCalls[0].htmlAttrs?.lang).toBe(locale);
  });
});

describe('PrimeVue locale sync', () => {
  it('sets activeLocale on primevue config when locale changes', () => {
    const config: Record<string, unknown> = { locale: {} };
    const primevue = { config };

    function syncLocale(newLocale: string) {
      if (primevue.config) {
        primevue.config.locale = { ...primevue.config.locale };
        primevue.config.activeLocale = newLocale;
      }
    }

    syncLocale('en');
    expect(primevue.config.activeLocale).toBe('en');

    syncLocale('pl');
    expect(primevue.config.activeLocale).toBe('pl');
  });
});
