import { afterAll, expect, it, vi } from 'vitest';
import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';
import DestinationApprovals from '../../src/ui/DestinationApprovals.vue';
import WebsiteApprovals from '../../src/ui/WebsiteApprovals.vue';
import { useExtensionI18n } from '../../src/composables/use-extension-i18n.js';

vi.hoisted(() => {
  const storage = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
  });
});
afterAll(() => vi.unstubAllGlobals());

it('renders unambiguous tracker identities and permission restoration labels', async () => {
  useExtensionI18n().setLocale('en');
  const websites = [
    { origin: 'https://time.example.com' },
    { origin: 'https://other.example.com' },
  ];
  const html = await renderToString(
    createSSRApp(DestinationApprovals, {
      websites,
      destinations: websites.map((item) => ({
        websiteOrigin: item.origin,
        provider: 'redmine',
        origin: 'https://tracker.example.com',
        basePath: '/team',
      })),
      website: websites[0]!.origin,
      provider: 'redmine',
      destinationUrl: '',
      httpWarning: false,
      disabled: false,
      errorKey: null,
      missingOrigins: ['https://tracker.example.com'],
    }),
  );
  for (const website of websites) {
    const identity = `Website: ${website.origin} — Redmine https://tracker.example.com/team`;
    expect(html).toContain(`aria-label="Revoke tracker ${identity}"`);
    expect(html).toContain(`aria-label="Restore browser access ${identity}"`);
  }
  expect(html).toContain('Browser site access missing');
});

it('renders localized field errors and disabled controls while an action is pending', async () => {
  useExtensionI18n().setLocale('pl');
  const html = await renderToString(
    createSSRApp(WebsiteApprovals, {
      websites: [{ origin: 'https://time.example.com' }],
      origin: 'https://time.example.com/reports',
      disabled: true,
      errorKey: 'approvals.invalidWebsite',
      missingOrigins: [],
    }),
  );
  expect(html).toContain('Zatwierdź witrynę');
  expect(html).toContain('Podaj origin z https://');
  expect(html).toContain('aria-invalid="true"');
  expect(html).toContain('aria-describedby="website-origin-help website-origin-error"');
  expect(html).toMatch(/data-testid="add-website"[^>]*disabled/);
  expect(html).toMatch(/type="button"[^>]*disabled/);
});

it('disables tracker submission and explains why when no website exists', async () => {
  useExtensionI18n().setLocale('en');
  const html = await renderToString(
    createSSRApp(DestinationApprovals, {
      websites: [],
      destinations: [],
      website: '',
      provider: 'openproject',
      destinationUrl: '',
      httpWarning: false,
      disabled: false,
      errorKey: null,
      missingOrigins: [],
    }),
  );
  expect(html).toMatch(/data-testid="add-destination"[^>]*disabled/);
  expect(html).toContain('Approve a website before adding a tracker.');
});
