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

type TrackerRow = {
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

/**
 * Seeds pre-0019 trackers (including `server`), applies the data migration,
 * and asserts only `executionMode` changes on those rows.
 */
describeDb('migrate server execution mode', () => {
  it('converts persisted server modes to client and leaves other rows and columns unchanged', async () => {
    const dbUrl = await provisionEmptyDatabase();
    const { sql } = createDatabaseClient(dbUrl, { max: 5 });

    try {
      const migrationsDir = join(process.cwd(), 'server', 'db', 'migrations');
      for (const file of migrationFilesBefore(19, migrationsDir)) {
        await applySqlFile(sql, readMigrationSql(file, migrationsDir));
      }

      const [user] = await sql<{ id: string }[]>`
        INSERT INTO "users" ("email", "passwordHash")
        VALUES ('migrate-execution-mode@example.com', 'hash')
        RETURNING id
      `;
      if (!user) throw new Error('user');

      const [serverTracker] = await sql<TrackerRow[]>`
        INSERT INTO "trackers"
          ("userId", "name", "systemType", "baseUrl", "executionMode", "roundingRule")
        VALUES
          (${user.id}, 'Server Tracker', 'openproject', 'https://server.example.com', 'server', 'up_15m')
        RETURNING *
      `;
      const [clientTracker] = await sql<TrackerRow[]>`
        INSERT INTO "trackers"
          ("userId", "name", "systemType", "baseUrl", "executionMode", "roundingRule")
        VALUES
          (${user.id}, 'Client Tracker', 'redmine', 'https://client.example.com', 'client', 'none')
        RETURNING *
      `;
      const [extensionTracker] = await sql<TrackerRow[]>`
        INSERT INTO "trackers"
          ("userId", "name", "systemType", "baseUrl", "executionMode", "roundingRule")
        VALUES
          (${user.id}, 'Extension Tracker', 'openproject', 'https://extension.example.com', 'extension', 'nearest_30m')
        RETURNING *
      `;
      if (!serverTracker || !clientTracker || !extensionTracker) throw new Error('trackers');

      const [project] = await sql<{ id: string; trackerId: string }[]>`
        INSERT INTO "projects" ("userId", "trackerId", "name")
        VALUES (${user.id}, ${serverTracker.id}, 'Linked Project')
        RETURNING id, "trackerId"
      `;
      if (!project) throw new Error('project');

      const [task] = await sql<
        { id: string; trackerId: string | null; remoteIssueId: string | null }[]
      >`
        INSERT INTO "tasks"
          ("userId", "projectId", "name", "trackerId", "remoteIssueId", "remoteIssueCachedTitle")
        VALUES
          (${user.id}, ${project.id}, 'Linked Task', ${serverTracker.id}, '42', 'Cached title')
        RETURNING id, "trackerId", "remoteIssueId"
      `;
      if (!task) throw new Error('task');

      await applySqlFile(
        sql,
        readMigrationSql('0019_migrate_server_execution_mode.sql', migrationsDir),
      );

      const after = await sql<TrackerRow[]>`
        SELECT * FROM "trackers" ORDER BY "name"
      `;
      expect(after).toHaveLength(3);

      const serverAfter = after.find((row) => row.id === serverTracker.id);
      const clientAfter = after.find((row) => row.id === clientTracker.id);
      const extensionAfter = after.find((row) => row.id === extensionTracker.id);
      if (!serverAfter || !clientAfter || !extensionAfter) throw new Error('after rows');

      expect(serverAfter.executionMode).toBe('client');
      expect(serverAfter.id).toBe(serverTracker.id);
      expect(serverAfter.userId).toBe(serverTracker.userId);
      expect(serverAfter.name).toBe(serverTracker.name);
      expect(serverAfter.systemType).toBe(serverTracker.systemType);
      expect(serverAfter.baseUrl).toBe(serverTracker.baseUrl);
      expect(serverAfter.roundingRule).toBe(serverTracker.roundingRule);
      expect(serverAfter.deletedAt).toBeNull();
      expect(new Date(serverAfter.createdAt).getTime()).toBe(
        new Date(serverTracker.createdAt).getTime(),
      );
      expect(new Date(serverAfter.updatedAt).getTime()).toBe(
        new Date(serverTracker.updatedAt).getTime(),
      );

      expect(clientAfter).toMatchObject({
        id: clientTracker.id,
        executionMode: 'client',
        name: clientTracker.name,
        systemType: clientTracker.systemType,
        baseUrl: clientTracker.baseUrl,
        roundingRule: clientTracker.roundingRule,
      });
      expect(extensionAfter).toMatchObject({
        id: extensionTracker.id,
        executionMode: 'extension',
        name: extensionTracker.name,
        systemType: extensionTracker.systemType,
        baseUrl: extensionTracker.baseUrl,
        roundingRule: extensionTracker.roundingRule,
      });

      const projectAfter = await sql<{ trackerId: string }[]>`
        SELECT "trackerId" FROM "projects" WHERE id = ${project.id}
      `;
      expect(projectAfter[0]?.trackerId).toBe(serverTracker.id);

      const taskAfter = await sql<{ trackerId: string | null; remoteIssueId: string | null }[]>`
        SELECT "trackerId", "remoteIssueId" FROM "tasks" WHERE id = ${task.id}
      `;
      expect(taskAfter[0]?.trackerId).toBe(serverTracker.id);
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
      expect(journal.entries.map((entry) => entry.tag)).toContain(
        '0019_migrate_server_execution_mode',
      );

      const applied = await sql<{ n: number }[]>`
        SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations
      `;
      expect(applied[0]?.n).toBe(journal.entries.length);
    } finally {
      await sql.end({ timeout: 5 });
    }
  });
});
