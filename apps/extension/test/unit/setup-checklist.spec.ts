import { describe, expect, it, vi } from 'vite-plus/test';
import SetupChecklist from '../../src/ui/SetupChecklist.vue';
import { useExtensionI18n } from '../../src/composables/use-extension-i18n.js';
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

function stepState(html: string, step: string): string | undefined {
  return new RegExp(`data-testid="checklist-${step}" data-state="(\\w+)"`).exec(html)?.[1];
}

describe('setup checklist', () => {
  it('starts at the website step on a fresh install, with the action for that step', async () => {
    useExtensionI18n().setLocale('en');
    const html = await renderWithUi(SetupChecklist, {
      websiteDone: false,
      trackerDone: false,
      mode: 'popup',
    });
    expect(stepState(html, 'website')).toBe('current');
    expect(stepState(html, 'tracker')).toBe('todo');
    expect(stepState(html, 'direct')).toBe('info');
    expect(html).toMatch(/Current step:<\/span>[\s\S]*?Approve your OSI website address/);
    expect(html).toContain('data-testid="checklist-action-website"');
    expect(html).not.toContain('data-testid="checklist-action-tracker"');
    expect(html).toContain('connects OSI to your trackers through this browser');
  });

  it('moves to the tracker step once a website is approved', async () => {
    useExtensionI18n().setLocale('pl');
    const html = await renderWithUi(SetupChecklist, {
      websiteDone: true,
      trackerDone: false,
      mode: 'setup',
    });
    expect(stepState(html, 'website')).toBe('done');
    expect(stepState(html, 'tracker')).toBe('current');
    expect(html).toMatch(/data-testid="checklist-tracker"[^>]*aria-current="step"/);
    expect(html).toContain('Zatwierdź tracker dla tej witryny');
    expect(html).toContain('data-testid="checklist-action-tracker"');
  });

  it('makes the popup offer for the open tab the website step itself', async () => {
    useExtensionI18n().setLocale('en');
    const html = await renderWithUi(SetupChecklist, {
      websiteDone: false,
      trackerDone: false,
      mode: 'popup',
      offer: 'https://time.example.com',
    });
    expect(html).not.toContain('data-testid="checklist-action-website"');
    expect(html).toMatch(/data-testid="current-website-offer"[\s\S]*Approve time\.example\.com/);
  });

  it('names the approved website in the done step', async () => {
    useExtensionI18n().setLocale('en');
    const html = await renderWithUi(SetupChecklist, {
      websiteDone: true,
      trackerDone: false,
      mode: 'popup',
      website: 'https://time.example.com',
    });
    expect(html).toContain('OSI website approved');
    expect(html).toMatch(/data-testid="checklist-website-link"[\s\S]*?time\.example\.com/);
  });

  it('quotes the OSI setting exactly as the web app labels it', async () => {
    useExtensionI18n().setLocale('pl');
    const html = await renderWithUi(SetupChecklist, {
      websiteDone: false,
      trackerDone: false,
      mode: 'setup',
    });
    expect(html.replaceAll(' ', ' ')).toContain(
      '„Zezwalaj na bezpośrednie połączenie z przeglądarki”',
    );
  });
});
