import { expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createDatabaseClient } from '../../../server/db/client';
import { users } from '../../../server/db/schema/users';
import { trackers } from '../../../server/db/schema/trackers';
import { projects } from '../../../server/db/schema/projects';
import { tasks } from '../../../server/db/schema/tasks';
import { requireDocker } from '../harness/guards';
import { provisionDatabase } from '../harness/database';

const describeDb = requireDocker();

describeDb('tasks schema', () => {
  it('has no deletedAt column and enforces per-scope name uniqueness via hard-delete only', async () => {
    const dbUrl = await provisionDatabase();
    const { db, sql } = createDatabaseClient(dbUrl, { max: 5 });

    try {
      // No deletedAt column on tasks
      const columns = await sql<{ column_name: string }[]>`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'tasks' AND column_name = 'deletedAt'
      `;
      expect(columns).toHaveLength(0);

      const [userA] = await db
        .insert(users)
        .values({ email: 'tasks-schema-a@example.com', passwordHash: 'hash' })
        .returning();
      if (!userA) throw new Error('userA not inserted');
      const [userB] = await db
        .insert(users)
        .values({ email: 'tasks-schema-b@example.com', passwordHash: 'hash' })
        .returning();
      if (!userB) throw new Error('userB not inserted');

      const [tracker] = await db
        .insert(trackers)
        .values({
          userId: userA.id,
          name: 'Tracker A',
          systemType: 'openproject',
          baseUrl: 'https://op.example.com',
          executionMode: 'client',
          roundingRule: 'none',
        })
        .returning();
      if (!tracker) throw new Error('tracker not inserted');
      const [project] = await db
        .insert(projects)
        .values({ userId: userA.id, trackerId: tracker.id, name: 'Project A' })
        .returning();
      if (!project) throw new Error('project not inserted');

      // projectId is nullable
      const [taskWithoutProject] = await db
        .insert(tasks)
        .values({ userId: userA.id, name: 'Standalone Task' })
        .returning();
      if (!taskWithoutProject) throw new Error('taskWithoutProject not inserted');
      expect(taskWithoutProject.projectId).toBeNull();

      // A different (userId, projectId, name) scope allows the same name
      const [scopedNameTask] = await db
        .insert(tasks)
        .values({ userId: userA.id, projectId: project.id, name: 'Standalone Task' })
        .returning();
      if (!scopedNameTask) throw new Error('scopedNameTask not inserted');
      expect(scopedNameTask.name).toBe('Standalone Task');

      // The same name can be reused across different users
      const [otherUserTask] = await db
        .insert(tasks)
        .values({ userId: userB.id, name: 'Standalone Task' })
        .returning();
      if (!otherUserTask) throw new Error('otherUserTask not inserted');
      expect(otherUserTask.name).toBe('Standalone Task');

      // Duplicate unlinked (userId, projectId=null, name) must be rejected
      await expect(
        db.insert(tasks).values({ userId: userA.id, name: 'Standalone Task' }),
      ).rejects.toThrow();

      // Duplicate unlinked (userId, projectId, name) must be rejected
      await expect(
        db
          .insert(tasks)
          .values({ userId: userA.id, projectId: project.id, name: 'Standalone Task' }),
      ).rejects.toThrow();

      // Same name with a different remoteIssueId is allowed (project-scoped).
      const now = new Date();
      const [linkedTwin] = await db
        .insert(tasks)
        .values({
          userId: userA.id,
          projectId: project.id,
          name: 'Standalone Task',
          remoteIssueId: '4711',
          remoteIssueCachedTitle: 'Issue 4711',
          remoteIssueCreatedAt: now,
          remoteIssueUpdatedAt: now,
          trackerId: tracker.id,
        })
        .returning();
      if (!linkedTwin) throw new Error('linkedTwin not inserted');
      expect(linkedTwin.remoteIssueId).toBe('4711');

      // Same name with a different remoteIssueId is allowed (project-less).
      const [linkedProjectless] = await db
        .insert(tasks)
        .values({
          userId: userA.id,
          name: 'Standalone Task',
          remoteIssueId: '4899',
          remoteIssueCachedTitle: 'Issue 4899',
          remoteIssueCreatedAt: now,
          remoteIssueUpdatedAt: now,
          trackerId: tracker.id,
        })
        .returning();
      if (!linkedProjectless) throw new Error('linkedProjectless not inserted');
      expect(linkedProjectless.remoteIssueId).toBe('4899');

      // Hard-deleting the conflicting unlinked row frees up the name for reuse
      await db.delete(tasks).where(eq(tasks.id, taskWithoutProject.id));
      const [reusedNameTask] = await db
        .insert(tasks)
        .values({ userId: userA.id, name: 'Standalone Task' })
        .returning();
      if (!reusedNameTask) throw new Error('reusedNameTask not inserted');
      expect(reusedNameTask.name).toBe('Standalone Task');
    } finally {
      await sql.end({ timeout: 5 });
    }
  });
});
