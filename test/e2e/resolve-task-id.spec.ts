import { expect, it, afterAll } from 'vitest';
import { requireDocker } from './support/guards';
import { provisionDatabase } from './support/database';
import { seedUsers } from './support/seed';
import { createDatabaseClient } from '../../server/db/client';
import { users, tasks } from '../../server/db/schema';
import { resolveTaskId } from '../../server/utils/tasks';
import { eq } from 'drizzle-orm';

const describeResolveTaskId = requireDocker();

describeResolveTaskId('resolveTaskId', async () => {
  const dbUrl = await provisionDatabase();
  await seedUsers(dbUrl, [{ email: 'resolver@example.com', displayName: 'Resolver' }]);
  const { db, sql } = createDatabaseClient(dbUrl);

  afterAll(async () => {
    await sql.end({ timeout: 5 });
  });

  async function getUserId(): Promise<string> {
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, 'resolver@example.com'))
      .limit(1);
    return user!.id;
  }

  it('returns null for an empty or whitespace-only title', async () => {
    const userId = await getUserId();
    const result = await db.transaction(async (tx) => {
      const empty = await resolveTaskId(tx, userId, '', null);
      const whitespace = await resolveTaskId(tx, userId, '   ', null);
      const missing = await resolveTaskId(tx, userId, undefined, null);
      return { empty, whitespace, missing };
    });
    expect(result.empty).toBeNull();
    expect(result.whitespace).toBeNull();
    expect(result.missing).toBeNull();
  });

  it('creates a new task when no match exists', async () => {
    const userId = await getUserId();
    const taskId = await db.transaction((tx) => resolveTaskId(tx, userId, 'Brand New Task', null));
    expect(taskId).toBeTruthy();
    const [created] = await db.select().from(tasks).where(eq(tasks.id, taskId!)).limit(1);
    expect(created?.name).toBe('Brand New Task');
    expect(created?.projectId).toBeNull();
  });

  it('matches an existing non-deleted task in the same project-less scope', async () => {
    const userId = await getUserId();
    const firstId = await db.transaction((tx) => resolveTaskId(tx, userId, 'Repeat Task', null));
    const secondId = await db.transaction((tx) =>
      resolveTaskId(tx, userId, '  Repeat Task  ', null),
    );
    expect(secondId).toBe(firstId);
  });

  it('silently matches project-less tasks (projectId undefined and null are equivalent)', async () => {
    const userId = await getUserId();
    const firstId = await db.transaction((tx) =>
      resolveTaskId(tx, userId, 'Silent Match Task', undefined),
    );
    const secondId = await db.transaction((tx) =>
      resolveTaskId(tx, userId, 'Silent Match Task', null),
    );
    expect(secondId).toBe(firstId);
  });
});
