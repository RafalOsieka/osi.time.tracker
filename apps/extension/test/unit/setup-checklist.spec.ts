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
  it('starts at the website step on a fresh install', async () => {
    useExtensionI18n().setLocale('en');
    const html = await renderWithUi(SetupChecklist, { websiteDone: false, trackerDone: false });
    expect(stepState(html, 'website')).toBe('current');
    expect(stepState(html, 'tracker')).toBe('todo');
    expect(stepState(html, 'direct')).toBe('info');
    expect(html).toMatch(/Current step:<\/span>\s*1\. Approve your OSI website address\./);
  });

  it('moves to the tracker step once a website is approved', async () => {
    useExtensionI18n().setLocale('pl');
    const html = await renderWithUi(SetupChecklist, { websiteDone: true, trackerDone: false });
    expect(stepState(html, 'website')).toBe('done');
    expect(stepState(html, 'tracker')).toBe('current');
    expect(html).toMatch(/data-testid="checklist-tracker"[^>]*aria-current="step"/);
    expect(html).toContain('Zatwierdź tracker dla tej witryny.');
  });
});
