// The browser extension's screenshot set for design reviews, the extension slice of `capture.ts`:
// one run captures every extension screen (`extension-screens.ts`) in one language and one or both
// themes. It loads the built unpacked extension (`apps/extension/dist`, which the
// `capture:extension` script builds first) into a fresh Chromium profile per screen, writes the
// screen's state into the extension's storage through its service worker, and writes
// `<outDir>/<theme>-extension-<locale>-<screen>.png` and `<outDir>/screens-extension-<locale>.json`.
//
//   pnpm --filter @osi/time-tracker-screenshots capture:extension <outDir>
//     [--theme light|dark|both] [--locale en|pl]
//
// Defaults: both themes, en. No app, database or tracker needs to run. Popup screens are the
// popup's own width (360px) at the height of their content, at 2x; setup screens are 1280 × 800,
// grown to the whole page except dialogs and toasts.
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import {
  chromium,
  type BrowserContext,
  type BrowserContextOptions,
  type Page,
  type Worker,
} from 'playwright';
import { z } from 'zod';
import {
  EXTENSION_SCREENS,
  STORAGE_KEYS,
  WEBSITE,
  extensionStateSchema,
  type ExtensionScreen,
  type ExtensionState,
  type Surface,
} from './extension-screens.js';
import { TIME_ZONE, TRACKERS } from './seed.js';

const SURFACES = {
  popup: {
    path: 'src/popup/index.html',
    viewport: { width: 360, height: 600 },
    deviceScaleFactor: 2,
  },
  setup: {
    path: 'src/options/index.html',
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
  },
} as const satisfies Record<Surface, BrowserContextOptions & { path: string }>;

/** The browser language that goes with each extension locale. */
const LANGUAGES = { en: 'en-US', pl: 'pl-PL' } as const;

/** Host access the browser grants at install: everything, or all but Globex Redmine. */
const HOSTS = {
  full: [WEBSITE, TRACKERS.acme.baseUrl, TRACKERS.globex.baseUrl],
  partial: [WEBSITE, TRACKERS.acme.baseUrl],
} as const;
type Access = keyof typeof HOSTS;

const argsSchema = z.object({
  out: z.string({
    error: 'Usage: capture:extension <outDir> [--theme …] (see capture-extension.ts)',
  }),
  theme: z.enum(['light', 'dark', 'both']),
  locale: z.enum(['en', 'pl']),
});
type Slice = z.infer<typeof argsSchema>;
type Theme = Exclude<Slice['theme'], 'both'>;

function readArgs(): Slice {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      theme: { type: 'string', default: 'both' },
      locale: { type: 'string', default: 'en' },
    },
  });
  return argsSchema.parse({ ...values, out: positionals[0] });
}

/** Parts of the extension's state under their storage keys, as the capture writes them. */
type StorageItems = Partial<{
  [Part in keyof ExtensionState as (typeof STORAGE_KEYS)[Part]]: ExtensionState[Part];
}>;

/** The extension APIs the capture calls inside the service worker, through `evaluate`. */
declare const chrome: {
  storage: Record<'local' | 'session', { set: (items: StorageItems) => Promise<void> }>;
  scripting: { getRegisteredContentScripts: () => Promise<{ id: string }[]> };
};

const manifestSchema = z.looseObject({ host_permissions: z.array(z.string()).optional() });

/**
 * Copies the built extension with `access` granted at install, as the user would have granted it
 * on the setup page: install-time grants need no permission prompt, which a headless browser
 * cannot answer.
 */
async function unpackExtension(access: Access): Promise<string> {
  const dist = fileURLToPath(new URL('../../extension/dist', import.meta.url));
  const path = await mkdtemp(join(tmpdir(), `osi-screenshots-extension-${access}-`));
  await cp(dist, path, { recursive: true });
  const manifestFile = join(path, 'manifest.json');
  const manifest = manifestSchema.parse(JSON.parse(await readFile(manifestFile, 'utf8')));
  manifest.host_permissions = HOSTS[access].map((url) => `${new URL(url).origin}/*`);
  await writeFile(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
  return path;
}

/**
 * Writes `state` into the extension's storage. Approvals go first and alone: the worker answers
 * them by pruning activity and suggestions that no approval covers, and registers the website's
 * content script last. Once that script is registered, the rest is written.
 */
async function writeState(worker: Worker, state: ExtensionState): Promise<void> {
  const { approvals, suggestions, activity } = extensionStateSchema.parse(state);
  const website = approvals.websites[0]?.origin;
  await worker.evaluate(async (items) => chrome.storage.local.set(items), {
    [STORAGE_KEYS.approvals]: approvals,
  });
  if (website) {
    await worker.evaluate(async (id) => {
      while (!(await chrome.scripting.getRegisteredContentScripts()).some((s) => s.id === id)) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }, `osi-bridge:${website}`);
  }
  await worker.evaluate(
    async ({ local, session }) => {
      await chrome.storage.local.set(local);
      await chrome.storage.session.set(session);
    },
    {
      local: { [STORAGE_KEYS.suggestions]: suggestions },
      session: { [STORAGE_KEYS.activity]: activity },
    },
  );
}

/** Opens the screen's tab in front of the page, so the popup reads it as the active tab. */
async function openActiveTab(context: BrowserContext, url: string): Promise<Page> {
  await context.route(`${new URL(url).origin}/**`, (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><title>OSI Time Tracker</title><p>OSI Time Tracker</p>',
    }),
  );
  const tab = await context.newPage();
  await tab.goto(url);
  return tab;
}

