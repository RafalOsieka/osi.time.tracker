import { expect, it } from 'vitest';
import { createDatabaseClient } from '../../server/db/client';
import { users } from '../../server/db/schema/users';
import { clients } from '../../server/db/schema/clients';
import { projects } from '../../server/db/schema/projects';
import { tasks } from '../../server/db/schema/tasks';
import { requireDocker } from './support/guards';
import { provisionDatabase } from './support/database';

const describeDb = requireDocker();

describeDb('tasks schema', () => {
  it('allows a nullable projectId, allows duplicate names, and enforces a per-user unique task number', async () => {
    const dbUrl = await provisionDatabase();
    const { db, sql } = createDatabaseClient(dbUrl, { max: 5 });

    try {
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
        .values({ userId: userA.id, name: 'Standalone Task', number: 1 })
        .returning();
      if (!taskWithoutProject) throw new Error('taskWithoutProject not inserted');
      expect(taskWithoutProject.projectId).toBeNull();

      // Duplicate task names are allowed for the same user
      const [duplicateNameTask] = await db
        .insert(tasks)
        .values({ userId: userA.id, projectId: project.id, name: 'Standalone Task', number: 2 })
        .returning();
      if (!duplicateNameTask) throw new Error('duplicateNameTask not inserted');
      expect(duplicateNameTask.name).toBe('Standalone Task');

      // The same task number can be reused across different users
      const [otherUserTask] = await db
        .insert(tasks)
        .values({ userId: userB.id, name: 'Other User Task', number: 1 })
        .returning();
      if (!otherUserTask) throw new Error('otherUserTask not inserted');
      expect(otherUserTask.number).toBe(1);

      // Duplicate task numbers for the same user must be rejected
      await expect(
        db.insert(tasks).values({ userId: userA.id, name: 'Conflicting Number', number: 1 }),
      ).rejects.toThrow();
    } finally {
      await sql.end({ timeout: 5 });
    }
  });
});
