import { expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createDatabaseClient } from '../../server/db/client';
import { users } from '../../server/db/schema/users';
import { clients } from '../../server/db/schema/clients';
import { projects } from '../../server/db/schema/projects';
import { tasks } from '../../server/db/schema/tasks';
import { timeEntries } from '../../server/db/schema/time-entries';
import { remoteExports, remoteExportEntries } from '../../server/db/schema/remote-exports';
import { requireDocker } from './support/guards';
import { provisionDatabase } from './support/database';

const describeDb = requireDocker();

describeDb('remote exports schema', () => {
  it('allows multiple provenance rows per task/day and entry, and cascades junction deletes', async () => {
    const dbUrl = await provisionDatabase();
    const { db, sql } = createDatabaseClient(dbUrl, { max: 5 });

    try {
      const [user] = await db
        .insert(users)
        .values({ email: 'remote-export-schema@example.com', passwordHash: 'hash' })
        .returning();
      if (!user) throw new Error('user not inserted');

      const [client] = await db
        .insert(clients)
        .values({ userId: user.id, name: 'Export Client' })
        .returning();
      if (!client) throw new Error('client not inserted');

      const [project] = await db
        .insert(projects)
        .values({ userId: user.id, clientId: client.id, name: 'Export Project' })
        .returning();
      if (!project) throw new Error('project not inserted');

      const [task] = await db
        .insert(tasks)
        .values({ userId: user.id, projectId: project.id, name: 'Export Task' })
        .returning();
      if (!task) throw new Error('task not inserted');

      const startedAt = new Date('2026-03-15T10:00:00.000Z');
      const stoppedAt = new Date('2026-03-15T10:30:00.000Z');
      const [entryA] = await db
        .insert(timeEntries)
        .values({ userId: user.id, taskId: task.id, startedAt, stoppedAt })
        .returning();
      const [entryB] = await db
        .insert(timeEntries)
        .values({
          userId: user.id,
          taskId: task.id,
          startedAt: new Date('2026-03-15T11:00:00.000Z'),
          stoppedAt: new Date('2026-03-15T11:15:00.000Z'),
        })
        .returning();
      if (!entryA || !entryB) throw new Error('entries not inserted');

      const [export1] = await db
        .insert(remoteExports)
        .values({
          userId: user.id,
          taskId: task.id,
          localDate: '2026-03-15',
          remoteIssueId: '42',
          remoteLogId: 'log-1',
          exportDurationSeconds: 1800,
          requiredFieldValues: { activity: '1' },
        })
        .returning();
      if (!export1) throw new Error('export1 not inserted');

      // Same task/day can receive another export (no uniqueness constraint).
      const [export2] = await db
        .insert(remoteExports)
        .values({
          userId: user.id,
          taskId: task.id,
          localDate: '2026-03-15',
          remoteIssueId: '42',
          remoteLogId: 'log-2',
          exportDurationSeconds: 900,
          requiredFieldValues: { activity: '2' },
        })
        .returning();
      if (!export2) throw new Error('export2 not inserted');

      await db.insert(remoteExportEntries).values([
        { exportId: export1.id, entryId: entryA.id, userId: user.id },
        { exportId: export1.id, entryId: entryB.id, userId: user.id },
        // Same entry may appear in a later export (intentional repeat).
        { exportId: export2.id, entryId: entryA.id, userId: user.id },
      ]);

      const exportsForDay = await db
        .select()
        .from(remoteExports)
        .where(eq(remoteExports.taskId, task.id));
      expect(exportsForDay).toHaveLength(2);

      const entryALinks = await db
        .select()
        .from(remoteExportEntries)
        .where(eq(remoteExportEntries.entryId, entryA.id));
      expect(entryALinks).toHaveLength(2);

      // Composite PK rejects duplicate (exportId, entryId).
      await expect(
        db.insert(remoteExportEntries).values({
          exportId: export1.id,
          entryId: entryA.id,
          userId: user.id,
        }),
      ).rejects.toThrow();

      // Deleting an export cascades its junction rows only.
      await db.delete(remoteExports).where(eq(remoteExports.id, export1.id));
      const remainingLinks = await db.select().from(remoteExportEntries);
      expect(remainingLinks).toHaveLength(1);
      expect(remainingLinks[0]!.exportId).toBe(export2.id);

      // Deleting a time entry cascades its junction associations.
      await db.delete(timeEntries).where(eq(timeEntries.id, entryA.id));
      const afterEntryDelete = await db.select().from(remoteExportEntries);
      expect(afterEntryDelete).toHaveLength(0);

      // Export header remains after entry cascade (entry was only on export2).
      const remainingExports = await db.select().from(remoteExports);
      expect(remainingExports).toHaveLength(1);
      expect(remainingExports[0]!.id).toBe(export2.id);

      // time_entries.taskId has no ON DELETE CASCADE, so clear remaining entries first.
      await db.delete(timeEntries).where(eq(timeEntries.taskId, task.id));

      // Deleting the task cascades remaining exports.
      await db.delete(tasks).where(eq(tasks.id, task.id));
      const exportsAfterTaskDelete = await db.select().from(remoteExports);
      expect(exportsAfterTaskDelete).toHaveLength(0);
    } finally {
      await sql.end({ timeout: 5 });
    }
  });
});
