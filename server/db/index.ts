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
 * through this client rather than instantiating raw drivers directly.
 */
export const db: PostgresJsDatabase<typeof schema> = new Proxy(
  // SAFETY: empty target; every trap forwards to the lazily created live client.
  {} as PostgresJsDatabase<typeof schema>,
  {
    get(_target, prop) {
      const instance = getClient().db;
      // SAFETY: Proxy traps receive string|symbol; the live client is the typed Drizzle database.
      return instance[prop as keyof typeof instance];
    },
  },
);

export { createDatabaseClient, resolveDatabaseUrl } from './client';
