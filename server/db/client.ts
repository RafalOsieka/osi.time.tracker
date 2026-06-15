import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres, { type Sql } from 'postgres';

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
 * shared `db` client exported from `./index`.
 */
export function createDatabaseClient(
  connectionString: string = resolveDatabaseUrl(),
  options?: { max?: number },
): { db: PostgresJsDatabase; sql: Sql } {
  const sql = postgres(connectionString, { max: options?.max ?? 10 });
  const db = drizzle(sql);

  return { db, sql };
}
