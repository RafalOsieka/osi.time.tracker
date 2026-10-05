import { describe, expect, it, vi } from 'vite-plus/test';
import SuggestionList from '../../src/ui/SuggestionList.vue';
import { useExtensionI18n } from '../../src/composables/use-extension-i18n.js';
import { suggestionId, type DestinationSuggestion } from '../../src/suggestions/suggestions.js';
import { currentWebsiteOffer, readSetupFocus } from '../../src/ui/open-setup.js';
import { renderWithUi } from './render-with-ui.js';

vi.hoisted(() => {
  const storage = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
  });
});

const suggestion = (origin: string): DestinationSuggestion => ({
  websiteOrigin: 'https://time.example.com',
  provider: 'redmine',
  origin,
  basePath: '/team',
  suggestedAt: '2026-10-05T10:00:00.000Z',
});

describe('suggestion list', () => {
  it('lets the setup page approve in place and warns about plain HTTP trackers', async () => {
    useExtensionI18n().setLocale('en');
    const plain = suggestion('http://rm.internal');
    const html = await renderWithUi(SuggestionList, {
      suggestions: [plain, suggestion('https://rm.example.com')],
      disabled: false,
      mode: 'setup',
      highlightId: suggestionId(plain),
    });
    expect(html).toContain(`data-testid="approve-suggestion-${suggestionId(plain)}"`);
    expect(html).toContain('requested by time.example.com');
    expect(html.match(/HTTP destinations send tracker credentials/g)).toHaveLength(1);
    expect(html).toMatch(/class="[^"]*ring-primary[^"]*" data-testid="suggestion-/);
  });

  it('only dismisses or hands over to setup in the popup', async () => {
    useExtensionI18n().setLocale('pl');
    const item = suggestion('https://rm.example.com');
    const html = await renderWithUi(SuggestionList, {
      suggestions: [item],
      disabled: false,
      mode: 'popup',
    });
    expect(html).not.toContain('data-testid="approve-suggestion-');
    expect(html).toContain(`data-testid="review-suggestion-${suggestionId(item)}"`);
    expect(html).toContain('Zatwierdź w konfiguracji');
  });

  it('renders nothing without suggestions', async () => {
    const html = await renderWithUi(SuggestionList, {
      suggestions: [],
      disabled: false,
      mode: 'popup',
    });
    expect(html).not.toContain('data-testid="suggestions"');
  });

  it('reads the focus the popup put in the setup URL', () => {
    expect(readSetupFocus('?suggestion=a%7Cb')).toEqual({ suggestion: 'a|b', website: undefined });
    expect(readSetupFocus('')).toEqual({ website: undefined, suggestion: undefined });
  });
});

describe('current website offer', () => {
  const approved = ['https://time.example.com'];

  it('offers an unapproved HTTPS origin, without its path', () => {
    expect(currentWebsiteOffer('https://new.example.com/timer?x=1', approved)).toBe(
      'https://new.example.com',
    );
  });

  it('offers loopback HTTP for local development', () => {
    expect(currentWebsiteOffer('http://localhost:3000/', approved)).toBe('http://localhost:3000');
  });

  it.each([
    ['an approved origin', 'https://time.example.com/reports'],
    ['a browser page', 'chrome://extensions/'],
    ['a file', 'file:///C:/notes.html'],
    ['non-loopback HTTP', 'http://time.internal/'],
    ['no readable address', undefined],
  ])('makes no offer for %s', (_name, url) => {
    expect(currentWebsiteOffer(url, approved)).toBeNull();
  });
});
