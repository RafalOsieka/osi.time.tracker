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
 * Shared Drizzle database client. All server-side database access SHALL go
 * through this getter rather than instantiating raw drivers directly.
 * The client is created on first call so importing this module does not
 * require `DATABASE_URL`.
 */
export function getDb(): PostgresJsDatabase<typeof schema> {
  return getClient().db;
}

export { createDatabaseClient, resolveDatabaseUrl } from './client';
