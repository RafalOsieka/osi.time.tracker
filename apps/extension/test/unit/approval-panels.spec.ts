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
  // Plain string matching: test ids contain URLs, whose dots would be wildcards in a pattern.
  const tag = html
    .match(/<button[^>]*>/g)
    ?.find((item) => item.includes(`data-testid="${testId}"`));
  if (tag === undefined) throw new Error(`button ${testId} not rendered`);
  return /\sdisabled[\s>=]/.test(tag);
}

const website = { origin: 'https://time.example.com' };
const tracker = (basePath: string, websiteOrigin = website.origin) => ({
  websiteOrigin,
  provider: 'redmine' as const,
  origin: 'https://tracker.example.com',
  basePath,
});
const destinationProps = {
  website: website.origin,
  provider: 'redmine' as const,
  destinationUrl: '',
  open: false,
  httpWarning: false,
  activity: {},
  now: 0,
  disabled: false,
  errorKey: null,
  missingOrigins: [],
  rowRestore: true,
};

it('renders unambiguous tracker identities and permission restoration labels', async () => {
  useExtensionI18n().setLocale('en');
  const websites = [website, { origin: 'https://other.example.com' }];
  const html = await renderWithUi(DestinationApprovals, {
    ...destinationProps,
    websites,
    destinations: websites.map((item) => tracker('/team', item.origin)),
    open: true,
    missingOrigins: ['https://tracker.example.com'],
  });
  for (const item of websites) {
    const identity = `Redmine https://tracker.example.com/team (for ${item.origin})`;
    expect(html).toContain(`aria-label="Remove tracker ${identity}"`);
    expect(html).toContain(`aria-label="Restore access ${identity}"`);
  }
  expect(html).toContain('No access');
  expect(html).toContain('data-testid="destination-website"');
  const trackerLink = /<a[^>]*href="https:\/\/tracker\.example\.com\/team"[^>]*>/.exec(html)?.[0];
  expect(trackerLink).toContain('target="_blank"');
});

it('names the one rule a website address breaks and disables controls while busy', async () => {
  useExtensionI18n().setLocale('pl');
  const html = await renderWithUi(WebsiteApprovals, {
    websites: [],
    destinations: [],
    origin: 'https://time.example.com/reports',
    open: false,
    handedOff: false,
    disabled: true,
    errorKey: 'approvals.invalidWebsitePath',
    missingOrigins: [],
    rowRestore: false,
  });
  expect(html).toContain('Zatwierdź witrynę');
  expect(html).toContain('Podaj sam adres witryny, bez ścieżki');
  const input = /<input[^>]*data-testid="website-origin"[^>]*>/.exec(html)?.[0];
  expect(input).toContain('aria-invalid="true"');
  expect(input).toMatch(/aria-describedby="[^"]*-error[\s"]/);
  expect(isDisabled(html, 'add-website')).toBe(true);
});

it('lists approved websites first and keeps the add form behind its button', async () => {
  useExtensionI18n().setLocale('en');
  const html = await renderWithUi(WebsiteApprovals, {
    websites: [website],
    destinations: [],
    origin: '',
    open: false,
    handedOff: false,
    disabled: false,
    errorKey: null,
    missingOrigins: [],
    rowRestore: false,
  });
  expect(html).toContain('data-testid="new-website"');
  expect(html).not.toContain('data-testid="website-origin"');
  expect(html).toContain('time.example.com');
});

it('offers no tracker form, only what to do first, while no website is approved', async () => {
  useExtensionI18n().setLocale('en');
  const html = await renderWithUi(DestinationApprovals, {
    ...destinationProps,
    websites: [],
    destinations: [],
    website: '',
  });
  expect(html).not.toContain('data-testid="add-destination"');
  expect(html).toContain('Approve an OSI website first.');
});

it('approves trackers for the only website without asking which one', async () => {
  useExtensionI18n().setLocale('en');
  const html = await renderWithUi(DestinationApprovals, {
    ...destinationProps,
    websites: [website],
    destinations: [],
  });
  expect(html).not.toContain('data-testid="destination-website"');
  expect(html).toContain('The tracker is approved for time.example.com.');
  expect(isDisabled(html, 'add-destination')).toBe(false);
});

it('makes approving a plain-HTTP tracker a visibly deliberate choice', async () => {
  useExtensionI18n().setLocale('en');
  const html = await renderWithUi(DestinationApprovals, {
    ...destinationProps,
    websites: [website],
    destinations: [],
    destinationUrl: 'http://tracker.internal',
    httpWarning: true,
  });
  expect(html).toContain('data-testid="http-warning"');
  expect(html).toContain('API key travels unencrypted');
  expect(html).toContain('Approve despite HTTP');
});

it('lists trackers with their latest activity, the add form folded away', async () => {
  useExtensionI18n().setLocale('en');
  const html = await renderWithUi(DestinationApprovals, {
    ...destinationProps,
    websites: [website],
    destinations: [tracker('/active'), tracker('/idle')],
    activity: {
      [destinationKey(tracker('/active'))]: {
        at: '2026-10-05T10:00:00.000Z',
        operation: 'createTimeEntry',
        outcome: 'ok',
      },
    },
    now: Date.parse('2026-10-05T10:02:00.000Z'),
  });
  expect(html).toContain('Succeeded');
  expect(html).toContain('Time entry export');
  expect(html).toContain('2 minutes ago');
  expect(html).toContain('No activity this session');
  expect(html).toContain('data-testid="new-destination"');
  expect(html).not.toContain('data-testid="destination-url"');
});
