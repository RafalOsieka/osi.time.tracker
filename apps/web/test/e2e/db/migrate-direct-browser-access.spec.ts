import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { createDatabaseClient } from '../../../server/db/client';
import { runMigrations } from '../../../server/db/migrate';
import { requireDocker } from '../harness/guards';
import { provisionEmptyDatabase } from '../harness/database';
import { applySqlFile, migrationFilesBefore, readMigrationSql } from '../harness/migrations';

const describeDb = requireDocker();

type TrackerRowBefore = {
  id: string;
  userId: string;
  name: string;
  systemType: string;
  baseUrl: string;
  executionMode: string;
  roundingRule: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  deletedAt: Date | string | null;
};

type TrackerRowAfter = {
  id: string;
  userId: string;
  name: string;
  systemType: string;
  baseUrl: string;
  directBrowserAccess: boolean;
  roundingRule: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  deletedAt: Date | string | null;
};

/**
 * Seeds pre-0020 client and extension trackers, applies the capability
 * migration, and asserts only `directBrowserAccess` is derived.
 */
describeDb('migrate tracker execution mode to direct browser access', () => {
  it('maps client to true and extension to false without changing related records', async () => {
    const dbUrl = await provisionEmptyDatabase();
    const { sql } = createDatabaseClient(dbUrl, { max: 5 });

    try {
      const migrationsDir = join(process.cwd(), 'server', 'db', 'migrations');
      for (const file of migrationFilesBefore(20, migrationsDir)) {
        await applySqlFile(sql, readMigrationSql(file, migrationsDir));
      }

      const [user] = await sql<{ id: string }[]>`
        INSERT INTO "users" ("email", "passwordHash")
        VALUES ('migrate-direct-browser@example.com', 'hash')
        RETURNING id
      `;
      if (!user) throw new Error('user');

      const [clientTracker] = await sql<TrackerRowBefore[]>`
        INSERT INTO "trackers"
          ("userId", "name", "systemType", "baseUrl", "executionMode", "roundingRule")
        VALUES
          (${user.id}, 'Client Tracker', 'redmine', 'https://client.example.com', 'client', 'none')
        RETURNING *
      `;
      const [extensionTracker] = await sql<TrackerRowBefore[]>`
        INSERT INTO "trackers"
          ("userId", "name", "systemType", "baseUrl", "executionMode", "roundingRule")
        VALUES
          (${user.id}, 'Extension Tracker', 'openproject', 'https://extension.example.com', 'extension', 'nearest_30m')
        RETURNING *
      `;
      if (!clientTracker || !extensionTracker) throw new Error('trackers');

      const [project] = await sql<{ id: string; trackerId: string }[]>`
        INSERT INTO "projects" ("userId", "trackerId", "name")
        VALUES (${user.id}, ${extensionTracker.id}, 'Linked Project')
        RETURNING id, "trackerId"
      `;
      if (!project) throw new Error('project');

      const [task] = await sql<
        { id: string; trackerId: string | null; remoteIssueId: string | null }[]
      >`
        INSERT INTO "tasks"
          ("userId", "projectId", "name", "trackerId", "remoteIssueId", "remoteIssueCachedTitle")
        VALUES
          (${user.id}, ${project.id}, 'Linked Task', ${extensionTracker.id}, '42', 'Cached title')
        RETURNING id, "trackerId", "remoteIssueId"
      `;
      if (!task) throw new Error('task');

      await applySqlFile(sql, readMigrationSql('0020_direct_browser_access.sql', migrationsDir));

      const after = await sql<TrackerRowAfter[]>`
        SELECT * FROM "trackers" ORDER BY "name"
      `;
      expect(after).toHaveLength(2);

      const clientAfter = after.find((row) => row.id === clientTracker.id);
      const extensionAfter = after.find((row) => row.id === extensionTracker.id);
      if (!clientAfter || !extensionAfter) throw new Error('after rows');

      expect(clientAfter).toMatchObject({
        id: clientTracker.id,
        userId: clientTracker.userId,
        name: clientTracker.name,
        systemType: clientTracker.systemType,
        baseUrl: clientTracker.baseUrl,
        roundingRule: clientTracker.roundingRule,
        directBrowserAccess: true,
      });
      expect(clientAfter.deletedAt).toBeNull();
      expect(new Date(clientAfter.createdAt).getTime()).toBe(
        new Date(clientTracker.createdAt).getTime(),
      );
      expect(new Date(clientAfter.updatedAt).getTime()).toBe(
        new Date(clientTracker.updatedAt).getTime(),
      );
      expect('executionMode' in clientAfter).toBe(false);

      expect(extensionAfter).toMatchObject({
        id: extensionTracker.id,
        userId: extensionTracker.userId,
        name: extensionTracker.name,
        systemType: extensionTracker.systemType,
        baseUrl: extensionTracker.baseUrl,
        roundingRule: extensionTracker.roundingRule,
        directBrowserAccess: false,
      });
      expect(extensionAfter.deletedAt).toBeNull();
      expect(new Date(extensionAfter.createdAt).getTime()).toBe(
        new Date(extensionTracker.createdAt).getTime(),
      );
      expect(new Date(extensionAfter.updatedAt).getTime()).toBe(
        new Date(extensionTracker.updatedAt).getTime(),
      );
      expect('executionMode' in extensionAfter).toBe(false);

      const columns = await sql<{ column_name: string }[]>`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'trackers' AND column_name IN ('executionMode', 'directBrowserAccess')
      `;
      expect(columns.map((column) => column.column_name).sort()).toEqual(['directBrowserAccess']);

      const projectAfter = await sql<{ trackerId: string }[]>`
        SELECT "trackerId" FROM "projects" WHERE id = ${project.id}
      `;
      expect(projectAfter[0]?.trackerId).toBe(extensionTracker.id);

      const taskAfter = await sql<{ trackerId: string | null; remoteIssueId: string | null }[]>`
        SELECT "trackerId", "remoteIssueId" FROM "tasks" WHERE id = ${task.id}
      `;
      expect(taskAfter[0]?.trackerId).toBe(extensionTracker.id);
      expect(taskAfter[0]?.remoteIssueId).toBe('42');
    } finally {
      await sql.end({ timeout: 5 });
    }
  });

  it('records the migration in drizzle history on a fresh database', async () => {
    const dbUrl = await provisionEmptyDatabase();
    await runMigrations(dbUrl);
    const { sql } = createDatabaseClient(dbUrl, { max: 1 });

    try {
      const migrationsDir = join(process.cwd(), 'server', 'db', 'migrations');
      const journal = z
        .object({ entries: z.array(z.object({ tag: z.string() })) })
        .parse(JSON.parse(readFileSync(join(migrationsDir, 'meta', '_journal.json'), 'utf8')));
      expect(journal.entries.map((entry) => entry.tag)).toContain('0020_direct_browser_access');

      const applied = await sql<{ n: number }[]>`
        SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations
      `;
      expect(applied[0]?.n).toBe(journal.entries.length);
    } finally {
      await sql.end({ timeout: 5 });
    }
  });
});
