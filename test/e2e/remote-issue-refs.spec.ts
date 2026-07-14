import { expect, it, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { requireDocker } from './support/guards';
import { provisionDatabase } from './support/database';
import { seedUsers } from './support/seed';
import { createDatabaseClient } from '../../server/db/client';
import {
  users,
  clients,
  projects,
  tasks,
  remoteSystemConfigs,
  remoteIssueRefs,
} from '../../server/db/schema';
import {
  getRemoteIssueRefForTask,
  getRemoteIssueRefsForTasks,
  unlinkRemoteIssueRef,
  upsertRemoteIssueRef,
} from '../../server/utils/remote-issue-refs';

const describeRemoteIssueRefs = requireDocker();

describeRemoteIssueRefs('remote issue reference persistence helpers', async () => {
  const dbUrl = await provisionDatabase();
  await seedUsers(dbUrl, [
    { email: 'alice@example.com', displayName: 'Alice' },
    { email: 'bob@example.com', displayName: 'Bob' },
  ]);
  // The helpers under test use the shared lazy `db` client from server/db/index.ts,
  // which reads DATABASE_URL from the environment on first access.
  process.env.DATABASE_URL = dbUrl;
  const { db, sql } = createDatabaseClient(dbUrl);

  afterAll(async () => {
    await sql.end({ timeout: 5 });
  });

  async function getUserId(email: string): Promise<string> {
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    return user!.id;
  }

  async function makeTaskWithConfig(
    userId: string,
    label: string,
  ): Promise<{ taskId: string; configId: string }> {
    const [client] = await db
      .insert(clients)
      .values({ userId, name: `${label} Client` })
      .returning({ id: clients.id });
    const [project] = await db
      .insert(projects)
      .values({ userId, clientId: client!.id, name: `${label} Project` })
      .returning({ id: projects.id });
    const [task] = await db
      .insert(tasks)
      .values({ userId, projectId: project!.id, name: `${label} Task` })
      .returning({ id: tasks.id });
    const [config] = await db
      .insert(remoteSystemConfigs)
      .values({
        userId,
        clientId: client!.id,
        systemType: 'openproject',
        baseUrl: 'https://op.example.com',
        executionMode: 'client',
        roundingRule: 'none',
      })
      .returning({ id: remoteSystemConfigs.id });
    return { taskId: task!.id, configId: config!.id };
  }

  it('persists a new reference', async () => {
    const userId = await getUserId('alice@example.com');
    const { taskId, configId } = await makeTaskWithConfig(userId, 'Persist');

    const saved = await upsertRemoteIssueRef(userId, taskId, configId, '10', 'First title');
    expect(saved.taskId).toBe(taskId);
    expect(saved.remoteIssueId).toBe('10');
    expect(saved.cachedTitle).toBe('First title');
  });

  it('replaces an existing reference so only one row remains', async () => {
    const userId = await getUserId('alice@example.com');
    const { taskId, configId } = await makeTaskWithConfig(userId, 'Replace');

    await upsertRemoteIssueRef(userId, taskId, configId, '10', 'First title');
    await upsertRemoteIssueRef(userId, taskId, configId, '20', 'Second title');

    const rows = await db.select().from(remoteIssueRefs).where(eq(remoteIssueRefs.taskId, taskId));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.remoteIssueId).toBe('20');
    expect(rows[0]?.cachedTitle).toBe('Second title');
  });

  it('unlinks idempotently: unlinking twice succeeds and the second time is a no-op', async () => {
    const userId = await getUserId('alice@example.com');
    const { taskId, configId } = await makeTaskWithConfig(userId, 'Unlink');
    await upsertRemoteIssueRef(userId, taskId, configId, '10', 'Some title');

    await unlinkRemoteIssueRef(userId, taskId);
    const afterFirst = await getRemoteIssueRefForTask(userId, taskId);
    expect(afterFirst).toBeNull();

    await expect(unlinkRemoteIssueRef(userId, taskId)).resolves.toBeUndefined();
    const afterSecond = await getRemoteIssueRefForTask(userId, taskId);
    expect(afterSecond).toBeNull();
  });

  it('derives a URL when the configuration is active', async () => {
    const userId = await getUserId('alice@example.com');
    const { taskId, configId } = await makeTaskWithConfig(userId, 'ActiveUrl');
    await upsertRemoteIssueRef(userId, taskId, configId, '42', 'Active issue');

    const ref = await getRemoteIssueRefForTask(userId, taskId);
    expect(ref?.url).toBe('https://op.example.com/work_packages/42');
  });

  it('omits the URL but keeps cached id/title when the configuration is soft-deleted', async () => {
    const userId = await getUserId('alice@example.com');
    const { taskId, configId } = await makeTaskWithConfig(userId, 'DeletedConfig');
    await upsertRemoteIssueRef(userId, taskId, configId, '99', 'Bare reference');

    await db
      .update(remoteSystemConfigs)
      .set({ deletedAt: new Date() })
      .where(eq(remoteSystemConfigs.id, configId));

    const ref = await getRemoteIssueRefForTask(userId, taskId);
    expect(ref?.remoteIssueId).toBe('99');
    expect(ref?.cachedTitle).toBe('Bare reference');
    expect(ref?.url).toBeUndefined();
  });

  it('supports batch lookup for multiple tasks with mixed active/deleted configs', async () => {
    const userId = await getUserId('alice@example.com');
    const active = await makeTaskWithConfig(userId, 'BatchActive');
    const deleted = await makeTaskWithConfig(userId, 'BatchDeleted');
    await upsertRemoteIssueRef(userId, active.taskId, active.configId, '1', 'Active');
    await upsertRemoteIssueRef(userId, deleted.taskId, deleted.configId, '2', 'Deleted');
    await db
      .update(remoteSystemConfigs)
      .set({ deletedAt: new Date() })
      .where(eq(remoteSystemConfigs.id, deleted.configId));

    const refs = await getRemoteIssueRefsForTasks(userId, [active.taskId, deleted.taskId]);
    expect(refs.get(active.taskId)?.url).toBe('https://op.example.com/work_packages/1');
    expect(refs.get(deleted.taskId)?.url).toBeUndefined();
    expect(refs.get(deleted.taskId)?.cachedTitle).toBe('Deleted');
  });

  it('isolates references across users: user A cannot read or unlink user B Task reference', async () => {
    const aliceId = await getUserId('alice@example.com');
    const bobId = await getUserId('bob@example.com');
    const { taskId, configId } = await makeTaskWithConfig(aliceId, 'Isolation');
    await upsertRemoteIssueRef(aliceId, taskId, configId, '55', "Alice's issue");

    const bobsView = await getRemoteIssueRefForTask(bobId, taskId);
    expect(bobsView).toBeNull();

    await unlinkRemoteIssueRef(bobId, taskId);
    const stillThere = await getRemoteIssueRefForTask(aliceId, taskId);
    expect(stillThere?.remoteIssueId).toBe('55');
  });
});
