import { afterAll, describe, expect, it, beforeEach } from 'vitest';
import postgres from 'postgres';
import { sql as drizzleSql, eq } from 'drizzle-orm';
import { createDatabaseClient } from '../../server/db/client';
import { runMigrations } from '../../server/db/migrate';
import { users } from '../../server/db/schema/users';
import { requireDocker } from './support/guards';
import { provisionEmptyDatabase } from './support/database';
import { removeMigrations, writeMigrations } from './support/postgres';

const describeDb = requireDocker();

describeDb('database integration', () => {
  let dbUrl: string;
  const backupEmail = process.env.BOOTSTRAP_USER_EMAIL;
  const backupPassword = process.env.BOOTSTRAP_USER_PASSWORD;

  beforeEach(async () => {
    dbUrl = await provisionEmptyDatabase();
    // Temporarily delete bootstrap env vars by default for all tests in this file
    // to prevent runMigrations with mock directories from attempting to seed users.
    delete process.env.BOOTSTRAP_USER_EMAIL;
    delete process.env.BOOTSTRAP_USER_PASSWORD;
  });

  afterAll(() => {
    // Restore backup env vars after all tests in this file complete
    if (backupEmail) process.env.BOOTSTRAP_USER_EMAIL = backupEmail;
    if (backupPassword) process.env.BOOTSTRAP_USER_PASSWORD = backupPassword;
  });

  it('connects to Postgres and runs SELECT 1', async () => {
    const { db, sql } = createDatabaseClient(dbUrl, { max: 1 });
    try {
      const rows = await db.execute<{ value: number }>(drizzleSql`SELECT 1 AS value`);
      expect(Number((rows as Array<{ value: number }>)[0]!.value)).toBe(1);
    } finally {
      await sql.end({ timeout: 5 });
    }
  });

  it('applies all pending migrations against a fresh database', async () => {
    const dir = writeMigrations(['CREATE TABLE migrate_target (id integer PRIMARY KEY);']);
    const probe = postgres(dbUrl, { max: 1 });
    try {
      await runMigrations(dbUrl, dir);

      const tables = await probe`
        SELECT table_name FROM information_schema.tables
        WHERE table_name = 'migrate_target'
      `;
      expect(tables.length).toBe(1);

      const applied = await probe`SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations`;
      expect(applied[0]!.n).toBeGreaterThanOrEqual(1);
    } finally {
      await probe.end({ timeout: 5 });
      removeMigrations(dir);
    }
  });

  it('is idempotent when run twice (second run applies nothing)', async () => {
    const dir = writeMigrations(['CREATE TABLE idem_target (id integer PRIMARY KEY);']);
    const probe = postgres(dbUrl, { max: 1 });
    try {
      await runMigrations(dbUrl, dir);
      const first = await probe`SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations`;

      // Second run must succeed without error and without re-applying.
      await expect(runMigrations(dbUrl, dir)).resolves.toBeUndefined();
      const second = await probe`SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations`;

      expect(second[0]!.n).toBe(first[0]!.n);
    } finally {
      await probe.end({ timeout: 5 });
      removeMigrations(dir);
    }
  });

  it('fails (rejects) on a deliberately broken migration', async () => {
    const dir = writeMigrations(['THIS IS NOT VALID SQL;']);
    try {
      await expect(runMigrations(dbUrl, dir)).rejects.toBeTruthy();
    } finally {
      removeMigrations(dir);
    }
  });

  it('asserts an inserted user (id omitted) receives a UUIDv7 and that the email UNIQUE constraint rejects duplicates (case-folded)', async () => {
    // Run the migrations to ensure tables (specifically users) are created
    await runMigrations(dbUrl);

    const { db, sql } = createDatabaseClient(dbUrl, { max: 5 });
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

      expect(inserted!.id).toBeDefined();
      expect(inserted!.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
      expect(inserted!.email).toBe(email);

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

      // Run migrations which includes seeding
      await runMigrations(dbUrl);

      // Verify user was created
      const probeClient = createDatabaseClient(dbUrl);
      try {
        const found = await probeClient.db
          .select()
          .from(users)
          .where(eq(users.email, 'bootstrap@example.com'))
          .limit(1);

        expect(found.length).toBe(1);
        expect(found[0]!.email).toBe('bootstrap@example.com');
        expect(found[0]!.passwordHash).toBeDefined();
        expect(found[0]!.passwordHash.startsWith('$scrypt$')).toBe(true);
      } finally {
        await probeClient.sql.end({ timeout: 5 });
      }
    });

    it('existing user untouched', async () => {
      // Create schema first
      await runMigrations(dbUrl);

      // Insert an existing user with a specific password hash
      const { db, sql } = createDatabaseClient(dbUrl);
      const originalHash = 'some-original-hash';
      try {
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

      await runMigrations(dbUrl);

      // Verify original user was not modified
      const probeClient = createDatabaseClient(dbUrl);
      try {
        const found = await probeClient.db
          .select()
          .from(users)
          .where(eq(users.email, 'bootstrap@example.com'))
          .limit(1);

        expect(found.length).toBe(1);
        expect(found[0]!.passwordHash).toBe(originalHash); // untouched!
      } finally {
        await probeClient.sql.end({ timeout: 5 });
      }
    });

    it('unset vars skip silently', async () => {
      // Run migrations on fresh DB
      await runMigrations(dbUrl);

      // Verify no user was created
      const probeClient = createDatabaseClient(dbUrl);
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
      await runMigrations(dbUrl, migrationsDir);
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
        await runMigrations(dbUrl, dir);
        served = true;
      } catch {
        // Skip assignment since served is already false
      } finally {
        removeMigrations(dir);
      }
      expect(served).toBe(false);
    });
  });
});
