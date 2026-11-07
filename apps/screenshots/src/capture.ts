// The app's screenshot set for design reviews (the council skill's design branch). One run takes
// one slice: one screen size, one or both themes, one set of screens (`screens.ts`), one language.
// It seeds fresh users into a running app, then writes
// `<outDir>/<theme>-<viewport>-<locale>-<screen>.png` and
// `<outDir>/screens-<viewport>-<set>-<locale>.json`, which says what the slice is and what each
// screen shows. Several slices can share one folder (the council's regression sweep).
//
//   pnpm --filter @osi/time-tracker-screenshots capture <outDir>
//     [--viewport desktop|tablet|phone] [--theme light|dark|both] [--set pages|features]
//     [--locale en|pl] [--base-url http://localhost:3000]
//
// Defaults: desktop, both themes, pages, en. Needs the app running (`pnpm dev`) against the
// database in `DATABASE_URL` (read from the repo's `.env`), where the users are inserted. Capture
// from a freshly started app: a dev server started before a change may serve stale icons or
// styles. Trackers are faked in the browser (`trackers.ts`), so no tracker needs to run. Tall
// pages are captured whole: the viewport grows to the height of the page's scroll area. Dialogs,
// popovers and menus are captured at viewport height.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import {
  chromium,
  type Browser,
  type BrowserContext,
  type BrowserContextOptions,
  type Page,
} from 'playwright';
import { z } from 'zod';
import { SCREENS, hydrated, type Persona } from './screens.js';
import { TIME_ZONE, createUser, seedData, syncDay, type ScreenshotUser } from './seed.js';
import { mockTrackers } from './trackers.js';

const VIEWPORTS = {
  desktop: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
  tablet: {
    viewport: { width: 834, height: 1112 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  },
  phone: {
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  },
} as const satisfies Record<string, BrowserContextOptions>;

/** The browser language that goes with each app locale. */
const LANGUAGES = { en: 'en-US', pl: 'pl-PL' } as const;

const argsSchema = z.object({
  out: z.string({ error: 'Usage: capture <outDir> [--viewport …] (see capture.ts)' }),
  viewport: z.enum(['desktop', 'tablet', 'phone']),
  theme: z.enum(['light', 'dark', 'both']),
  set: z.enum(['pages', 'features']),
  locale: z.enum(['en', 'pl']),
  baseUrl: z.url(),
});
type Slice = z.infer<typeof argsSchema>;

function readArgs(): Slice {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      viewport: { type: 'string', default: 'desktop' },
      theme: { type: 'string', default: 'both' },
      set: { type: 'string', default: 'pages' },
      locale: { type: 'string', default: 'en' },
      'base-url': { type: 'string', default: 'http://localhost:3000' },
    },
  });
  return argsSchema.parse({ ...values, out: positionals[0], baseUrl: values['base-url'] });
}

function readDatabaseUrl(): string {
  const envFile = fileURLToPath(new URL('../../../.env', import.meta.url));
  if (existsSync(envFile)) process.loadEnvFile(envFile);
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl)
    throw new Error('DATABASE_URL is not set. Define it in .env (see .env.example).');
  return databaseUrl;
}

type SignedInState = Awaited<ReturnType<BrowserContext['storageState']>>;

/**
 * Signs `user` in and returns the session every capture context starts from. With `seed`, it
 * also seeds the user's data and stores each Tracker's API secret in the browser, as the Trackers
 * page would.
 */
async function signIn(
  browser: Browser,
  baseUrl: string,
  user: ScreenshotUser,
  seed: boolean,
): Promise<SignedInState> {
  const context = await browser.newContext({ baseURL: baseUrl, timezoneId: TIME_ZONE });
  try {
    const page = await context.newPage();
    await page.goto('/login');
    await hydrated(page);
    await page
      .locator('[data-testid="email"] input, input[data-testid="email"]')
      .first()
      .fill(user.email);
    await page
      .locator('[data-testid="password"] input, input[data-testid="password"]')
      .first()
      .fill(user.password);
    await page.click('[data-testid="login-button"]');
    await page.waitForSelector('[data-testid="app-topbar"]');
    if (seed) {
      const token = await page.locator('meta[name="csrf-token"]').getAttribute('content');
      if (!token) throw new Error('No CSRF token on the page after signing in.');
      const trackerIds = Object.values(await seedData(context.request, token));
      await page.evaluate((ids) => {
        for (const id of ids) window.localStorage.setItem(`rsc:${id}`, 'screenshot-secret');
      }, trackerIds);
    }
    return await context.storageState();
  } finally {
    await context.close();
  }
}

