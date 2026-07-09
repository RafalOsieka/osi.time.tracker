import { execSync } from 'node:child_process';
import { startPostgres, stopPostgres, TEST_DATABASE_URL } from './postgres';
import { isDockerAvailable } from './guards';
import { prepareTemplate } from './database';

export async function setup(): Promise<void> {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  process.env.IS_E2E = 'true';

  if (isDockerAvailable()) {
    await startPostgres();
    await prepareTemplate();
  }

  if (!process.env.NUXT_TEST_DEV) {
    execSync('pnpm build', { stdio: 'inherit' });
  }
}

export async function teardown(): Promise<void> {
  if (isDockerAvailable()) {
    stopPostgres();
  }
}
