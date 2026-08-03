import { expect, it, afterAll } from 'vitest';
import { requireDocker } from './support/guards';
import { provisionDatabase } from './support/database';
import { seedUsers } from './support/seed';
import { createDatabaseClient } from '../../server/db/client';
import {
  users,
  tasks,
  timeEntries,
  clients,
  projects,
  remoteSystemConfigs,
} from '../../server/db/schema';
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

  it('creates a new unlinked task when no match exists', async () => {
    const userId = await getUserId();
    const taskId = await db.transaction((tx) => resolveTaskId(tx, userId, 'Brand New Task', null));
    expect(taskId).toBeTruthy();
    const [created] = await db.select().from(tasks).where(eq(tasks.id, taskId!)).limit(1);
    expect(created?.name).toBe('Brand New Task');
    expect(created?.projectId).toBeNull();
    expect(created?.remoteIssueId).toBeNull();
  });

  it('matches a single existing candidate in the same project-less scope', async () => {
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

  it('tie-breaks ambiguous titles by most recently used entry startedAt', async () => {
    const userId = await getUserId();
    const [client] = await db
      .insert(clients)
      .values({ userId, name: 'TB Client' })
      .returning({ id: clients.id });
    const [project] = await db
      .insert(projects)
      .values({ userId, clientId: client!.id, name: 'TB Project' })
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
    const [older] = await db
      .insert(tasks)
      .values({
        userId,
        projectId: project!.id,
        name: 'Ambiguous',
        remoteIssueId: '1',
        remoteSystemConfigId: config!.id,
        remoteIssueCachedTitle: 'One',
        remoteIssueCreatedAt: now,
        remoteIssueUpdatedAt: now,
      })
      .returning({ id: tasks.id });
    const [newer] = await db
      .insert(tasks)
      .values({
        userId,
        projectId: project!.id,
        name: 'Ambiguous',
        remoteIssueId: '2',
        remoteSystemConfigId: config!.id,
        remoteIssueCachedTitle: 'Two',
        remoteIssueCreatedAt: now,
        remoteIssueUpdatedAt: now,
      })
      .returning({ id: tasks.id });

    await db.insert(timeEntries).values({
      userId,
      taskId: older!.id,
      startedAt: new Date('2026-01-01T10:00:00.000Z'),
      stoppedAt: new Date('2026-01-01T11:00:00.000Z'),
    });
    await db.insert(timeEntries).values({
      userId,
      taskId: newer!.id,
      startedAt: new Date('2026-01-02T10:00:00.000Z'),
      stoppedAt: new Date('2026-01-02T11:00:00.000Z'),
    });

    const chosen = await db.transaction((tx) =>
      resolveTaskId(tx, userId, 'Ambiguous', project!.id),
    );
    expect(chosen).toBe(newer!.id);
  });

  it('prefers a candidate with entries over one with none when tie-breaking', async () => {
    const userId = await getUserId();
    const name = `NoEntries ${Date.now()}`;
    const [withEntries] = await db
      .insert(tasks)
      .values({ userId, name, remoteIssueId: null })
      .returning({ id: tasks.id });
    await db.insert(timeEntries).values({
      userId,
      taskId: withEntries!.id,
      startedAt: new Date('2026-02-01T10:00:00.000Z'),
      stoppedAt: new Date('2026-02-01T11:00:00.000Z'),
    });
    // Second candidate with a different remote issue and no entries.
    const [configClient] = await db
      .insert(clients)
      .values({ userId, name: `Cfg ${name}` })
      .returning({ id: clients.id });
    const [config] = await db
      .insert(remoteSystemConfigs)
      .values({
        userId,
        clientId: configClient!.id,
        systemType: 'openproject',
        baseUrl: 'https://op.example.com',
        executionMode: 'client',
        roundingRule: 'none',
      })
      .returning({ id: remoteSystemConfigs.id });
    const now = new Date();
    await db.insert(tasks).values({
      userId,
      name,
      remoteIssueId: '999',
      remoteSystemConfigId: config!.id,
      remoteIssueCachedTitle: 'Linked twin',
      remoteIssueCreatedAt: now,
      remoteIssueUpdatedAt: now,
    });

    const chosen = await db.transaction((tx) => resolveTaskId(tx, userId, name, null));
    expect(chosen).toBe(withEntries!.id);
  });

  it('explicit remote issue bypasses the tie-break and find-or-creates that task', async () => {
    const userId = await getUserId();
    const [client] = await db
      .insert(clients)
      .values({ userId, name: 'Exact Client' })
      .returning({ id: clients.id });
    const [project] = await db
      .insert(projects)
      .values({ userId, clientId: client!.id, name: 'Exact Project' })
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
    const [mru] = await db
      .insert(tasks)
      .values({
        userId,
        projectId: project!.id,
        name: 'Exact Title',
        remoteIssueId: '10',
        remoteSystemConfigId: config!.id,
        remoteIssueCachedTitle: 'Ten',
        remoteIssueCreatedAt: now,
        remoteIssueUpdatedAt: now,
      })
      .returning({ id: tasks.id });
    await db.insert(timeEntries).values({
      userId,
      taskId: mru!.id,
      startedAt: new Date('2026-03-01T10:00:00.000Z'),
      stoppedAt: new Date('2026-03-01T11:00:00.000Z'),
    });

    const created = await db.transaction((tx) =>
      resolveTaskId(tx, userId, 'Exact Title', project!.id, {
        remoteIssueId: '20',
        remoteSystemConfigId: config!.id,
        cachedTitle: 'Twenty',
      }),
    );
    expect(created).not.toBe(mru!.id);
    const [row] = await db.select().from(tasks).where(eq(tasks.id, created!)).limit(1);
    expect(row?.remoteIssueId).toBe('20');
    expect(row?.remoteIssueCachedTitle).toBe('Twenty');

    const reused = await db.transaction((tx) =>
      resolveTaskId(tx, userId, 'Exact Title', project!.id, {
        remoteIssueId: '20',
        remoteSystemConfigId: config!.id,
        cachedTitle: 'Twenty',
      }),
    );
    expect(reused).toBe(created);
  });
});
