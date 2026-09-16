import { setup } from '@nuxt/test-utils/e2e';
import type { NuxtConfig } from '@nuxt/schema';
import { OUTPUT_DIR } from './skip-build';
import { bindTestOrigin } from '../helpers/url';

export const SESSION_PASSWORD = 'test-session-password-0123456789-abcdef';

/**
 * `NuxtConfig` from `@nuxt/schema` deliberately omits `nitro` (it belongs to the
 * built `NuxtOptions`, not the user-input config type). `@nuxt/test-utils` still
 * reads `nuxtConfig.nitro.output.dir` at runtime when `build: false`, so we widen
 * the type locally instead of resorting to `as any`.
 */
type TestNuxtConfig = NuxtConfig & { nitro: { output: { dir: string } } };

/**
 * Sets up a booted Nuxt server isolated to the given databaseUrl.
 * Switches between build-once mode and dev mode based on NUXT_TEST_DEV env.
 * In non-dev mode, reuses the app build produced once in global-setup instead
 * of triggering a fresh build for every test file.
 */
export async function setupServer({
  databaseUrl,
  browser = false,
}: {
  databaseUrl: string;
  browser?: boolean;
}): Promise<void> {
  const isDev = Boolean(process.env.NUXT_TEST_DEV);
  const nuxtConfig: TestNuxtConfig = { nitro: { output: { dir: OUTPUT_DIR } } };

  // Set local env vars for the test process itself to pick up
  process.env.DATABASE_URL = databaseUrl;
  process.env.NUXT_SESSION_PASSWORD = SESSION_PASSWORD;
  process.env.IS_E2E = 'true';

  const env = {
    DATABASE_URL: databaseUrl,
    NUXT_SESSION_PASSWORD: SESSION_PASSWORD,
    IS_E2E: 'true',
  };
  const coverage = process.env.NODE_V8_COVERAGE;
  const setupEnv = coverage ? { ...env, NODE_V8_COVERAGE: coverage } : env;
  // Opt-in local override: launch a system Chrome/Edge via Playwright's
  // `channel` instead of Playwright's own managed Chromium download, for
  // environments where that download is unreachable. Unset in CI.
  // `--lang=en-US` pins the UI language Playwright's own managed Chromium
  // always has regardless of host OS; a real system browser otherwise
  // inherits the host's OS locale and detectBrowserLanguage serves that
  // locale's catalog, breaking English-string assertions.
  const channel = process.env.PLAYWRIGHT_CHROMIUM_CHANNEL;
  const browserOptions = channel
    ? { type: 'chromium' as const, launch: { channel, headless: true, args: ['--lang=en-US'] } }
    : undefined;
  const options = { browser, dev: isDev, env: setupEnv, browserOptions };
  if (isDev) {
    await setup(options);
  } else {
    await setup({ ...options, build: false, nuxtConfig });
  }
  bindTestOrigin();
}
