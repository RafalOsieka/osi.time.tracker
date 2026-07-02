import { expect, it } from 'vitest';
import { createPage, url } from '@nuxt/test-utils/e2e';
import { requireBrowser } from './support/guards';
import { provisionDatabase } from './support/database';
import { seedUsers } from './support/seed';
import { setupServer } from './support/setupServer';
import { CookieJar, primeCsrf } from './support/auth';

const describeTasksUI = requireBrowser();

describeTasksUI('tasks UI flow', async () => {
  const dbUrl = await provisionDatabase();
  await seedUsers(dbUrl, [
    { email: 'tasksui@example.com', displayName: 'tasksuiuser' },
    { email: 'tasksui2@example.com', displayName: 'tasksuiuser2' },
  ]);
  await setupServer({ databaseUrl: dbUrl, browser: true });

  async function loginAs(email: string) {
    const page = await createPage('/');
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.fill('[data-testid="email"]', email);
    await page.fill('[data-testid="password"] input', 'secret');
    await page.click('[data-testid="login-button"]');
    await page.waitForSelector('[data-testid="app-topbar"]');
    return page;
  }

  /** Create a client + project via the API, used to seed data ahead of UI-driven task CRUD. */
  async function createClientAndProjectViaApi(
    email: string,
    clientName: string,
    projectName: string,
  ): Promise<{ project: { id: string; name: string } }> {
    const jar = new CookieJar();
    const token = await primeCsrf(jar);
    const loginRes = await fetch(url('/api/auth/login'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ email, password: 'secret' }),
    });
    jar.capture(loginRes);
    const clientRes = await fetch(url('/api/clients'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ name: clientName }),
    });
    const client = await clientRes.json();
    const projectRes = await fetch(url('/api/projects'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ name: projectName, clientId: client.id }),
    });
    const project = await projectRes.json();
    return { project };
  }

  it('4.6 full CRUD happy path through the UI, project filter, and cross-user isolation', async () => {
    const { project } = await createClientAndProjectViaApi(
      'tasksui@example.com',
      'UI Client ' + Date.now(),
      'UI Project ' + Date.now(),
    );

    const page = await loginAs('tasksui@example.com');
    await page.click('[data-testid="app-sidebar"] a[href="/tasks"]');
    await page.waitForSelector('[data-testid="tasks-page"]');

    // Create a task with a project
    await page.click('[data-testid="new-task-button"]');
    await page.waitForSelector('[data-testid="task-dialog"]');
    await page.fill('[data-testid="task-name-input"]', 'UI Task One');
    await page.click('[data-testid="task-project-select"]');
    await page.getByRole('option', { name: project.name }).click();
    await page.click('[data-testid="save-button"]');
    await page.waitForSelector('[data-testid="task-dialog"]', { state: 'hidden' });

    await page.waitForFunction(() => document.body.textContent?.includes('UI Task One'));
    expect(await page.textContent('[data-testid="tasks-table"]')).toContain('UI Task One');

    // Create a project-less task with a duplicate name (allowed, distinguished by #N)
    await page.click('[data-testid="new-task-button"]');
    await page.waitForSelector('[data-testid="task-dialog"]');
    await page.fill('[data-testid="task-name-input"]', 'UI Task One');
    await page.click('[data-testid="save-button"]');
    await page.waitForSelector('[data-testid="task-dialog"]', { state: 'hidden' });

    await page.waitForFunction(
      () => document.body.querySelectorAll('[data-testid^="edit-task-"]').length === 2,
    );

    // Filter by project: only the assigned task should remain
    await page.click('[data-testid="task-project-filter"]');
    await page.getByRole('option', { name: project.name }).click();
    await page.waitForFunction(
      () => document.body.querySelectorAll('[data-testid^="edit-task-"]').length === 1,
    );

    // Filter by "No project" sentinel: only the project-less task should remain
    await page.click('[data-testid="task-project-filter"] .p-select-clear-icon');
    await page.click('[data-testid="task-project-filter"]');
    await page.getByRole('option', { name: 'No project' }).click();
    await page.waitForFunction(
      () => document.body.querySelectorAll('[data-testid^="edit-task-"]').length === 1,
    );

    // Clear the filter to see all tasks again
    await page.click('[data-testid="task-project-filter"] .p-select-clear-icon');
    await page.waitForFunction(
      () => document.body.querySelectorAll('[data-testid^="edit-task-"]').length === 2,
    );

    // Edit the project-less task: assign it to the project
    const rows = page.locator('tr', { hasText: 'UI Task One' });
    const secondRow = rows.nth(1);
    await secondRow.locator('[data-testid^="edit-task-"]').click();
    await page.waitForSelector('[data-testid="task-dialog"]');
    await page.fill('[data-testid="task-name-input"]', 'UI Task Renamed');
    await page.click('[data-testid="task-project-select"]');
    await page.getByRole('option', { name: project.name }).click();
    await page.click('[data-testid="save-button"]');
    await page.waitForSelector('[data-testid="task-dialog"]', { state: 'hidden' });
    await page.waitForFunction(() => document.body.textContent?.includes('UI Task Renamed'));

    // Clear its project again
    const renamedRow = page.locator('tr', { hasText: 'UI Task Renamed' });
    await renamedRow.locator('[data-testid^="edit-task-"]').click();
    await page.waitForSelector('[data-testid="task-dialog"]');
    await page.click('[data-testid="task-project-select"] .p-select-clear-icon');
    await page.click('[data-testid="save-button"]');
    await page.waitForSelector('[data-testid="task-dialog"]', { state: 'hidden' });

    // Delete the renamed task
    await renamedRow.locator('[data-testid^="delete-task-"]').click();
    await page.getByRole('button', { name: /yes/i }).click();
    await page.waitForFunction(() => !document.body.textContent?.includes('UI Task Renamed'));
    expect(await page.textContent('[data-testid="tasks-table"]')).not.toContain('UI Task Renamed');

    await page.close();
  });

  it('4.6b cross-user isolation: a foreign task id is not accessible', async () => {
    const { project } = await createClientAndProjectViaApi(
      'tasksui2@example.com',
      'Isolation Client ' + Date.now(),
      'Isolation Project ' + Date.now(),
    );

    const jar = new CookieJar();
    const token = await primeCsrf(jar);
    const loginRes = await fetch(url('/api/auth/login'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ email: 'tasksui2@example.com', password: 'secret' }),
    });
    jar.capture(loginRes);
    const taskRes = await fetch(url('/api/tasks'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ name: 'Foreign Task', projectId: project.id }),
    });
    const foreignTask = await taskRes.json();

    const otherJar = new CookieJar();
    const otherToken = await primeCsrf(otherJar);
    const otherLoginRes = await fetch(url('/api/auth/login'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'csrf-token': otherToken,
        cookie: otherJar.header(),
      },
      body: JSON.stringify({ email: 'tasksui@example.com', password: 'secret' }),
    });
    otherJar.capture(otherLoginRes);

    const patchRes = await fetch(url(`/api/tasks/${foreignTask.id}`), {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        'csrf-token': otherToken,
        cookie: otherJar.header(),
      },
      body: JSON.stringify({ name: 'Hijacked' }),
    });
    expect(patchRes.status).toBe(404);
  });
});
