import { expect, it } from 'vitest';
import { createDatabaseClient } from '../../server/db/client';
import { requireDocker } from './support/guards';
import { provisionEmptyDatabase } from './support/database';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const describeDb = requireDocker();

/**
 * Applies every migration SQL file up to (but not including) 0014, seeds a
 * representative pre-change dataset, then applies 0014 and asserts the
 * fan-out preserved every reference inline.
 *
 * Uses raw SQL against the historical pre-0014/pre-0015 schema (clients +
 * remote_system_configs + remote_issue_refs), not the current Drizzle models.
 */
describeDb('per-day remote issue refs migration', () => {
  it('fans refs onto tasks, rebuilds indexes, drops remote_issue_refs, keeps exports', async () => {
    const dbUrl = await provisionEmptyDatabase();
    const { sql } = createDatabaseClient(dbUrl, { max: 5 });

    try {
      // Apply migrations 0000..0013 only (pre-change schema still has remote_issue_refs).
      const migrationsDir = join(process.cwd(), 'server', 'db', 'migrations');
      const files = readdirSync(migrationsDir)
        .filter((f) => f.endsWith('.sql') && !f.startsWith('0014_') && !f.startsWith('0015_'))
        .sort();
      for (const file of files) {
        const content = readFileSync(join(migrationsDir, file), 'utf8');
        for (const statement of content.split('--> statement-breakpoint')) {
          const trimmed = statement.trim();
          if (trimmed) await sql.unsafe(trimmed);
        }
      }

      const [user] = await sql<{ id: string }[]>`
        INSERT INTO "users" ("email", "passwordHash")
        VALUES ('migrate@example.com', 'hash')
        RETURNING id
      `;
      if (!user) throw new Error('user');

      const [client] = await sql<{ id: string }[]>`
        INSERT INTO "clients" ("userId", "name")
        VALUES (${user.id}, 'Client')
        RETURNING id
      `;
      if (!client) throw new Error('client');

      const [project] = await sql<{ id: string }[]>`
        INSERT INTO "projects" ("userId", "clientId", "name")
        VALUES (${user.id}, ${client.id}, 'Project')
        RETURNING id
      `;
      if (!project) throw new Error('project');

      const [config] = await sql<{ id: string }[]>`
        INSERT INTO "remote_system_configs"
          ("userId", "clientId", "systemType", "baseUrl", "executionMode", "roundingRule")
        VALUES
          (${user.id}, ${client.id}, 'openproject', 'https://op.example.com', 'client', 'none')
        RETURNING id
      `;

      // Linked task
      const [linked] = await sql<{ id: string }[]>`
        INSERT INTO "tasks" ("userId", "projectId", "name")
        VALUES (${user.id}, ${project.id}, 'Linked Task')
        RETURNING id
      `;
      await sql`
        INSERT INTO "remote_issue_refs"
          ("taskId", "userId", "remoteSystemConfigId", "remoteIssueId", "cachedTitle")
        VALUES
          (${linked!.id}, ${user.id}, ${config!.id}, '4711', 'Cached Title')
      `;

      // Unlinked task (same project, different name)
      const [unlinked] = await sql<{ id: string }[]>`
        INSERT INTO "tasks" ("userId", "projectId", "name")
        VALUES (${user.id}, ${project.id}, 'Unlinked Task')
        RETURNING id
      `;

      // Project-less task
      const [projectless] = await sql<{ id: string }[]>`
        INSERT INTO "tasks" ("userId", "name")
        VALUES (${user.id}, 'Projectless Task')
        RETURNING id
      `;

      // Multi-day entries on the linked task
      await sql`
        INSERT INTO "time_entries" ("userId", "taskId", "startedAt", "stoppedAt")
        VALUES
          (${user.id}, ${linked!.id}, '2026-03-01T10:00:00Z', '2026-03-01T11:00:00Z'),
          (${user.id}, ${linked!.id}, '2026-03-02T10:00:00Z', '2026-03-02T11:00:00Z')
      `;

      const [exportRow] = await sql<{ id: string }[]>`
        INSERT INTO "remote_exports"
          ("userId", "taskId", "localDate", "remoteIssueId", "remoteLogId", "exportDurationSeconds")
        VALUES
          (${user.id}, ${linked!.id}, '2026-03-01', '4711', 'log-1', 3600)
        RETURNING id
      `;

      const taskCountBefore = await sql<{ c: string }[]>`SELECT count(*)::text AS c FROM tasks`;
      expect(Number(taskCountBefore[0]!.c)).toBe(3);

      // Apply migration 0014 via raw SQL.
      const migration14 = readFileSync(join(migrationsDir, '0014_loving_clea.sql'), 'utf8');
      for (const statement of migration14.split('--> statement-breakpoint')) {
        const trimmed = statement.trim();
        if (trimmed) await sql.unsafe(trimmed);
      }

      // remote_issue_refs table is gone
      const tables = await sql<{ table_name: string }[]>`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'remote_issue_refs'
      `;
      expect(tables).toHaveLength(0);

      // No task merged or removed
      const taskCountAfter = await sql<{ c: string }[]>`SELECT count(*)::text AS c FROM tasks`;
      expect(Number(taskCountAfter[0]!.c)).toBe(3);

      // Linked task carries the reference inline (column still remoteSystemConfigId pre-0015)
      const linkedAfter = await sql<
        {
          remoteIssueId: string | null;
          remoteIssueCachedTitle: string | null;
          remoteSystemConfigId: string | null;
        }[]
      >`
        SELECT "remoteIssueId", "remoteIssueCachedTitle", "remoteSystemConfigId"
        FROM tasks WHERE id = ${linked!.id}
      `;
      expect(linkedAfter[0]?.remoteIssueId).toBe('4711');
      expect(linkedAfter[0]?.remoteIssueCachedTitle).toBe('Cached Title');
      expect(linkedAfter[0]?.remoteSystemConfigId).toBe(config!.id);

      // Unlinked and project-less remain null
      const unlinkedAfter = await sql<{ remoteIssueId: string | null }[]>`
        SELECT "remoteIssueId" FROM tasks WHERE id = ${unlinked!.id}
      `;
      expect(unlinkedAfter[0]?.remoteIssueId).toBeNull();
      const projectlessAfter = await sql<{ remoteIssueId: string | null }[]>`
        SELECT "remoteIssueId" FROM tasks WHERE id = ${projectless!.id}
      `;
      expect(projectlessAfter[0]?.remoteIssueId).toBeNull();

      // Export still resolvable to the same task id
      const exportAfter = await sql<{ taskId: string | null }[]>`
        SELECT "taskId" FROM remote_exports WHERE id = ${exportRow!.id}
      `;
      expect(exportAfter[0]?.taskId).toBe(linked!.id);

      // NULLS NOT DISTINCT unique constraint rejects a second unlinked twin
      await expect(
        sql`
          INSERT INTO "tasks" ("userId", "projectId", "name")
          VALUES (${user.id}, ${project.id}, 'Unlinked Task')
        `,
      ).rejects.toThrow();

      // Different remoteIssueId with same name is accepted
      await sql`
        INSERT INTO "tasks" ("userId", "projectId", "name", "remoteIssueId", "remoteIssueCachedTitle")
        VALUES (${user.id}, ${project.id}, 'Linked Task', '4899', 'Other')
      `;
    } finally {
      await sql.end({ timeout: 5 });
    }
  });
});
