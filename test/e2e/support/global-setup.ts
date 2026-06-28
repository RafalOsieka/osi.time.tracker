import { startPostgres, stopPostgres, TEST_DATABASE_URL } from './postgres';
import { runMigrations } from '../../../server/db/migrate';

export async function setup(): Promise<void> {
  console.warn('setup, ', TEST_DATABASE_URL);
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  console.warn('startPostgres');
  await startPostgres();
  console.warn('startPostgres completed');
  await runMigrations(TEST_DATABASE_URL);
  console.warn('runMigrations completed', TEST_DATABASE_URL);
}

export async function teardown(): Promise<void> {
  console.warn('stopPostgres');
  stopPostgres();
  console.warn('stopPostgres completed');
}
