import { afterAll, expect, it, vi } from 'vite-plus/test';
import DestinationApprovals from '../../src/ui/DestinationApprovals.vue';
import WebsiteApprovals from '../../src/ui/WebsiteApprovals.vue';
import { useExtensionI18n } from '../../src/composables/use-extension-i18n.js';
import { renderWithUi } from './render-with-ui.js';
import { destinationKey } from '../../src/approvals/approvals.js';

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

/**
 * Whether the button with this test id carries the bare `disabled` attribute. Tailwind's
 * `disabled:` variants are in every button's class list, so a plain substring check proves nothing.
 */
function isDisabled(html: string, testId: string): boolean {
  const tag = new RegExp(`<button[^>]*data-testid="${testId}"[^>]*>`).exec(html)?.[0];
  if (tag === undefined) throw new Error(`button ${testId} not rendered`);
  return /\sdisabled[\s>=]/.test(tag);
}

it('renders unambiguous tracker identities and permission restoration labels', async () => {
  useExtensionI18n().setLocale('en');
  const websites = [
    { origin: 'https://time.example.com' },
    { origin: 'https://other.example.com' },
  ];
  const html = await renderWithUi(DestinationApprovals, {
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
    activity: {},
    now: 0,
    disabled: false,
    errorKey: null,
    missingOrigins: ['https://tracker.example.com'],
  });
  for (const website of websites) {
    const identity = `Website: ${website.origin} — Redmine https://tracker.example.com/team`;
    expect(html).toContain(`aria-label="Revoke tracker ${identity}"`);
    expect(html).toContain(`aria-label="Restore access ${identity}"`);
  }
  expect(html).toContain('No access');
  expect(html).toContain('data-testid="destination-website"');
  const trackerLink = /<a[^>]*href="https:\/\/tracker\.example\.com\/team"[^>]*>/.exec(html)?.[0];
  expect(trackerLink).toContain('target="_blank"');
});

it('renders localized field errors and disabled controls while an action is pending', async () => {
  useExtensionI18n().setLocale('pl');
  const html = await renderWithUi(WebsiteApprovals, {
    websites: [{ origin: 'https://time.example.com' }],
    destinations: [],
    origin: 'https://time.example.com/reports',
    disabled: true,
    errorKey: 'approvals.invalidWebsite',
    missingOrigins: [],
  });
  expect(html).toContain('Zatwierdź witrynę');
  expect(html).toContain('Podaj origin z https://');
  expect(html).toContain('aria-invalid="true"');
  expect(html).toContain('aria-describedby="website-origin-help website-origin-error"');
  expect(isDisabled(html, 'add-website')).toBe(true);
  expect(isDisabled(html, 'revoke-website-https://time.example.com')).toBe(true);
});

it('disables tracker submission and explains why when no website exists', async () => {
  useExtensionI18n().setLocale('en');
  const html = await renderWithUi(DestinationApprovals, {
    websites: [],
    destinations: [],
    website: '',
    provider: 'openproject',
    destinationUrl: '',
    httpWarning: false,
    activity: {},
    now: 0,
    disabled: false,
    errorKey: null,
    missingOrigins: [],
  });
  expect(isDisabled(html, 'add-destination')).toBe(true);
  expect(html).toContain('Approve a website before adding a tracker.');
});

it('approves trackers for the only website without asking which one', async () => {
  useExtensionI18n().setLocale('en');
  const html = await renderWithUi(DestinationApprovals, {
    websites: [{ origin: 'https://time.example.com' }],
    destinations: [],
    website: 'https://time.example.com',
    provider: 'redmine',
    destinationUrl: '',
    httpWarning: false,
    activity: {},
    now: 0,
    disabled: false,
    errorKey: null,
    missingOrigins: [],
  });
  expect(html).not.toContain('data-testid="destination-website"');
  expect(html).toContain('For https://time.example.com');
  expect(isDisabled(html, 'add-destination')).toBe(false);
});

it('shows the latest activity on each tracker row, or that there was none', async () => {
  useExtensionI18n().setLocale('en');
  const website = { origin: 'https://time.example.com' };
  const tracker = (basePath: string) => ({
    websiteOrigin: website.origin,
    provider: 'redmine' as const,
    origin: 'https://tracker.example.com',
    basePath,
  });
  const html = await renderWithUi(DestinationApprovals, {
    websites: [website],
    destinations: [tracker('/active'), tracker('/idle')],
    website: website.origin,
    provider: 'redmine',
    destinationUrl: '',
    httpWarning: false,
    activity: {
      [destinationKey(tracker('/active'))]: {
        at: '2026-10-05T10:00:00.000Z',
        operation: 'createTimeEntry',
        outcome: 'ok',
      },
    },
    now: Date.parse('2026-10-05T10:02:00.000Z'),
    disabled: false,
    errorKey: null,
    missingOrigins: [],
  });
  expect(html).toMatch(/2 minutes ago · Time entry export · OK/);
  expect(html).toContain('No activity yet');
});
