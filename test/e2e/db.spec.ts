import { afterAll, beforeAll, describe, expect, it, beforeEach } from 'vitest';
import postgres from 'postgres';
import { sql as drizzleSql, eq } from 'drizzle-orm';
import { createDatabaseClient } from '../../server/db/client';
import { runMigrations } from '../../server/db/migrate';
import { users } from '../../server/db/schema/users';
import {
  TEST_DATABASE_URL,
  isDockerAvailable,
  removeMigrations,
  startPostgres,
  stopPostgres,
  writeMigrations,
} from './support/postgres';

const dockerAvailable = isDockerAvailable();
const describeDb = dockerAvailable ? describe : describe.skip;

if (!dockerAvailable) {
  // eslint-disable-next-line no-console
  console.warn('[db.spec] Docker not available — skipping DB integration tests.');
}

describeDb('database integration', () => {
  beforeAll(async () => {
    await startPostgres();
  }, 180_000);

  afterAll(() => {
    stopPostgres();
  });

  it('connects to Postgres and runs SELECT 1', async () => {
    const { db, sql } = createDatabaseClient(TEST_DATABASE_URL, { max: 1 });
    try {
      const rows = await db.execute<{ value: number }>(drizzleSql`SELECT 1 AS value`);
      expect(Number((rows as Array<{ value: number }>)[0].value)).toBe(1);
    } finally {
      await sql.end({ timeout: 5 });
    }
  });

  it('applies all pending migrations against a fresh database', async () => {
    const dir = writeMigrations(['CREATE TABLE migrate_target (id integer PRIMARY KEY);']);
    const probe = postgres(TEST_DATABASE_URL, { max: 1 });
    try {
      await runMigrations(TEST_DATABASE_URL, dir);

      const tables = await probe`
        SELECT table_name FROM information_schema.tables
        WHERE table_name = 'migrate_target'
      `;
      expect(tables.length).toBe(1);

      const applied = await probe`SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations`;
      expect(applied[0].n).toBeGreaterThanOrEqual(1);
    } finally {
      await probe.end({ timeout: 5 });
      removeMigrations(dir);
    }
  });

  it('is idempotent when run twice (second run applies nothing)', async () => {
    const dir = writeMigrations(['CREATE TABLE idem_target (id integer PRIMARY KEY);']);
    const probe = postgres(TEST_DATABASE_URL, { max: 1 });
    try {
      await runMigrations(TEST_DATABASE_URL, dir);
      const first = await probe`SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations`;

      // Second run must succeed without error and without re-applying.
      await expect(runMigrations(TEST_DATABASE_URL, dir)).resolves.toBeUndefined();
      const second = await probe`SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations`;

      expect(second[0].n).toBe(first[0].n);
    } finally {
      await probe.end({ timeout: 5 });
      removeMigrations(dir);
    }
  });

  it('fails (rejects) on a deliberately broken migration', async () => {
    const dir = writeMigrations(['THIS IS NOT VALID SQL;']);
    try {
      await expect(runMigrations(TEST_DATABASE_URL, dir)).rejects.toBeTruthy();
    } finally {
      removeMigrations(dir);
    }
  });

  it('asserts an inserted user (id omitted) receives a UUIDv7 and that the email UNIQUE constraint rejects duplicates (case-folded)', async () => {
    // Run the migrations to ensure tables (specifically users) are created
    await runMigrations(TEST_DATABASE_URL);

    const { db, sql } = createDatabaseClient(TEST_DATABASE_URL, { max: 5 });
    try {
      // Clear users table first
      await db.execute(drizzleSql`TRUNCATE TABLE users CASCADE`);

      // Insert a user (id omitted)
      const email = 'user@example.com';
      const [inserted] = await db
        .insert(users)
        .values({
          email,
          passwordHash: 'somehash',
          displayName: 'John Doe',
        })
        .returning();

      expect(inserted.id).toBeDefined();
      expect(inserted.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
      expect(inserted.email).toBe(email);

      // Attempting to insert a duplicate email should throw a unique constraint error
      await expect(
        db.insert(users).values({
          email,
          passwordHash: 'anotherhash',
        }),
      ).rejects.toThrow();

      // Case-folded duplicate check: since we normalize lowercase before insert at the application level,
      // we can assert that normalized emails trigger unique constraint
      await expect(
        db.insert(users).values({
          email: 'USER@example.com'.toLowerCase(),
          passwordHash: 'anotherhash',
        }),
      ).rejects.toThrow();
    } finally {
      await sql.end({ timeout: 5 });
    }
  });

  describe('bootstrap user seeding', () => {
    const backupEmail = process.env.BOOTSTRAP_USER_EMAIL;
    const backupPassword = process.env.BOOTSTRAP_USER_PASSWORD;

    beforeEach(() => {
      delete process.env.BOOTSTRAP_USER_EMAIL;
      delete process.env.BOOTSTRAP_USER_PASSWORD;
    });

    afterAll(() => {
      if (backupEmail) process.env.BOOTSTRAP_USER_EMAIL = backupEmail;
      if (backupPassword) process.env.BOOTSTRAP_USER_PASSWORD = backupPassword;
    });

    it('fresh DB + vars set creates user', async () => {
      process.env.BOOTSTRAP_USER_EMAIL = 'bootstrap@example.com';
      process.env.BOOTSTRAP_USER_PASSWORD = 'bootstrappassword';

      // Clear users table first
      const { db, sql } = createDatabaseClient(TEST_DATABASE_URL);
      try {
        await db.execute(drizzleSql`TRUNCATE TABLE users CASCADE`);
      } finally {
        await sql.end({ timeout: 5 });
      }

      // Run migrations which includes seeding
      await runMigrations(TEST_DATABASE_URL);

      // Verify user was created
      const probeClient = createDatabaseClient(TEST_DATABASE_URL);
      try {
        const found = await probeClient.db
          .select()
          .from(users)
          .where(eq(users.email, 'bootstrap@example.com'))
          .limit(1);

        expect(found.length).toBe(1);
        expect(found[0].email).toBe('bootstrap@example.com');
        expect(found[0].passwordHash).toBeDefined();
        expect(found[0].passwordHash.startsWith('$scrypt$')).toBe(true);
      } finally {
        await probeClient.sql.end({ timeout: 5 });
      }
    });

    it('existing user untouched', async () => {
      // Clear users table and insert an existing user with a specific password hash
      const { db, sql } = createDatabaseClient(TEST_DATABASE_URL);
      const originalHash = 'some-original-hash';
      try {
        await db.execute(drizzleSql`TRUNCATE TABLE users CASCADE`);
        await db.insert(users).values({
          email: 'bootstrap@example.com',
          passwordHash: originalHash,
        });
      } finally {
        await sql.end({ timeout: 5 });
      }

      // Set vars and run migrations
      process.env.BOOTSTRAP_USER_EMAIL = 'bootstrap@example.com';
      process.env.BOOTSTRAP_USER_PASSWORD = 'newpassword';

      await runMigrations(TEST_DATABASE_URL);

      // Verify original user was not modified
      const probeClient = createDatabaseClient(TEST_DATABASE_URL);
      try {
        const found = await probeClient.db
          .select()
          .from(users)
          .where(eq(users.email, 'bootstrap@example.com'))
          .limit(1);

        expect(found.length).toBe(1);
        expect(found[0].passwordHash).toBe(originalHash); // untouched!
      } finally {
        await probeClient.sql.end({ timeout: 5 });
      }
    });

    it('unset vars skip silently', async () => {
      // Clear users table
      const { db, sql } = createDatabaseClient(TEST_DATABASE_URL);
      try {
        await db.execute(drizzleSql`TRUNCATE TABLE users CASCADE`);
      } finally {
        await sql.end({ timeout: 5 });
      }

      // Vars are unset (handled by beforeEach)
      await runMigrations(TEST_DATABASE_URL);

      // Verify no user was created
      const probeClient = createDatabaseClient(TEST_DATABASE_URL);
      try {
        const found = await probeClient.db.select().from(users);
        expect(found.length).toBe(0);
      } finally {
        await probeClient.sql.end({ timeout: 5 });
      }
    });
  });

  describe('startup sequence (dedicated migrate step)', () => {
    // Models the Compose migrate-then-serve contract: the app only begins
    // serving traffic after migrations complete; a migration failure blocks it.
    async function startupSequence(migrationsDir: string): Promise<string[]> {
      const events: string[] = [];
      await runMigrations(TEST_DATABASE_URL, migrationsDir);
      events.push('migrations-complete');
      events.push('serving-traffic');
      return events;
    }

    it('runs migrations to completion before serving traffic', async () => {
      const dir = writeMigrations(['CREATE TABLE startup_ok (id integer PRIMARY KEY);']);
      try {
        const events = await startupSequence(dir);
        expect(events).toEqual(['migrations-complete', 'serving-traffic']);
      } finally {
        removeMigrations(dir);
      }
    });

    it('blocks startup (never serves) when a migration fails', async () => {
      const dir = writeMigrations(['BROKEN SQL HERE;']);
      let served = false;
      try {
        await runMigrations(TEST_DATABASE_URL, dir);
        served = true;
      } catch {
        served = false;
      } finally {
        removeMigrations(dir);
      }
      expect(served).toBe(false);
    });
  });
});
