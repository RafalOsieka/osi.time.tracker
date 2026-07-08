import { expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createDatabaseClient } from '../../server/db/client';
import { users } from '../../server/db/schema/users';
import { clients } from '../../server/db/schema/clients';
import { projects } from '../../server/db/schema/projects';
import { tasks } from '../../server/db/schema/tasks';
import { requireDocker } from './support/guards';
import { provisionDatabase } from './support/database';

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

      const [client] = await db
        .insert(clients)
        .values({ userId: userA.id, name: 'Client A' })
        .returning();
      if (!client) throw new Error('client not inserted');
      const [project] = await db
        .insert(projects)
        .values({ userId: userA.id, clientId: client.id, name: 'Project A' })
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

      // Duplicate (userId, projectId=null, name) must be rejected
      await expect(
        db.insert(tasks).values({ userId: userA.id, name: 'Standalone Task' }),
      ).rejects.toThrow();

      // Duplicate (userId, projectId, name) must be rejected
      await expect(
        db
          .insert(tasks)
          .values({ userId: userA.id, projectId: project.id, name: 'Standalone Task' }),
      ).rejects.toThrow();

      // Hard-deleting the conflicting row frees up the name for reuse (no soft-delete anymore)
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
