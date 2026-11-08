import { sql } from 'drizzle-orm';
import { defineEventHandler, useRuntimeConfig } from 'nuxt/server';
import type { HealthDto } from '../../shared/types/health';
import { getDb } from '../db';
import { readHealth } from '../utils/health';

/**
 * Whether the server is up, and which build it runs: the container healthcheck uses it, and
 * the deploy workflow polls it until production reports the deployed commit. It needs no
 * session and returns nothing about any user.
 */
export default defineEventHandler((): Promise<HealthDto> => {
  const db = getDb();
  return readHealth(async () => {
    await db.execute(sql`select 1`);
  }, useRuntimeConfig().commitSha);
});