/** A popup is as tall as its content; a setup page grows to its whole height unless an overlay. */
async function shoot(page: Page, screen: ExtensionScreen, file: string): Promise<void> {
  if (screen.surface === 'popup') {
    const height = await page.evaluate(() =>
      Math.ceil(document.querySelector('main')?.getBoundingClientRect().height ?? 0),
    );
    if (height === 0) throw new Error(`${screen.id}: the popup has no content.`);
    await page.setViewportSize({ width: SURFACES.popup.viewport.width, height });
  }
  await page.screenshot({
    path: file,
    animations: 'disabled',
    fullPage: screen.surface === 'setup' && !screen.overlay,
  });
}

async function captureScreen(
  screen: ExtensionScreen,
  extensionPath: string,
  theme: Theme,
  locale: Slice['locale'],
  file: string,
): Promise<void> {
  const surface = SURFACES[screen.surface];
  const profile = await mkdtemp(join(tmpdir(), 'osi-screenshots-profile-'));
  // `channel: 'chromium'` is what loads MV3 extensions in headless Playwright.
  const context = await chromium.launchPersistentContext(profile, {
    headless: true,
    channel: 'chromium',
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
    viewport: surface.viewport,
    deviceScaleFactor: surface.deviceScaleFactor,
    locale: LANGUAGES[locale],
    colorScheme: theme,
    timezoneId: TIME_ZONE,
  });
  try {
    const worker =
      context.serviceWorkers()[0] ??
      (await context.waitForEvent('serviceworker', { timeout: 15_000 }));
    const extensionId = new URL(worker.url()).host;
    await writeState(worker, screen.state());

    const tab = screen.activeTab ? await openActiveTab(context, screen.activeTab) : undefined;
    const page = await context.newPage();
    // The extension keeps its theme and language in the page's own storage, not in the browser.
    await page.addInitScript(
      ({ themeValue, localeValue }) => {
        localStorage.setItem('osi-extension-theme', themeValue);
        localStorage.setItem('osi-extension-locale', localeValue);
      },
      { themeValue: theme, localeValue: locale },
    );
    if (screen.init) await page.addInitScript(screen.init);
    // The popup asks for the active tab as it opens, so the tab stays in front until then.
    await tab?.bringToFront();
    await page.goto(`chrome-extension://${extensionId}/${surface.path}${screen.query ?? ''}`);
    for (const selector of screen.ready) await page.waitForSelector(selector);
    await page.bringToFront();
    await screen.prepare?.(page);
    if (!screen.overlay) await page.mouse.move(0, 0);
    await shoot(page, screen, file);
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
}

async function main(): Promise<void> {
  const slice = readArgs();
  const themes = slice.theme === 'both' ? (['light', 'dark'] as const) : [slice.theme];
  mkdirSync(slice.out, { recursive: true });

  const extensions = {
    full: await unpackExtension('full'),
    partial: await unpackExtension('partial'),
  };
  try {
    for (const theme of themes) {
      for (const screen of EXTENSION_SCREENS) {
        const file = join(slice.out, `${theme}-extension-${slice.locale}-${screen.id}.png`);
        await captureScreen(screen, extensions[screen.access ?? 'full'], theme, slice.locale, file);
        console.log(file);
      }
    }
  } finally {
    for (const path of Object.values(extensions)) await rm(path, { recursive: true, force: true });
  }

  const summary = {
    viewport: 'extension',
    size: {
      popup: { width: SURFACES.popup.viewport.width },
      setup: SURFACES.setup.viewport,
    },
    themes,
    set: 'extension',
    locale: slice.locale,
    screens: EXTENSION_SCREENS.map(({ id, title, shows }) => ({
      id: `extension-${slice.locale}-${id}`,
      title,
      shows,
    })),
  };
  const summaryFile = `screens-extension-${slice.locale}.json`;
  writeFileSync(join(slice.out, summaryFile), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(`${EXTENSION_SCREENS.length * themes.length} screenshots in ${slice.out}`);
}

await main();
