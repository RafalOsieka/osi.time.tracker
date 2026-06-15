import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createDatabaseClient, resolveDatabaseUrl } from "./client";

const MIGRATIONS_FOLDER = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "migrations",
);

/**
 * Applies all pending migrations from `server/db/migrations` to the database
 * referenced by `DATABASE_URL`. Resolves on success; rejects on failure.
 *
 * Uses a dedicated single connection so the process can terminate promptly,
 * which suits the dedicated migrate step model (run to completion, then exit).
 */
export async function runMigrations(
  connectionString: string = resolveDatabaseUrl(),
  migrationsFolder: string = MIGRATIONS_FOLDER,
): Promise<void> {
  const { db, sql } = createDatabaseClient(connectionString, { max: 1 });

  try {
    await migrate(db, { migrationsFolder });
  } finally {
    await sql.end({ timeout: 5 });
  }
}

// Allow running directly as a script: `tsx server/db/migrate.ts`.
const invokedDirectly =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  runMigrations()
    .then(() => {
      console.log("Migrations applied successfully.");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Migration failed:", error);
      process.exit(1);
    });
}
