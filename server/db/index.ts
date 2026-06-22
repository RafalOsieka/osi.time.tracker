import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { Sql } from 'postgres';
import { createDatabaseClient, resolveDatabaseUrl } from './client';
import * as schema from './schema';

let client: { db: PostgresJsDatabase<typeof schema>; sql: Sql } | undefined;

/**
 * Returns the lazily-initialized, shared Drizzle client for the Nitro server
 * context. Initialization fails fast when `DATABASE_URL` is missing.
 */
function getClient(): { db: PostgresJsDatabase<typeof schema>; sql: Sql } {
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
  {} as PostgresJsDatabase<typeof schema>,
  {
    get(_target, prop, receiver) {
      return Reflect.get(getClient().db as object, prop, receiver);
    },
  },
);

export { createDatabaseClient, resolveDatabaseUrl } from './client';
