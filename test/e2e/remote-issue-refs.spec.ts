import { expect, it, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { requireDocker } from './support/guards';
import { provisionDatabase } from './support/database';
import { seedUsers } from './support/seed';
import { createDatabaseClient } from '../../server/db/client';
import { users, clients, projects, tasks, remoteSystemConfigs } from '../../server/db/schema';
import {
  getRemoteIssueRefForTask,
  getRemoteIssueRefsForTasks,
} from '../../server/utils/remote-issue-refs';

const describeRemoteIssueRefs = requireDocker();

describeRemoteIssueRefs('remote issue reference helpers (inline on tasks)', async () => {
  const dbUrl = await provisionDatabase();
  await seedUsers(dbUrl, [
    { email: 'alice@example.com', displayName: 'Alice' },
    { email: 'bob@example.com', displayName: 'Bob' },
  ]);
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

  async function makeLinkedTask(
    userId: string,
    label: string,
    issue: { id: string; title: string },
  ): Promise<{ taskId: string; configId: string }> {
    const [client] = await db
      .insert(clients)
      .values({ userId, name: `${label} Client` })
      .returning({ id: clients.id });
    const [project] = await db
      .insert(projects)
      .values({ userId, clientId: client!.id, name: `${label} Project` })
      .returning({ id: projects.id });
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
    const now = new Date();
    const [task] = await db
      .insert(tasks)
      .values({
        userId,
        projectId: project!.id,
        name: `${label} Task`,
        remoteSystemConfigId: config!.id,
        remoteIssueId: issue.id,
        remoteIssueCachedTitle: issue.title,
        remoteIssueCreatedAt: now,
        remoteIssueUpdatedAt: now,
      })
      .returning({ id: tasks.id });
    return { taskId: task!.id, configId: config!.id };
  }

  it('reads an inline reference with a derived URL when the configuration is active', async () => {
    const userId = await getUserId('alice@example.com');
    const { taskId } = await makeLinkedTask(userId, 'ActiveUrl', {
      id: '42',
      title: 'Active issue',
    });

    const ref = await getRemoteIssueRefForTask(userId, taskId);
    expect(ref?.remoteIssueId).toBe('42');
    expect(ref?.cachedTitle).toBe('Active issue');
    expect(ref?.url).toBe('https://op.example.com/work_packages/42');
    expect(ref?.taskId).toBe(taskId);
    expect(ref?.id).toBe(taskId);
  });

  it('omits the URL but keeps cached id/title when the configuration is soft-deleted', async () => {
    const userId = await getUserId('alice@example.com');
    const { taskId, configId } = await makeLinkedTask(userId, 'DeletedConfig', {
      id: '99',
      title: 'Bare reference',
    });

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
    const active = await makeLinkedTask(userId, 'BatchActive', { id: '1', title: 'Active' });
    const deleted = await makeLinkedTask(userId, 'BatchDeleted', { id: '2', title: 'Deleted' });
    await db
      .update(remoteSystemConfigs)
      .set({ deletedAt: new Date() })
      .where(eq(remoteSystemConfigs.id, deleted.configId));

    const refs = await getRemoteIssueRefsForTasks(userId, [active.taskId, deleted.taskId]);
    expect(refs.get(active.taskId)?.url).toBe('https://op.example.com/work_packages/1');
    expect(refs.get(deleted.taskId)?.url).toBeUndefined();
    expect(refs.get(deleted.taskId)?.cachedTitle).toBe('Deleted');
  });

  it('isolates references across users', async () => {
    const aliceId = await getUserId('alice@example.com');
    const bobId = await getUserId('bob@example.com');
    const { taskId } = await makeLinkedTask(aliceId, 'Isolation', {
      id: '55',
      title: "Alice's issue",
    });

    const bobsView = await getRemoteIssueRefForTask(bobId, taskId);
    expect(bobsView).toBeNull();
  });

  it('returns null for an unlinked task', async () => {
    const userId = await getUserId('alice@example.com');
    const [task] = await db
      .insert(tasks)
      .values({ userId, name: 'Unlinked Only' })
      .returning({ id: tasks.id });

    const ref = await getRemoteIssueRefForTask(userId, task!.id);
    expect(ref).toBeNull();
  });
});
