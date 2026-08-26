import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { createDatabaseClient, resolveDatabaseUrl, type DatabaseClientPair } from './client';
import type * as schema from './schema';

let client: DatabaseClientPair | undefined;

/**
 * Returns the lazily-initialized, shared Drizzle client for the Nitro server
 * context. Initialization fails fast when `DATABASE_URL` is missing.
 */
function getClient(): DatabaseClientPair {
  if (!client) {
    client = createDatabaseClient(resolveDatabaseUrl());
  }

  return client;
}

/**
 * Shared Drizzle database client (one connection pool per process).
 * All server-side database access SHALL go through this getter rather than
 * instantiating raw drivers. The first call creates the postgres.js pool;
 * later calls return the same client — they do not open extra connections.
 * Bind once per handler (`const db = getDb()`) and reuse that local.
 */
export function getDb(): PostgresJsDatabase<typeof schema> {
  return getClient().db;
}

export { createDatabaseClient, resolveDatabaseUrl } from './client';
