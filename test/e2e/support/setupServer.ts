import { fileURLToPath } from 'node:url';
import { setup } from '@nuxt/test-utils/e2e';
import type { NuxtConfig } from '@nuxt/schema';

export const SESSION_PASSWORD = 'test-session-password-0123456789-abcdef';

const OUTPUT_DIR = fileURLToPath(new URL('../../../.output', import.meta.url));

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

  await setup({
    browser,
    dev: isDev,
    ...(isDev ? {} : { build: false, nuxtConfig }),
    env: {
      DATABASE_URL: databaseUrl,
      NUXT_SESSION_PASSWORD: SESSION_PASSWORD,
      IS_E2E: 'true',
    },
  });
}
