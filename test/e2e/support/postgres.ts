import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import postgres from 'postgres';

const CONTAINER_NAME = 'osi-time-tracker-e2e-pg';
const PASSWORD = 'postgres';
const DB = 'osi_time_tracker_test';
const HOST_PORT = 54329;

export const TEST_DATABASE_URL = `postgres://postgres:${PASSWORD}@127.0.0.1:${HOST_PORT}/${DB}`;

/** Returns true when a usable Docker CLI is available on the host. */
export function isDockerAvailable(): boolean {
  try {
    execFileSync('docker', ['info'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function dockerSilent(args: string[]): void {
  try {
    execFileSync('docker', args, { stdio: 'ignore' });
  } catch {
    // best effort
  }
}

/** Starts a disposable Postgres container and waits until it accepts queries. */
export async function startPostgres(): Promise<void> {
  dockerSilent(['rm', '-f', CONTAINER_NAME]);
  execFileSync(
    'docker',
    [
      'run',
      '-d',
      '--name',
      CONTAINER_NAME,
      '-e',
      `POSTGRES_PASSWORD=${PASSWORD}`,
      '-e',
      `POSTGRES_DB=${DB}`,
      '-p',
      `${HOST_PORT}:5432`,
      'postgres:18-alpine',
    ],
    { stdio: 'ignore' },
  );

  await waitForReady();
}

async function waitForReady(): Promise<void> {
  const deadline = Date.now() + 60_000;
  let lastError: unknown;

  while (Date.now() < deadline) {
    const sql = postgres(TEST_DATABASE_URL, { max: 1, onnotice: () => {} });
    try {
      await sql`SELECT 1`;
      await sql.end({ timeout: 5 });
      return;
    } catch (error) {
      lastError = error;
      await sql.end({ timeout: 5 }).catch(() => {});
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  throw new Error(`Postgres did not become ready in time: ${String(lastError)}`);
}

/** Stops and removes the disposable Postgres container. */
export function stopPostgres(): void {
  dockerSilent(['rm', '-f', CONTAINER_NAME]);
}

interface JournalEntry {
  idx: number;
  version: string;
  when: number;
  tag: string;
  breakpoints: boolean;
}

/**
 * Writes a minimal, drizzle-orm-migrator-compatible migrations folder into a
 * fresh temp directory and returns its path. Each entry in `sqls` becomes one
 * migration applied in order.
 */
export function writeMigrations(sqls: string[]): string {
  const dir = mkdtempSync(join(tmpdir(), 'osi-time-tracker-migrations-'));
  mkdirSync(join(dir, 'meta'), { recursive: true });

  const entries: JournalEntry[] = sqls.map((sql, idx) => {
    const tag = `${String(idx).padStart(4, '0')}_migration`;
    writeFileSync(join(dir, `${tag}.sql`), sql, 'utf8');
    return { idx, version: '7', when: Date.now() + idx, tag, breakpoints: true };
  });

  writeFileSync(
    join(dir, 'meta', '_journal.json'),
    JSON.stringify({ version: '7', dialect: 'postgresql', entries }, null, 2),
    'utf8',
  );

  return dir;
}

/** Removes a temp migrations folder created by {@link writeMigrations}. */
export function removeMigrations(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
}
