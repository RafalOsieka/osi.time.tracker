// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it } from 'vite-plus/test';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { h } from 'vue';
import ui from '@nuxt/ui/vue-plugin';
import ExtensionApp from '../../src/ui/ExtensionApp.vue';
import WebsiteApprovals from '../../src/ui/WebsiteApprovals.vue';
import { useExtensionI18n } from '../../src/composables/use-extension-i18n.js';
import type { DestinationApproval } from '../../src/approvals/approvals.js';

const website = 'https://time.example.com';
const tracker = (websiteOrigin: string, basePath: string): DestinationApproval => ({
  websiteOrigin,
  provider: 'redmine',
  origin: 'https://tracker.example.com',
  basePath,
});

let wrapper: VueWrapper | undefined;
let revoked: string[] = [];

function mountPanel(destinations: DestinationApproval[]) {
  wrapper = mount(
    () =>
      h(ExtensionApp, null, {
        default: () =>
          h(WebsiteApprovals, {
            websites: [{ origin: website }, { origin: 'https://other.example.com' }],
            destinations,
            origin: '',
            disabled: false,
            errorKey: null,
            missingOrigins: [],
            onRevoke: (origin: string) => revoked.push(origin),
          }),
      }),
    { global: { plugins: [ui] }, attachTo: document.body },
  );
}

/** Nuxt UI teleports the modal to <body>, outside the wrapper's root. */
function byTestId(testId: string): HTMLElement | null {
  return document.body.querySelector(`[data-testid="${testId}"]`);
}

async function click(testId: string): Promise<void> {
  byTestId(testId)!.click();
  await flushPromises();
}

beforeEach(() => {
  useExtensionI18n().setLocale('en');
  revoked = [];
});

afterEach(() => {
  wrapper?.unmount();
  document.body.innerHTML = '';
});

it('asks before revoking a website that still has trackers and names how many go with it', async () => {
  mountPanel([
    tracker(website, '/a'),
    tracker(website, '/b'),
    tracker('https://other.example.com', ''),
  ]);
  await click(`revoke-website-${website}`);

  expect(revoked).toEqual([]);
  expect(document.body.textContent).toContain(`Revoke ${website}?`);
  expect(document.body.textContent).toContain('Trackers affected: 2.');

  await click('revoke-website-confirm-action');
  expect(revoked).toEqual([website]);
  expect(byTestId('revoke-website-confirm')).toBeNull();
});

it('keeps everything when the confirmation is cancelled', async () => {
  mountPanel([tracker(website, '/a')]);
  await click(`revoke-website-${website}`);
  await click('revoke-website-cancel');

  expect(revoked).toEqual([]);
  expect(byTestId('revoke-website-confirm')).toBeNull();
});

it('revokes a website without trackers directly', async () => {
  mountPanel([tracker('https://other.example.com', '')]);
  await click(`revoke-website-${website}`);

  expect(revoked).toEqual([website]);
  expect(byTestId('revoke-website-confirm')).toBeNull();
});
