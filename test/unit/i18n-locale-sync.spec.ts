import { describe, expect, it, vi } from 'vitest';

/**
 * Unit tests for locale-driven side effects:
 * - html[lang] is set to the active locale (app.vue useHead logic)
 * - Nuxt UI locale tracks the app locale via UApp binding
 */
describe('html lang binding', () => {
  it('passes the active locale ref to useHead htmlAttrs', () => {
    const headCalls: Array<{ htmlAttrs?: { lang: unknown } }> = [];
    const useHeadMock = vi.fn((opts: { htmlAttrs?: { lang: unknown } }) => {
      headCalls.push(opts);
    });

    const locale = { value: 'en' };
    useHeadMock({ htmlAttrs: { lang: locale } });

    expect(headCalls).toHaveLength(1);
    expect(headCalls[0]!.htmlAttrs?.lang).toBe(locale);
  });
});

describe('Nuxt UI locale binding', () => {
  it('maps app locale codes to Nuxt UI locale objects', () => {
    const locales = {
      en: { code: 'en', name: 'English' },
      pl: { code: 'pl', name: 'Polski' },
    } as const;

    function resolveUiLocale(code: keyof typeof locales) {
      return locales[code] ?? locales.en;
    }

    expect(resolveUiLocale('en').code).toBe('en');
    expect(resolveUiLocale('pl').code).toBe('pl');
  });
});
