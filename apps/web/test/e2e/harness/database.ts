import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { getAdminUrl, TEST_DATABASE_URL } from './postgres';
import { runMigrations } from '../../../server/db/migrate';

/**
 * Prepares the template database. It migrates the template DB once,
 * bulk-cleans leftover `osi_time_tracker_*` DBs from previous runs,
 * and ensures all connections to the template DB are closed.
 */
export async function prepareTemplate(): Promise<void> {
  const adminUrl = getAdminUrl();
  const sql = postgres(adminUrl, { max: 1 });

  try {
    // 1. Bulk-clean leftover databases and terminate active connections
    const dbs = await sql<{ datname: string }[]>`
      SELECT datname FROM pg_database WHERE datname LIKE 'osi_time_tracker_%'
    `;

    for (const row of dbs) {
      const name = row.datname;
      // Terminate any active connections to the database to ensure we can drop it
      await sql`
        SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
        WHERE datname = ${name} AND pid <> pg_backend_pid()
      `;

      if (name !== 'osi_time_tracker_test') {
        await sql.unsafe(`DROP DATABASE IF EXISTS "${name}"`);
      }
    }

    // 2. Migrate the main template database
    await runMigrations(TEST_DATABASE_URL);

    // 3. Make sure the migration pool's connections are terminated
    await sql`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = 'osi_time_tracker_test' AND pid <> pg_backend_pid()
    `;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

/**
 * Creates a unique database cloned from the migrated template database.
 * Returns the complete DATABASE_URL for the new database.
 */
export async function provisionDatabase(): Promise<string> {
  const uniqueName = `osi_time_tracker_${randomUUID().replace(/-/g, '_')}`;
  const adminUrl = getAdminUrl();
  const sql = postgres(adminUrl, { max: 1 });

  try {
    // Terminate any lingering connections to template DB to avoid active-connection error
    await sql`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = 'osi_time_tracker_test' AND pid <> pg_backend_pid()
    `;

    await sql.unsafe(`CREATE DATABASE "${uniqueName}" TEMPLATE "osi_time_tracker_test"`);

    return `postgres://postgres:postgres@127.0.0.1:54800/${uniqueName}`;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

/**
 * Creates a fresh empty database cloned from standard empty template0.
 * Returns the complete DATABASE_URL for the empty database.
 */
export async function provisionEmptyDatabase(): Promise<string> {
  const uniqueName = `osi_time_tracker_${randomUUID().replace(/-/g, '_')}`;
  const adminUrl = getAdminUrl();
  const sql = postgres(adminUrl, { max: 1 });

  try {
    await sql.unsafe(`CREATE DATABASE "${uniqueName}" TEMPLATE template0`);

    return `postgres://postgres:postgres@127.0.0.1:54800/${uniqueName}`;
  } finally {
    await sql.end({ timeout: 5 });
  }
}
