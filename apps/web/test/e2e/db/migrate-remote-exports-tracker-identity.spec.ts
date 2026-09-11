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

const migrationsDir = join(process.cwd(), 'server', 'db', 'migrations');
const migrationFile = '0021_remote_exports_tracker_identity.sql';

async function seedUserAndTrackers(sql: ReturnType<typeof createDatabaseClient>['sql']) {
  const [user] = await sql<{ id: string }[]>`
    INSERT INTO "users" ("email", "passwordHash")
    VALUES ('migrate-export-tracker@example.com', 'hash')
    RETURNING id
  `;
  if (!user) throw new Error('user');

  const [trackerA] = await sql<{ id: string }[]>`
    INSERT INTO "trackers"
      ("userId", "name", "systemType", "baseUrl", "directBrowserAccess", "roundingRule")
    VALUES
      (${user.id}, 'Tracker A', 'openproject', 'https://a.example.com', true, 'none')
    RETURNING id
  `;
  const [trackerB] = await sql<{ id: string }[]>`
    INSERT INTO "trackers"
      ("userId", "name", "systemType", "baseUrl", "directBrowserAccess", "roundingRule")
    VALUES
      (${user.id}, 'Tracker B', 'redmine', 'https://b.example.com', true, 'none')
    RETURNING id
  `;
  if (!trackerA || !trackerB) throw new Error('trackers');

  return { user, trackerA, trackerB };
}

describeDb('migrate remote export tracker identity', () => {
  it('backfills tracker identity and allows the same remote log id on different trackers', async () => {
    const dbUrl = await provisionEmptyDatabase();
    const { sql } = createDatabaseClient(dbUrl, { max: 5 });

    try {
      for (const file of migrationFilesBefore(21, migrationsDir)) {
        await applySqlFile(sql, readMigrationSql(file, migrationsDir));
      }

      const { user, trackerA, trackerB } = await seedUserAndTrackers(sql);

      const [projectFromTask] = await sql<{ id: string }[]>`
        INSERT INTO "projects" ("userId", "trackerId", "name")
        VALUES (${user.id}, ${trackerA.id}, 'Task-linked Project')
        RETURNING id
      `;
      const [projectFromProject] = await sql<{ id: string }[]>`
        INSERT INTO "projects" ("userId", "trackerId", "name")
        VALUES (${user.id}, ${trackerB.id}, 'Project-linked Project')
        RETURNING id
      `;
      if (!projectFromTask || !projectFromProject) throw new Error('projects');

      const [taskFromTask] = await sql<{ id: string }[]>`
        INSERT INTO "tasks"
          ("userId", "projectId", "name", "trackerId", "remoteIssueId", "remoteIssueCachedTitle")
        VALUES
          (${user.id}, ${projectFromTask.id}, 'Task A', ${trackerA.id}, '42', 'A')
        RETURNING id
      `;
      const [taskFromProject] = await sql<{ id: string }[]>`
        INSERT INTO "tasks" ("userId", "projectId", "name")
        VALUES (${user.id}, ${projectFromProject.id}, 'Task B')
        RETURNING id
      `;
      if (!taskFromTask || !taskFromProject) throw new Error('tasks');

      const [exportA] = await sql<{ id: string }[]>`
        INSERT INTO "remote_exports"
          ("userId", "taskId", "localDate", "remoteIssueId", "remoteLogId", "exportDurationSeconds")
        VALUES
          (${user.id}, ${taskFromTask.id}, '2026-03-15', '42', 'shared-log', 1800)
        RETURNING id
      `;
      const [exportB] = await sql<{ id: string }[]>`
        INSERT INTO "remote_exports"
          ("userId", "taskId", "localDate", "remoteIssueId", "remoteLogId", "exportDurationSeconds")
        VALUES
          (${user.id}, ${taskFromProject.id}, '2026-03-15', '99', 'shared-log', 900)
        RETURNING id
      `;
      if (!exportA || !exportB) throw new Error('exports');

      await applySqlFile(sql, readMigrationSql(migrationFile, migrationsDir));

      const after = await sql<{ id: string; trackerId: string; remoteLogId: string }[]>`
        SELECT id, "trackerId", "remoteLogId" FROM "remote_exports" ORDER BY "exportDurationSeconds" DESC
      `;
      expect(after).toEqual([
        { id: exportA.id, trackerId: trackerA.id, remoteLogId: 'shared-log' },
        { id: exportB.id, trackerId: trackerB.id, remoteLogId: 'shared-log' },
      ]);

      await expect(
        sql`
          INSERT INTO "remote_exports"
            ("userId", "taskId", "trackerId", "localDate", "remoteIssueId", "remoteLogId", "exportDurationSeconds")
          VALUES
            (${user.id}, ${taskFromTask.id}, ${trackerA.id}, '2026-03-16', '42', 'shared-log', 600)
        `,
      ).rejects.toThrow();
    } finally {
      await sql.end({ timeout: 5 });
    }
  });

  it('fails when a legacy export cannot resolve a tracker', async () => {
    const dbUrl = await provisionEmptyDatabase();
    const { sql } = createDatabaseClient(dbUrl, { max: 5 });

    try {
      for (const file of migrationFilesBefore(21, migrationsDir)) {
        await applySqlFile(sql, readMigrationSql(file, migrationsDir));
      }

      const [user] = await sql<{ id: string }[]>`
        INSERT INTO "users" ("email", "passwordHash")
        VALUES ('migrate-export-tracker-fail@example.com', 'hash')
        RETURNING id
      `;
      if (!user) throw new Error('user');

      const [project] = await sql<{ id: string }[]>`
        INSERT INTO "projects" ("userId", "name")
        VALUES (${user.id}, 'Local Project')
        RETURNING id
      `;
      if (!project) throw new Error('project');

      const [task] = await sql<{ id: string }[]>`
        INSERT INTO "tasks" ("userId", "projectId", "name")
        VALUES (${user.id}, ${project.id}, 'Local Task')
        RETURNING id
      `;
      if (!task) throw new Error('task');

      const [exportRow] = await sql<{ id: string }[]>`
        INSERT INTO "remote_exports"
          ("userId", "taskId", "localDate", "remoteIssueId", "remoteLogId", "exportDurationSeconds")
        VALUES
          (${user.id}, ${task.id}, '2026-03-15', '42', 'orphan-log', 1800)
        RETURNING id
      `;
      if (!exportRow) throw new Error('export');

      await expect(
        applySqlFile(sql, readMigrationSql(migrationFile, migrationsDir)),
      ).rejects.toThrow(/trackerId backfill failed/);
    } finally {
      await sql.end({ timeout: 5 });
    }
  });

  it('records the migration in drizzle history on a fresh database', async () => {
    const dbUrl = await provisionEmptyDatabase();
    await runMigrations(dbUrl);
    const { sql } = createDatabaseClient(dbUrl, { max: 1 });

    try {
      const journal = z
        .object({ entries: z.array(z.object({ tag: z.string() })) })
        .parse(JSON.parse(readFileSync(join(migrationsDir, 'meta', '_journal.json'), 'utf8')));
      expect(journal.entries.map((entry) => entry.tag)).toContain(
        '0021_remote_exports_tracker_identity',
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
