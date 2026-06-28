import { setup } from '@nuxt/test-utils/e2e';

export const SESSION_PASSWORD = 'test-session-password-0123456789-abcdef';

/**
 * Sets up a booted Nuxt server isolated to the given databaseUrl.
 * Switches between build-once mode and dev mode based on NUXT_TEST_DEV env.
 */
export async function setupServer({
  databaseUrl,
  browser = false,
}: {
  databaseUrl: string;
  browser?: boolean;
}): Promise<void> {
  const isDev = Boolean(process.env.NUXT_TEST_DEV);

  // Set local env vars for the test process itself to pick up
  process.env.DATABASE_URL = databaseUrl;
  process.env.NUXT_SESSION_PASSWORD = SESSION_PASSWORD;
  process.env.IS_E2E = 'true';

  await setup({
    browser,
    dev: isDev,
    env: {
      DATABASE_URL: databaseUrl,
      NUXT_SESSION_PASSWORD: SESSION_PASSWORD,
      IS_E2E: 'true',
    },
  });
}
