import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { Logger } from 'drizzle-orm/logger';
import postgres, { type Sql, type Notice } from 'postgres';
import { consola } from 'consola';
import * as schema from './schema';

/**
 * Resolves the database connection string from the environment, failing fast
 * with a clear error when it is missing or empty.
 */
export function resolveDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const url = env.DATABASE_URL?.trim();

  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Define it (see .env.example) before accessing the database.',
    );
  }

  return url;
}

/**
 * Creates a new Drizzle client backed by a postgres.js connection.
 * Exposed mainly for tests and the migrator; application code SHOULD use the
 * shared `getDb()` client exported from `./index`.
 */
export type DatabaseClientPair = {
  db: PostgresJsDatabase<typeof schema>;
  sql: Sql;
};

/**
 * Drizzle query logger routed through `consola.debug` (server-logging REQ-357):
 * every executed statement and its bound parameters become visible only when
 * `CONSOLA_LEVEL` is raised to `debug` or above, and only the statement and
 * parameters are logged -- never the connection string (REQ-356).
 */
export function createQueryLogger(): Logger {
  return {
    logQuery(query, params) {
      consola.debug(query, params);
    },
  };
}

/** Logs a raw Postgres `NOTICE` (e.g. an identifier-truncation warning) at `debug`. */
function logNotice(notice: Notice): void {
  consola.debug('[postgres] notice', notice);
}

export function createDatabaseClient(
  connectionString: string = resolveDatabaseUrl(),
  options?: { max?: number; logger?: boolean },
): DatabaseClientPair {
  const sql = postgres(connectionString, { max: options?.max ?? 10, onnotice: logNotice });
  // The migrator opts out (`logger: false`): its one-shot bootstrap-user insert binds a
  // password hash as a query parameter, which the debug-level query logger would otherwise
  // print verbatim -- a credential-derived secret REQ-356 forbids logging at any level.
  const db = drizzle(sql, {
    schema,
    logger: (options?.logger ?? true) ? createQueryLogger() : undefined,
  });

  return { db, sql };
}
