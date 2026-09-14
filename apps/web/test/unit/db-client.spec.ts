import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Sql } from 'postgres';

const { debug } = vi.hoisted(() => ({ debug: vi.fn() }));
// oxlint-disable-next-line anti-slop/no-module-mocking -- consola output is asserted directly, not through a project seam
vi.mock('consola', () => ({ consola: { debug } }));

const { drizzle } = vi.hoisted(() => ({
  drizzle: vi.fn((_sql: Sql, _config: { logger?: unknown }) => ({})),
}));
// oxlint-disable-next-line anti-slop/no-module-mocking -- asserts the exact options passed to drizzle(), not a project seam
vi.mock('drizzle-orm/postgres-js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('drizzle-orm/postgres-js')>()),
  drizzle,
}));

const { resolveDatabaseUrl, createQueryLogger, createDatabaseClient } =
  await import('../../server/db/client');

describe('resolveDatabaseUrl', () => {
  it('throws a clear error when DATABASE_URL is unset', () => {
    expect(() => resolveDatabaseUrl({})).toThrowError(/DATABASE_URL is not set/);
  });

  it('throws a clear error when DATABASE_URL is empty or blank', () => {
    expect(() => resolveDatabaseUrl({ DATABASE_URL: '' })).toThrowError(/DATABASE_URL is not set/);
    expect(() => resolveDatabaseUrl({ DATABASE_URL: '   ' })).toThrowError(
      /DATABASE_URL is not set/,
    );
  });

  it('returns the trimmed connection string when set', () => {
    expect(resolveDatabaseUrl({ DATABASE_URL: '  postgres://localhost/db  ' })).toBe(
      'postgres://localhost/db',
    );
  });
});

describe('createQueryLogger', () => {
  beforeEach(() => {
    debug.mockReset();
  });

  it('forwards the query and params to consola.debug', () => {
    const logger = createQueryLogger();
    logger.logQuery('select * from users where id = $1', ['abc']);
    expect(debug).toHaveBeenCalledWith('select * from users where id = $1', ['abc']);
  });

  it('never includes a connection string, since only the query and its params are logged', () => {
    const logger = createQueryLogger();
    const connectionString = 'postgres://user:secret@localhost/db';
    logger.logQuery('select 1', []);
    for (const call of debug.mock.calls) {
      expect(JSON.stringify(call)).not.toContain(connectionString);
    }
  });
});

describe('createDatabaseClient logger option', () => {
  beforeEach(() => {
    drizzle.mockClear();
  });

  it('attaches the query logger by default', () => {
    createDatabaseClient('postgres://user:pass@localhost/db');
    expect(drizzle.mock.calls[0]?.[1]?.logger).toBeDefined();
  });

  it('omits the query logger when disabled (the migrator opts out to avoid logging a password hash)', () => {
    createDatabaseClient('postgres://user:pass@localhost/db', { logger: false });
    expect(drizzle.mock.calls[0]?.[1]?.logger).toBeUndefined();
  });
});
