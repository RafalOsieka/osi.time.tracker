import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const PREFIX = /^(\d{4})_/;

function numericPrefix(fileName: string): number | null {
  const match = PREFIX.exec(fileName);
  if (!match) return null;
  return Number(match[1]);
}

/**
 * SQL files in `server/db/migrations` whose numeric prefix is strictly less than `n`.
 */
export function migrationFilesBefore(n: number, migrationsDir?: string): string[] {
  const dir = migrationsDir ?? join(process.cwd(), 'server', 'db', 'migrations');
  return readdirSync(dir)
    .filter((file) => file.endsWith('.sql'))
    .filter((file) => {
      const prefix = numericPrefix(file);
      return prefix !== null && prefix < n;
    })
    .sort();
}

export function readMigrationSql(fileName: string, migrationsDir?: string): string {
  const dir = migrationsDir ?? join(process.cwd(), 'server', 'db', 'migrations');
  return readFileSync(join(dir, fileName), 'utf8');
}

interface SqlExecutor {
  unsafe: (statement: string) => Promise<object>;
}

export async function applySqlFile(sql: SqlExecutor, contents: string): Promise<void> {
  for (const statement of contents.split('--> statement-breakpoint')) {
    const trimmed = statement.trim();
    if (trimmed) await sql.unsafe(trimmed);
  }
}