/** Grows the viewport to the tallest scroll area, so the shot holds the whole page. */
async function shoot(page: Page, file: string, grow: boolean): Promise<void> {
  const size = page.viewportSize();
  if (!size) throw new Error('The page has no viewport.');
  if (grow) {
    const overflow = await page.evaluate(() => {
      const scrollers = [...document.querySelectorAll('*')].filter((el) =>
        ['auto', 'scroll'].includes(getComputedStyle(el).overflowY),
      );
      const root = document.scrollingElement;
      return Math.max(
        0,
        ...[...scrollers, ...(root ? [root] : [])].map((el) => el.scrollHeight - el.clientHeight),
      );
    });
    if (overflow > 0) await page.setViewportSize({ ...size, height: size.height + overflow });
  }
  // The dev server's devtools pill is not part of the app.
  const style = '#nuxt-devtools-container { display: none !important; }';
  await page.screenshot({ path: file, animations: 'disabled', style });
}

async function main(): Promise<void> {
  const slice = readArgs();
  const databaseUrl = readDatabaseUrl();
  const screens = SCREENS[slice.set];
  const themes = slice.theme === 'both' ? (['light', 'dark'] as const) : [slice.theme];
  const needs = (persona: Persona) => screens.some((screen) => screen.as === persona);
  mkdirSync(slice.out, { recursive: true });

  const browser = await chromium.launch();
  try {
    // Each persona's session, signed in once; the visitor has none.
    const sessions: Partial<Record<Persona, SignedInState>> = {};
    for (const persona of ['busy', 'new'] as const) {
      if (!needs(persona)) continue;
      const user = await createUser(databaseUrl);
      console.log(`Signing in ${user.email} (${persona}) at ${slice.baseUrl}`);
      sessions[persona] = await signIn(browser, slice.baseUrl, user, persona === 'busy');
    }

    const day = syncDay();
    for (const theme of themes) {
      for (const screen of screens) {
        // A context per screen, so state one screen leaves (a collapsed sidebar) never leaks.
        const context = await browser.newContext({
          ...VIEWPORTS[slice.viewport],
          baseURL: slice.baseUrl,
          colorScheme: theme,
          timezoneId: TIME_ZONE,
          locale: LANGUAGES[slice.locale],
          storageState: sessions[screen.as],
        });
        try {
          await context.addCookies([
            { name: 'i18n_locale', value: slice.locale, url: slice.baseUrl },
          ]);
          await mockTrackers(context, day);
          const page = await context.newPage();
          await screen.before?.(page);
          await page.goto(screen.path);
          await hydrated(page);
          await page.waitForSelector(screen.ready);
          await screen.prepare?.(page);
          // A page shot shows the page at rest, not the hover state of the control `prepare`
          // clicked. Overlays may open on hover, so they keep the pointer where it is.
          if (!screen.overlay) await page.mouse.move(0, 0);
          await page.waitForLoadState('networkidle');
          const file = join(
            slice.out,
            `${theme}-${slice.viewport}-${slice.locale}-${screen.id}.png`,
          );
          await shoot(page, file, !screen.overlay);
          console.log(file);
        } finally {
          await context.close();
        }
      }
    }
  } finally {
    await browser.close();
  }

  const summary = {
    viewport: slice.viewport,
    size: VIEWPORTS[slice.viewport].viewport,
    themes,
    set: slice.set,
    locale: slice.locale,
    screens: screens.map(({ id, title, shows }) => ({
      id: `${slice.viewport}-${slice.locale}-${id}`,
      title,
      shows,
    })),
  };
  const summaryFile = `screens-${slice.viewport}-${slice.set}-${slice.locale}.json`;
  writeFileSync(join(slice.out, summaryFile), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(`${screens.length * themes.length} screenshots in ${slice.out}`);
}

await main();
