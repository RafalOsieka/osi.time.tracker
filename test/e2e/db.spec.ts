import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { sql as drizzleSql } from "drizzle-orm";
import { createDatabaseClient } from "../../server/db/client";
import { runMigrations } from "../../server/db/migrate";
import {
  TEST_DATABASE_URL,
  isDockerAvailable,
  removeMigrations,
  startPostgres,
  stopPostgres,
  writeMigrations,
} from "./support/postgres";

const dockerAvailable = isDockerAvailable();
const describeDb = dockerAvailable ? describe : describe.skip;

if (!dockerAvailable) {
  // eslint-disable-next-line no-console
  console.warn("[db.spec] Docker not available — skipping DB integration tests.");
}

describeDb("database integration", () => {
  beforeAll(async () => {
    await startPostgres();
  }, 180_000);

  afterAll(() => {
    stopPostgres();
  });

  it("connects to Postgres and runs SELECT 1", async () => {
    const { db, sql } = createDatabaseClient(TEST_DATABASE_URL, { max: 1 });
    try {
      const rows = await db.execute<{ value: number }>(
        drizzleSql`SELECT 1 AS value`,
      );
      expect(Number((rows as Array<{ value: number }>)[0].value)).toBe(1);
    } finally {
      await sql.end({ timeout: 5 });
    }
  });

  it("applies all pending migrations against a fresh database", async () => {
    const dir = writeMigrations([
      "CREATE TABLE migrate_target (id integer PRIMARY KEY);",
    ]);
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

  it("is idempotent when run twice (second run applies nothing)", async () => {
    const dir = writeMigrations([
      "CREATE TABLE idem_target (id integer PRIMARY KEY);",
    ]);
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

  it("fails (rejects) on a deliberately broken migration", async () => {
    const dir = writeMigrations(["THIS IS NOT VALID SQL;"]);
    try {
      await expect(runMigrations(TEST_DATABASE_URL, dir)).rejects.toBeTruthy();
    } finally {
      removeMigrations(dir);
    }
  });

  describe("startup sequence (dedicated migrate step)", () => {
    // Models the Compose migrate-then-serve contract: the app only begins
    // serving traffic after migrations complete; a migration failure blocks it.
    async function startupSequence(migrationsDir: string): Promise<string[]> {
      const events: string[] = [];
      await runMigrations(TEST_DATABASE_URL, migrationsDir);
      events.push("migrations-complete");
      events.push("serving-traffic");
      return events;
    }

    it("runs migrations to completion before serving traffic", async () => {
      const dir = writeMigrations([
        "CREATE TABLE startup_ok (id integer PRIMARY KEY);",
      ]);
      try {
        const events = await startupSequence(dir);
        expect(events).toEqual(["migrations-complete", "serving-traffic"]);
      } finally {
        removeMigrations(dir);
      }
    });

    it("blocks startup (never serves) when a migration fails", async () => {
      const dir = writeMigrations(["BROKEN SQL HERE;"]);
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
